// 外协工坊回执对账引擎（纯函数）
//
// 规则：
// 1. 只按「批次号」与本院记录对账；
// 2. 色卡批次或用量不一致 → 留待处理（status=mismatch），不写入工序；
// 3. 本院无此批次号 → 留待处理（status=unknown）；
// 4. 晚到但内容与已确认工序一致 → 重复回执（status=duplicate），忽略；
// 5. 完全一致且尚未据此确认过 → matched，向工序流水“追加”一条已确认工序；
// 6. 后到回执永远不能改写已确认工序（流水只增不改）。

import type { AppState, Batch, Receipt, ReceiptStatus } from "../types";
import { uid, nowStamp } from "./date";

export interface ReceiptInput {
  batchNo: string;
  cardLot: string;
  quantity: number;
  workshop: string;
  arrivedAt?: string;
}

export interface ReconcileResult {
  state: AppState;
  receipt: Receipt;
}

/** 本院该批次此前是否已有「外协染线确认」且内容一致 */
function findConfirmedDyeStep(
  batch: Batch,
  cardLot: string,
  quantity: number
): boolean {
  return batch.history.some(
    (h) =>
      h.confirmed &&
      h.step.startsWith("外协染线确认") &&
      h.step.includes(cardLot) &&
      h.step.includes(String(quantity))
  );
}

/** 本院该批次是否已据此回执确认过（用于识别重复） */
export function reconcileReceipt(
  state: AppState,
  input: ReceiptInput
): ReconcileResult {
  const arrivedAt = input.arrivedAt ?? nowStamp();
  const batch = state.batches.find((b) => b.id === input.batchNo.trim());

  let status: ReceiptStatus;
  let detail: string;
  let applied = false;
  let batches = state.batches;

  if (!batch) {
    status = "unknown";
    detail = `本院无批次号 ${input.batchNo}，回执留待人工核对，不写入任何工序。`;
  } else {
    const sameLot = batch.cardLot.trim() === input.cardLot.trim();
    const sameQty = Number(batch.quantity) === Number(input.quantity);
    const duplicated = findConfirmedDyeStep(
      batch,
      input.cardLot.trim(),
      Number(input.quantity)
    );

    if (sameLot && sameQty && duplicated) {
      status = "duplicate";
      detail = `批次 ${batch.id} 已确认过相同色卡批次 ${input.cardLot}、用量 ${input.quantity}，此为晚到的重复回执，忽略且不改写工序。`;
    } else if (sameLot && sameQty) {
      status = "matched";
      detail = `批次 ${batch.id} 对账一致（色卡批次 ${input.cardLot}、用量 ${input.quantity}），追加一条已确认工序，不动既有流水。`;
      applied = true;
      batches = batches.map((b) =>
        b.id === batch.id
          ? {
              ...b,
              outsourced: true,
              history: [
                ...b.history,
                {
                  id: uid("ev"),
                  at: arrivedAt,
                  step: `外协染线确认：色卡批次 ${input.cardLot} / 用量 ${input.quantity}`,
                  by: input.workshop,
                  confirmed: true,
                },
              ],
            }
          : b
      );
    } else {
      status = "mismatch";
      const diffs: string[] = [];
      if (!sameLot)
        diffs.push(`色卡批次 本院=${batch.cardLot} / 回执=${input.cardLot}`);
      if (!sameQty)
        diffs.push(`用量 本院=${batch.quantity} / 回执=${input.quantity}`);
      detail = `批次 ${batch.id} ${diffs.join("；")}。不一致，留待处理，不写入工序、不改状态。`;
    }
  }

  const receipt: Receipt = {
    id: uid("rcp"),
    batchNo: input.batchNo.trim(),
    cardLot: input.cardLot.trim(),
    quantity: Number(input.quantity),
    arrivedAt,
    workshop: input.workshop,
    status,
    detail,
    applied,
  };

  return {
    state: { ...state, batches, receipts: [receipt, ...state.receipts] },
    receipt,
  };
}

/** 人工裁决留待处理回执：采纳（按回执更正并追加确认）或驳回 */
export function resolveReceipt(
  state: AppState,
  receiptId: string,
  action: "accept" | "reject"
): AppState {
  const rcp = state.receipts.find((r) => r.id === receiptId);
  if (!rcp) return state;
  if (rcp.status !== "mismatch" && rcp.status !== "unknown") return state;

  if (action === "reject") {
    return {
      ...state,
      receipts: state.receipts.map((r) =>
        r.id === receiptId
          ? {
              ...r,
              status: "duplicate" as ReceiptStatus,
              detail: r.detail + "【人工驳回】回执作废，不影响本院记录。",
            }
          : r
      ),
    };
  }

  // accept：仅对本院存在的批次生效；以回执为准修正色卡批次/用量并追加确认，
  // 仍然不删除/改写任何既有已确认工序。
  const batch = state.batches.find((b) => b.id === rcp.batchNo);
  if (!batch) return state;

  return {
    ...state,
    batches: state.batches.map((b) =>
      b.id === batch.id
        ? {
            ...b,
            cardLot: rcp.cardLot,
            quantity: rcp.quantity,
            history: [
              ...b.history,
              {
                id: uid("ev"),
                at: nowStamp(),
                step: `人工采纳外协回执：色卡批次 ${rcp.cardLot} / 用量 ${rcp.quantity}`,
                by: "排产台人工裁决",
                confirmed: true,
              },
            ],
          }
        : b
    ),
    receipts: state.receipts.map((r) =>
      r.id === receiptId
        ? {
            ...r,
            status: "matched" as ReceiptStatus,
            applied: true,
            detail:
              r.detail + "【人工采纳】已按回执更正并追加确认，既有工序保留。",
          }
        : r
    ),
  };
}
