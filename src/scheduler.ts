// 排产调度：同一槽位同一时段只容纳一个批次，按加急顺序占位，容量满保留交期并排队
import type { DyeSlot, RepairBatch, Urgency } from "./types";
import { addDays, overlaps, todayStr } from "./utils";

export const urgencyRank = (u: Urgency): number =>
  u === "特急" ? 0 : u === "加急" ? 1 : 2;

const COMMITTED = new Set(["染机上", "已完工", "已入库"]);

/** 批次占位优先级：加急等级优先，交期早的优先，先建的优先 */
export function priorityOf(b: RepairBatch): number {
  const due = b.dueDate ? new Date(b.dueDate + "T00:00:00").getTime() : 9_999_999_999_999;
  return urgencyRank(b.urgency) * 1e15 + due / 1e6 + b.createdAt / 1e12;
}

/** 判断某槽位在 [start,end) 是否被其它批次占用 */
function slotBusy(
  slotId: string,
  start: string,
  end: string,
  batches: RepairBatch[],
  selfId: string
): boolean {
  return batches.some(
    (o) =>
      o.id !== selfId &&
      o.slotId === slotId &&
      (o.status === "已占位" || o.status === "染机上") &&
      o.plannedStart != null &&
      o.plannedEnd != null &&
      overlaps(start, end, o.plannedStart as string, o.plannedEnd as string)
  );
}

/** 为单个批次寻找最早可占位的槽位与时段 */
function findPlacement(
  batch: RepairBatch,
  batches: RepairBatch[],
  slots: DyeSlot[],
  today: string
): { slotId: string; start: string; end: string } | null {
  const eligible = slots.filter(
    (s) => s.status === "运行中" && s.capacityKg >= batch.weightKg
  );
  if (eligible.length === 0) return null;
  const HORIZON = 400;
  for (let offset = 0; offset <= HORIZON; offset++) {
    const start = addDays(today, offset);
    const end = addDays(start, batch.days);
    for (const slot of eligible) {
      if (!slotBusy(slot.id, start, end, batches, batch.id)) {
        return { slotId: slot.id, start, end };
      }
    }
  }
  return null;
}

/**
 * 自动排产：释放所有未开始批次（待分配 / 已占位）的占用，
 * 按加急顺序重新占位；染机上 / 已完工 / 已入库 等已发生的不动。
 */
export function scheduleBatches(
  inputBatches: RepairBatch[],
  slots: DyeSlot[],
  today: string = todayStr()
): RepairBatch[] {
  const batches = inputBatches.map((b) => ({ ...b }));

  // 释放未开始批次的占用
  for (const b of batches) {
    if (!COMMITTED.has(b.status)) {
      b.slotId = null;
      b.plannedStart = null;
      b.plannedEnd = null;
      b.status = "待分配";
    }
  }

  const pending = batches
    .filter((b) => !COMMITTED.has(b.status))
    .sort((a, b) => priorityOf(a) - priorityOf(b));

  for (const b of pending) {
    const placement = findPlacement(b, batches, slots, today);
    if (placement) {
      b.slotId = placement.slotId;
      b.plannedStart = placement.start;
      b.plannedEnd = placement.end;
      b.status = "已占位";
    } else {
      // 容量满：保留交期，继续排队
      b.slotId = null;
      b.plannedStart = null;
      b.plannedEnd = null;
      b.status = "待分配";
    }
  }

  return batches;
}

/**
 * 染机停机/维护：释放该槽位上所有未开始批次（已占位）的占用，
 * 已染/在染的不动；随后按剩余容量顺延重排。
 * 返回 { batches, releasedIds }
 */
export function releaseSlotAndReschedule(
  inputBatches: RepairBatch[],
  slots: DyeSlot[],
  slotId: string,
  today: string = todayStr()
): { batches: RepairBatch[]; releasedIds: string[] } {
  const batches = inputBatches.map((b) => ({ ...b }));
  const releasedIds: string[] = [];

  for (const b of batches) {
    if (
      b.slotId === slotId &&
      b.status === "已占位" // 未开始染色
    ) {
      b.slotId = null;
      b.plannedStart = null;
      b.plannedEnd = null;
      b.status = "待分配";
      releasedIds.push(b.id);
    }
  }

  const rescheduled = scheduleBatches(batches, slots, today);
  return { batches: rescheduled, releasedIds };
}
