// 外协工坊回执对账：按批次号与本院记录对账
// 色卡批次或用量不一致 → 留待处理；迟到/重复回执不能改写已确认工序
import type { Receipt, RepairBatch } from "./types";

export interface ReconcileResult {
  receipt: Receipt;
  patch?: Partial<RepairBatch>;
  ok: boolean;
}

/**
 * 对账规则：
 * 1. 按批次号匹配本院记录，查无此批 → 待处理
 * 2. 同批次已有对账通过回执 → 重复/迟到，留存不改写
 * 3. 色卡批次 或 用量 与本院记录不一致 → 待处理
 * 4. 一致但工序已确认/已完工/已入库 → 迟到回执，仅留存，不改写
 * 5. 一致且未确认 → 对账通过，回填批次（外协）信息
 */
export function reconcileReceipt(
  receipt: Receipt,
  batches: RepairBatch[],
  receipts: Receipt[],
  now: number
): ReconcileResult {
  const target = batches.find((b) => b.id === receipt.batchId);

  if (!target) {
    return {
      ok: false,
      receipt: {
        ...receipt,
        status: "待处理",
        reason: `本院无此批次号 ${receipt.batchId}，无法对账`,
      },
    };
  }

  const dup = receipts.find(
    (r) =>
      r.id !== receipt.id &&
      r.batchId === receipt.batchId &&
      r.status === "已对账"
  );
  if (dup) {
    return {
      ok: false,
      receipt: {
        ...receipt,
        status: "迟到",
        duplicateOf: dup.id,
        reason: `该批次已有对账通过回执 ${dup.id}；本回执按迟到/重复留存，不改写本院记录`,
      },
    };
  }

  const reasons: string[] = [];
  if (receipt.colorCardBatch !== target.colorCardBatch) {
    reasons.push(
      `色卡批次不一致（回执 ${receipt.colorCardBatch} ≠ 本院 ${target.colorCardBatch}）`
    );
  }
  if (Math.abs(receipt.usageKg - target.usageKg) > 0.001) {
    reasons.push(
      `用量不一致（回执 ${receipt.usageKg}kg ≠ 本院 ${target.usageKg}kg）`
    );
  }
  if (reasons.length > 0) {
    return {
      ok: false,
      receipt: { ...receipt, status: "待处理", reason: reasons.join("；") },
    };
  }

  if (target.confirmed || target.status === "已完工" || target.status === "已入库") {
    return {
      ok: false,
      receipt: {
        ...receipt,
        status: "迟到",
        reason: "工序已确认/已完工，后到回执仅留存，不改写已确认工序",
      },
    };
  }

  return {
    ok: true,
    receipt: { ...receipt, status: "已对账", reconciledAt: now },
    patch: {
      outsourced: true,
      workshop: receipt.workshop,
      confirmed: true,
      note: target.note,
    },
  };
}
