// 排产引擎（纯函数）
//
// 核心规则：
// 1. 同一槽位同一时段（槽·日）只容纳一个批次；
// 2. 每个槽·日还有容量上限（weightPerDay 累加 ≤ capacityPerDay）；
// 3. 按加急顺序占位（加急 > 普通；同级交期早优先，再按批次号稳定排序）；
// 4. 容量满时保留交期并排队；
// 5. 染机停机/维护后，未开始批次释放占用并按剩余容量顺延，
//    已开染/已染好/已入库批次占用照旧保留（染好的照旧入库）；
// 6. 色卡染色类型要与槽位兼容（植物染/矿物染/化学染）。

import type {
  Batch,
  DyeType,
  Priority,
  Slot,
  AppState,
  BatchStatus,
  ColorCard,
} from "../types";

export type Day = number;

/** 占用索引：slotId -> day -> 该槽·日上的（已锁定）批次及负载 */
export type OccupancyMap = Record<
  string,
  Record<Day, { batchIds: string[]; load: number }>
>;

export interface QueueItem {
  batchId: string;
  reason: string;
}

export interface ScheduleResult {
  batches: Batch[];
  queue: QueueItem[];
  occupancy: OccupancyMap;
}

/** 这些状态的批次占用是“锁定”的：停机顺延、重新排产都不能动 */
const LOCKED_STATUSES: BatchStatus[] = [
  "in_progress",
  "dyed",
  "stored",
];

const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  normal: 1,
};

/** 占位排序：加急先，交期早先，批次号兜底（稳定） */
export function compareForSchedule(a: Batch, b: Batch): number {
  if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) {
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  }
  if (a.dueDay !== b.dueDay) return a.dueDay - b.dueDay;
  return a.id.localeCompare(b.id, "zh-Hans-CN");
}

function emptyOccupancy(): OccupancyMap {
  return {};
}

function cell(map: OccupancyMap, slotId: string, day: Day) {
  map[slotId] ??= {};
  map[slotId][day] ??= { batchIds: [], load: 0 };
  return map[slotId][day];
}

function slotDownAt(slot: Slot, day: Day): boolean {
  return (
    slot.downtime !== null &&
    day >= slot.downtime.from &&
    day <= slot.downtime.to
  );
}

/** 该槽能否染该染色类型（植物/矿物/化学不可混槽） */
export function slotAcceptsDye(slot: Slot, dye: DyeType): boolean {
  return slot.dyeTypes.includes(dye);
}

/** 由色卡表得到批次所需染色类型 */
export function batchDyeType(
  batch: Batch,
  cards: ColorCard[]
): DyeType | null {
  return cards.find((c) => c.id === batch.cardId)?.dyeType ?? null;
}

/**
 * 判断一批（duration 天）能否放进某槽从 startDay 起的连续窗口：
 * - 窗口在视野内
 * - 不落在该槽停机窗口
 * - 每个槽·日要么空、要么仍有容量
 */
function canPlace(
  map: OccupancyMap,
  slot: Slot,
  batch: Batch,
  startDay: Day,
  horizon: number
): boolean {
  for (let d = startDay; d < startDay + batch.duration; d++) {
    if (d < 0 || d >= horizon) return false;
    if (slotDownAt(slot, d)) return false;
    const c = map[slot.id]?.[d];
    if (c && c.batchIds.length > 0) return false; // 同一槽·日只容一批
    if (c && c.load + batch.weightPerDay > slot.capacityPerDay) return false;
    if (!c && batch.weightPerDay > slot.capacityPerDay) return false;
  }
  return true;
}

function place(
  map: OccupancyMap,
  slot: Slot,
  batch: Batch,
  startDay: Day
): void {
  for (let d = startDay; d < startDay + batch.duration; d++) {
    const c = cell(map, slot.id, d);
    c.batchIds.push(batch.id);
    c.load += batch.weightPerDay;
  }
}

function assigned(batch: Batch): Batch {
  return {
    ...batch,
    status: "scheduled",
    slotId: batch.occupancy[0]?.slotId ?? null,
    startDay: batch.occupancy[0]?.day ?? null,
  };
}

