import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppState, AuditLog, Batch, LoanKind, Priority } from "./types";
import { buildSeedState } from "./lib/seed";
import {
  replan,
  scheduleQueued,
  applyDowntime,
} from "./lib/scheduler";
import { reconcileReceipt, resolveReceipt } from "./lib/reconcile";
import { uid, nowStamp } from "./lib/date";

const STORAGE_KEY = "dye-bench-state-v1";

function loadInitial(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      // 旧版本数据兜底：缺字段补默认，保证旧记录仍能打开
      if (parsed && Array.isArray(parsed.batches) && Array.isArray(parsed.slots)) {
        return {
          ...buildSeedState(),
          ...parsed,
          cards: parsed.cards ?? [],
          archives: parsed.archives ?? [],
          slots: parsed.slots,
          batches: parsed.batches,
          receipts: parsed.receipts ?? [],
          logs: parsed.logs ?? [],
        };
      }
    }
  } catch {
    // 解析失败则回到种子数据
  }
  return buildSeedState();
}

function log(state: AppState, message: string): AuditLog[] {
  return [
    { id: uid("log"), at: nowStamp(), message },
    ...state.logs,
  ].slice(0, 200);
}

export interface NewBatchInput {
  archiveId: string;
  cardId: string;
  cardLot: string;
  quantity: number;
  loanKind: LoanKind;
  priority: Priority;
  dueDay: number;
  duration: number;
  outsourced: boolean;
  note?: string;
}

