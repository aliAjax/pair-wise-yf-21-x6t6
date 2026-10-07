// 旧数据升级（迁移）引擎
//
// 旧记录可能缺「交期」和「槽位号」：
// - 缺交期 → 补成普通单（priority=normal），交期给一个兜底值但明确标记“交期待补”；
// - 缺槽位号 → slotId=null、状态待分配（queued），由排产引擎统一分配；
// - 旧记录仍能打开：source=legacy 保留标记，任何字段都不丢，全部可查看/编辑。

import type { AppState, Batch } from "../types";
import { uid, nowStamp } from "./date";

/** 旧系统导出的批次：字段可能缺失 */
export interface LegacyBatchRow {
  id: string;
  archiveId?: string | null;
  cardId?: string | null;
  cardLot?: string | null;
  quantity?: number | null;
  loanKind?: string | null;
  priority?: string | null;
  dueDay?: number | null;
  slotId?: string | null;
  startDay?: number | null;
  duration?: number | null;
  note?: string | null;
}

export interface MigrationReport {
  total: number;
  filledDue: string[];
  filledPriority: string[];
  unassigned: string[];
}

export const LEGACY_FALLBACK_DUE = 9; // 旧单兜底交期（相对基准日第 9 天），仅占位，提示人工补录

export function migrateLegacyBatches(
  rows: LegacyBatchRow[],
  state: AppState
): { batches: Batch[]; report: MigrationReport } {
  const report: MigrationReport = {
    total: rows.length,
    filledDue: [],
    filledPriority: [],
    unassigned: [],
  };

  const batches: Batch[] = rows.map((row) => {
    const hasDue = typeof row.dueDay === "number" && Number.isFinite(row.dueDay);
    const hasPriority = row.priority === "urgent" || row.priority === "normal";
    const hasSlot = typeof row.slotId === "string" && row.slotId.trim() !== "";

    if (!hasDue) report.filledDue.push(row.id);
    if (!hasPriority) report.filledPriority.push(row.id);
    if (!hasSlot) report.unassigned.push(row.id);

    const priority: Batch["priority"] = hasPriority
      ? (row.priority as Batch["priority"])
      : "normal";

    const noteParts = [];
    if (!hasDue) noteParts.push("旧数据缺交期：已补为普通单，交期为兜底值，待人工补录");
    if (!hasSlot) noteParts.push("旧数据缺槽位号：待分配");
    if (row.note) noteParts.push(row.note);

    return {
      id: row.id,
      archiveId: row.archiveId ?? "UNKNOWN",
      cardId: row.cardId ?? "UNKNOWN",
      cardLot: row.cardLot ?? "未知色卡批次",
      quantity: typeof row.quantity === "number" ? row.quantity : 0,
      loanKind: row.loanKind === "loan" ? "loan" : "private",
      priority,
      dueDay: hasDue ? (row.dueDay as number) : LEGACY_FALLBACK_DUE,
      status: "queued", // 待分配：统一进队列，由排产引擎按剩余容量分配
      slotId: hasSlot ? (row.slotId as string) : null,
      startDay: hasSlot ? row.startDay ?? null : null,
      duration:
        typeof row.duration === "number" && row.duration > 0
          ? row.duration
          : 1,
      occupancy: [],
      weightPerDay: typeof row.quantity === "number" ? row.quantity : 1,
      source: "legacy",
      outsourced: false,
      note: noteParts.join("｜") || undefined,
      history: [
        {
          id: uid("ev"),
          at: nowStamp(),
          step: "旧档案升级导入（缺字段已补默认值，原始记录保留）",
          by: "迁移引擎",
          confirmed: true,
        },
      ],
    };
  });

  return { batches: [...state.batches, ...batches], report };
}