function unassign(batch: Batch): Batch {
  return {
    ...batch,
    status: "queued",
    slotId: null,
    startDay: null,
    occupancy: [],
  };
}

function queueReason(slots: Slot[], batch: Batch, dye: DyeType | null): string {
  const maxCap = Math.max(
    0,
    ...slots
      .filter((s) => (dye ? slotAcceptsDye(s, dye) : true))
      .map((s) => s.capacityPerDay)
  );
  if (batch.weightPerDay > maxCap) {
    return `单批负载 ${batch.weightPerDay} 超过兼容槽最大容量 ${maxCap}，保留交期 D${batch.dueDay} 排队`;
  }
  return `排产视野内无空闲槽·日（加急/交期占位已满），保留交期 D${batch.dueDay} 排队`;
}

/**
 * 在已有锁定占用上，尽量为一个批次找位：
 * 优先从早于交期的窗口找（尽量不超期），再放宽到整个视野。
 */
function findPlacement(
  map: OccupancyMap,
  slots: Slot[],
  batch: Batch,
  horizon: number,
  dye: DyeType
): { slot: Slot; startDay: Day } | null {
  // 先按交期约束：startDay + duration - 1 <= dueDay
  const deadline = batch.dueDay - batch.duration + 1;
  const compatible = slots.filter((s) => slotAcceptsDye(s, dye));

  const tryRange = (maxStart: Day) => {
    for (const slot of compatible) {
      for (let s = 0; s <= maxStart; s++) {
        if (canPlace(map, slot, batch, s, horizon)) {
          return { slot, startDay: s };
        }
      }
    }
    return null;
  };

  if (deadline >= 0) {
    const hit = tryRange(deadline);
    if (hit) return hit;
  }
  return tryRange(horizon - batch.duration);
}

function buildLockedMap(batches: Batch[], slots: Slot[]): OccupancyMap {
  const map = emptyOccupancy();
  for (const b of batches) {
    if (LOCKED_STATUSES.includes(b.status) && b.occupancy.length) {
      const slot = slots.find((s) => s.id === b.slotId);
      for (const occ of b.occupancy) {
        if (!slot || occ.day < 0) continue;
        const c = cell(map, occ.slotId, occ.day);
        c.batchIds.push(b.id);
        c.load += b.weightPerDay;
      }
    }
  }
  return map;
}

/**
 * 全量重排：保留锁定批次占用，释放所有“已排产未开染”占用，
 * 再按加急顺序重新占位，排不进的排队（交期保留）。
 */
export function replan(state: AppState): ScheduleResult {
  const map = buildLockedMap(state.batches, state.slots);

  // 已排产但未开染的先全部释放，按统一顺序重抢
  const candidates = state.batches
    .filter((b) => b.status === "scheduled" || b.status === "queued")
    .map(unassign)
    .sort(compareForSchedule);

  const result: Batch[] = [];
  const queue: QueueItem[] = [];

  for (const b of candidates) {
    const dye = batchDyeType(b, state.cards);
    const hit =
      dye && findPlacement(map, state.slots, b, state.horizon, dye);
    if (hit) {
      const occ = [];
      for (let d = hit.startDay; d < hit.startDay + b.duration; d++) {
        occ.push({ slotId: hit.slot.id, day: d });
      }
      const placed = { ...b, occupancy: occ };
      place(map, hit.slot, b, hit.startDay);
      result.push(assigned(placed));
    } else {
      result.push(b); // 保持 queued，交期字段 dueDay 不动
      queue.push({
        batchId: b.id,
        reason: queueReason(state.slots, b, dye),
      });
    }
  }

  const finalBatches = state.batches.map((orig) => {
    const done = result.find((r) => r.id === orig.id);
    return done ?? orig;
  });

  return { batches: finalBatches, queue, occupancy: map };
}