export function useStore() {
  const [state, setState] = useState<AppState>(loadInitial);
  const [notice, setNotice] = useState<string>("");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 存储不可用时静默（隐私模式等）
    }
  }, [state]);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(""), 3200);
  }, []);

  /** 全量重排（按加急顺序重新抢占） */
  const replanAll = useCallback(() => {
    setState((s) => {
      const res = replan(s);
      const queueMsg = res.queue.length
        ? `，${res.queue.length} 单容量不足/无槽位继续排队`
        : "，无排队单";
      const next = {
        ...s,
        batches: res.batches,
        logs: log(s, `手动全量重排：按加急顺序重新占位${queueMsg}`),
      };
      queueMicrotask(() => flash(`已重新排产${queueMsg}`));
      return next;
    });
  }, [flash]);

  /** 尝试把排队单补进空位 */
  const fillQueue = useCallback(() => {
    setState((s) => {
      const res = scheduleQueued(s);
      const moved = res.batches.filter(
        (b, i) =>
          b.status === "scheduled" && s.batches[i].status === "queued"
      ).length;
      const next = {
        ...s,
        batches: res.batches,
        logs: log(
          s,
          `按剩余容量补位：${moved} 个排队单入槽，${res.queue.length} 单仍排队`
        ),
      };
      queueMicrotask(() => flash(`补位完成：${moved} 单入槽`));
      return next;
    });
  }, [flash]);

  /** 对某个槽设置/清除停机窗口后，触发顺延 */
  const setDowntime = useCallback(
    (slotId: string, from: number, to: number, reason: string) => {
      setState((s) => {
        const clamped: AppState = {
          ...s,
          slots: s.slots.map((sl) =>
            sl.id === slotId
              ? { ...sl, downtime: { from, to, reason } }
              : sl
          ),
        };
        const res = applyDowntime(clamped);
        const next = {
          ...clamped,
          batches: res.batches,
          logs: log(
            clamped,
            `染机停机：槽位 ${slotId} D${from}-D${to}（${reason}）。未开始批次释放并按剩余容量顺延，已开染/已染好批次不动；${res.queue.length} 单继续排队`
          ),
        };
        queueMicrotask(() =>
          flash(`槽位 ${slotId} 停机 D${from}-D${to}，已顺延重排`)
        );
        return next;
      });
    },
    [flash]
  );

  const clearDowntime = useCallback(
    (slotId: string) => {
      setState((s) => {
        const clamped: AppState = {
          ...s,
          slots: s.slots.map((sl) =>
            sl.id === slotId ? { ...sl, downtime: null } : sl
          ),
        };
        const res = applyDowntime(clamped);
        const next = {
          ...clamped,
          batches: res.batches,
          logs: log(
            clamped,
            `槽位 ${slotId} 维护结束恢复运行，释放批次重新按剩余容量顺延`
          ),
        };
        queueMicrotask(() => flash(`槽位 ${slotId} 已恢复，重新顺延`));
        return next;
      });
    },
    [flash]
  );

  /** 推进工序：已排产→在染→染好→入库（已确认的不可回退） */
  const advanceBatch = useCallback(
    (batchId: string) => {
      setState((s) => {
        const b = s.batches.find((x) => x.id === batchId);
        if (!b) return s;
        let next = s;
        const batches = s.batches.map((x): Batch => {
          if (x.id !== batchId) return x;
          if (x.status === "scheduled") {
            return {
              ...x,
              status: "in_progress",
              history: [
                ...x.history,
                {
                  id: uid("ev"),
                  at: nowStamp(),
                  step: `开染（槽位 ${x.slotId ?? "?"}）`,
                  by: "染工组",
                  confirmed: true,
                },
              ],
            };
          }
          if (x.status === "in_progress") {
            return {
              ...x,
              status: "dyed",
              history: [
                ...x.history,
                {
                  id: uid("ev"),
                  at: nowStamp(),
                  step: "染线完成，待入库",
                  by: "染工组",
                  confirmed: true,
                },
              ],
            };
          }
          if (x.status === "dyed") {
            return {
              ...x,
              status: "stored",
              history: [
                ...x.history,
                {
                  id: uid("ev"),
                  at: nowStamp(),
                  step: "入库登记（已染好，照旧入库）",
                  by: "库房",
                  confirmed: true,
                },
              ],
            };
          }
          return x;
        });
        next = { ...s, batches };
        // 在染后，其占用变为锁定；补位一次让排队单尝试填空
        if (b.status === "scheduled" || b.status === "dyed") {
          const res = scheduleQueued(next);
          next = { ...next, batches: res.batches };
        }
        next = {
          ...next,
          logs: log(
            next,
            `批次 ${batchId} 工序推进：${b.status} → ${
              next.batches.find((x) => x.id === batchId)?.status
            }`
          ),
        };
        return next;
      });
    },
    []
  );

  const addBatch = useCallback(
    (input: NewBatchInput) => {
      setState((s) => {
        const id =
          "B-2026-" +
          String(
            Math.max(
              0,
              ...s.batches
                .map((b) => Number(b.id.replace(/\D/g, "").slice(-2)))
                .filter((n) => !Number.isNaN(n))
            ) + 1
          ).padStart(2, "0");
        const batch: Batch = {
          id,
          archiveId: input.archiveId,
          cardId: input.cardId,
          cardLot: input.cardLot.trim(),
          quantity: input.quantity,
          loanKind: input.loanKind,
          priority: input.priority,
          dueDay: input.dueDay,
          status: "queued",
          slotId: null,
          startDay: null,
          duration: input.duration,
          occupancy: [],
          weightPerDay: input.quantity,
          source: "new",
          outsourced: input.outsourced,
          note: input.note,
          history: [
            {
              id: uid("ev"),
              at: nowStamp(),
              step: "新建修复批次，进入待排队列",
              by: "排产台",
              confirmed: true,
            },
          ],
        };
        const withBatch: AppState = {
          ...s,
          batches: [...s.batches, batch],
        };
        // 新单进入后按加急补位（不打断已占位批次）
        const res = scheduleQueued(withBatch);
        const placed = res.batches.find((b) => b.id === id);
        return {
          ...withBatch,
          batches: res.batches,
          logs: log(
            withBatch,
            `新增批次 ${id}（${input.priority === "urgent" ? "加急" : "普通"}，交期 D${input.dueDay}）：${
              placed?.status === "scheduled"
                ? `已占位 ${placed.slotId}@D${placed.startDay}`
                : "容量/槽位不足，保留交期排队"
            }`
          ),
        };
      });
      flash("批次已加入排产");
    },
    [flash]
  );

  /** 收到外协回执：按批次号对账 */
  const receiveReceipt = useCallback(
    (input: {
      batchNo: string;
      cardLot: string;
      quantity: number;
      workshop: string;
    }) => {
      setState((s) => {
        const res = reconcileReceipt(s, input);
        const tone =
          res.receipt.status === "matched"
            ? "一致，追加确认工序"
            : res.receipt.status === "duplicate"
            ? "重复回执，忽略"
            : "留待处理";
        return {
          ...res.state,
          logs: log(
            res.state,
            `外协回执对账（${input.workshop} / ${input.batchNo}）：${tone}。${res.receipt.detail}`
          ),
        };
      });
      flash("回执已按批次号对账");
    },
    [flash]
  );

  const adjudicateReceipt = useCallback(
    (receiptId: string, action: "accept" | "reject") => {
      setState((s) => {
        const next = resolveReceipt(s, receiptId, action);
        return {
          ...next,
          logs: log(
            next,
            `留待回执人工${action === "accept" ? "采纳" : "驳回"}（${receiptId}）：已确认工序不被改写`
          ),
        };
      });
      flash(action === "accept" ? "已采纳并更正" : "已驳回");
    },
    [flash]
  );

  const resetAll = useCallback(() => {
    const fresh = buildSeedState();
    setState(fresh);
    flash("已重置为演示初始数据");
  }, [flash]);

  const stats = useMemo(() => {
    const byStatus = (st: Batch["status"]) =>
      state.batches.filter((b) => b.status === st).length;
    const pendingReceipts = state.receipts.filter(
      (r) => r.status === "mismatch" || r.status === "unknown"
    ).length;
    const overdue = state.batches.filter(
      (b) =>
        b.status === "queued" ||
        (b.status === "scheduled" &&
          b.startDay !== null &&
          b.startDay + b.duration - 1 > b.dueDay)
    ).length;
    return {
      queued: byStatus("queued"),
      scheduled: byStatus("scheduled"),
      inProgress: byStatus("in_progress"),
      stored: byStatus("dyed") + byStatus("stored"),
      pendingReceipts,
      overdue,
      total: state.batches.length,
    };
  }, [state]);

  return {
    state,
    notice,
    stats,
    replanAll,
    fillQueue,
    setDowntime,
    clearDowntime,
    advanceBatch,
    addBatch,
    receiveReceipt,
    adjudicateReceipt,
    resetAll,
  };
}