/**
 * 停机/维护处理：
 * - 把落在（受影响槽位 × 停机窗口）内、且“已排产未开染”的批次释放；
 * - 锁定批次（已开染/染好/入库）占用保留——已染好的照旧入库；
 * - 然后在剩余容量上按加急顺序顺延重排（含原本就在排队的批次）；
 * - 仍排不进的继续排队，交期不变。
 */
export function applyDowntime(state: AppState): ScheduleResult {
  const isAffected = (b: Batch): boolean => {
    if (b.status !== "scheduled") return false;
    return b.occupancy.some((occ) => {
      const slot = state.slots.find((s) => s.id === occ.slotId);
      return slot && slotDownAt(slot, occ.day);
    });
  };

  const released: Batch[] = [];
  const passthrough: Batch[] = [];
  for (const b of state.batches) {
    if (isAffected(b)) {
      released.push(unassign(b));
    } else {
      passthrough.push(b);
    }
  }

  // 用保留下来的占用（锁定 + 未受停机影响的已排产）建图
  const map = buildLockedMap(passthrough, state.slots);
  for (const b of passthrough) {
    if (b.status === "scheduled") {
      const slot = state.slots.find((s) => s.id === b.slotId);
      if (slot) place(map, slot, b, b.startDay ?? 0);
    }
  }

  // 受影响释放单 + 原本排队单，按加急顺序在剩余容量上顺延
  const waiters = [...released];
  const alreadyQueued = state.batches.filter(
    (b) => b.status === "queued" && !released.some((r) => r.id === b.id)
  );
  waiters.push(...alreadyQueued);
  waiters.sort(compareForSchedule);

  const updated = new Map<string, Batch>();
  const queue: QueueItem[] = [];
  for (const b of waiters) {
    const dye = batchDyeType(b, state.cards);
    // 顺延：在剩余容量上重新找位。停机槽本身在窗口内被 canPlace 排除，
    // 批次可优先落到未停机槽的空档；原槽恢复后也可被再次选中。
    const hit =
      dye && findPlacement(map, state.slots, b, state.horizon, dye);
    if (hit) {
      const occ = [];
      for (let d = hit.startDay; d < hit.startDay + b.duration; d++) {
        occ.push({ slotId: hit.slot.id, day: d });
      }
      const placed = { ...b, occupancy: occ };
      place(map, hit.slot, b, hit.startDay);
      updated.set(b.id, assigned(placed));
    } else {
      updated.set(b.id, b);
      queue.push({ batchId: b.id, reason: queueReason(state.slots, b, dye) });
    }
  }

  const finalBatches = state.batches.map(
    (orig) => updated.get(orig.id) ?? orig
  );
  return { batches: finalBatches, queue, occupancy: map };
}

/** 初始/新增单后：不打断已排产，只把排队单按加急往空位补 */
export function scheduleQueued(state: AppState): ScheduleResult {
  const map = buildLockedMap(state.batches, state.slots);
  for (const b of state.batches) {
    if (b.status === "scheduled") {
      const slot = state.slots.find((s) => s.id === b.slotId);
      if (slot) place(map, slot, b, b.startDay ?? 0);
    }
  }
  const waiters = state.batches
    .filter((b) => b.status === "queued")
    .sort(compareForSchedule);

  const updated = new Map<string, Batch>();
  const queue: QueueItem[] = [];
  for (const b of waiters) {
    const dye = batchDyeType(b, state.cards);
    const hit =
      dye && findPlacement(map, state.slots, b, state.horizon, dye);
    if (hit) {
      const occ = [];
      for (let d = hit.startDay; d < hit.startDay + b.duration; d++) {
        occ.push({ slotId: hit.slot.id, day: d });
      }
      place(map, hit.slot, b, hit.startDay);
      updated.set(b.id, assigned({ ...b, occupancy: occ }));
    } else {
      queue.push({ batchId: b.id, reason: queueReason(state.slots, b, dye) });
    }
  }
  const finalBatches = state.batches.map(
    (orig) => updated.get(orig.id) ?? orig
  );
  return { batches: finalBatches, queue, occupancy: map };
}
