import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ColorCard,
  DyeSlot,
  LogEntry,
  Pattern,
  Receipt,
  RepairBatch,
  SlotStatus,
} from "./types";
import {
  seedBatches,
  seedCards,
  seedPatterns,
  seedReceipts,
  seedSlots,
} from "./seed";
import { releaseSlotAndReschedule, scheduleBatches } from "./scheduler";
import { reconcileReceipt as reconcileReceiptLogic } from "./reconcile";
import { nextId, todayStr } from "./utils";

const STORAGE_KEY = "dye-scheduler-v1";

interface PersistShape {
  patterns: Pattern[];
  cards: ColorCard[];
  slots: DyeSlot[];
  batches: RepairBatch[];
  receipts: Receipt[];
  logs: LogEntry[];
}

interface StoreCtx extends PersistShape {
  // 纹样 / 色卡 / 槽位
  addPattern: (p: Omit<Pattern, "id" | "createdAt"> & { id?: string }) => void;
  addCard: (c: Omit<ColorCard, "id"> & { id?: string }) => void;
  addSlot: (s: Omit<DyeSlot, "id"> & { id?: string }) => void;
  setSlotStatus: (slotId: string, status: SlotStatus) => void;
  // 批次
  addBatch: (b: Partial<RepairBatch>) => void;
  updateBatch: (id: string, patch: Partial<RepairBatch>) => void;
  runSchedule: () => void;
  startBatch: (id: string) => void;
  finishBatch: (id: string) => void;
  warehouseBatch: (id: string) => void;
  // 回执
  addReceipt: (r: Partial<Receipt>) => void;
  reconcileOne: (id: string) => void;
  reconcileAll: () => void;
  // 其它
  resetAll: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

function freshData(): PersistShape {
  return {
    patterns: seedPatterns(),
    cards: seedCards(),
    slots: seedSlots(),
    batches: seedBatches(),
    receipts: seedReceipts(),
    logs: [],
  };
}

/** 旧数据升级：缺交期/槽位 → 补成普通单 + 待分配，旧记录仍可打开 */
function migrateLegacy(data: PersistShape): PersistShape {
  let upgraded = 0;
  const batches = data.batches.map((b) => {
    const isLegacy =
      b.legacy === true || (b.dueDate == null && b.slotId == null);
    if (!isLegacy) return b;
    upgraded += 1;
    return {
      ...b,
      urgency: b.urgency ?? "普通",
      status:
        b.status === "染机上" || b.status === "已完工" || b.status === "已入库"
          ? b.status
          : "待分配",
      slotId: null,
      plannedStart: null,
      plannedEnd: null,
      dueDate: b.dueDate ?? null,
      legacy: true,
    };
  });
  const logs = [...data.logs];
  if (upgraded > 0) {
    logs.unshift({
      id: nextId("LOG"),
      at: Date.now(),
      kind: "legacy",
      text: `旧数据升级：${upgraded} 条缺交期/槽位的档案已补为普通单、状态置为待分配，原记录仍可打开。`,
    });
  }
  return { ...data, batches, logs };
}

function loadData(): PersistShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistShape;
      return migrateLegacy(parsed);
    }
  } catch {
    // ignore
  }
  return migrateLegacy(freshData());
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersistShape>(() => loadData());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }, [data]);

  const pushLog = useCallback(
    (kind: LogEntry["kind"], text: string): LogEntry => ({
      id: nextId("LOG"),
      at: Date.now(),
      kind,
      text,
    }),
    []
  );

  const addPattern: StoreCtx["addPattern"] = useCallback(
    (p) => {
      setData((d) => ({
        ...d,
        patterns: [
          ...d.patterns,
          {
            ...(p as Pattern),
            id: p.id ?? nextId("PAT"),
            createdAt: Date.now(),
          },
        ],
      }));
    },
    []
  );

  const addCard: StoreCtx["addCard"] = useCallback((c) => {
    setData((d) => ({
      ...d,
      cards: [...d.cards, { ...(c as ColorCard), id: c.id ?? nextId("COL") }],
    }));
  }, []);

  const addSlot: StoreCtx["addSlot"] = useCallback((s) => {
    setData((d) => ({
      ...d,
      slots: [...d.slots, { ...(s as DyeSlot), id: s.id ?? nextId("VAT") }],
    }));
  }, []);

  const setSlotStatus: StoreCtx["setSlotStatus"] = useCallback(
    (slotId, status) => {
      setData((d) => {
        const slot = d.slots.find((s) => s.id === slotId);
        const slots = d.slots.map((s) =>
          s.id === slotId ? { ...s, status } : s
        );
        let batches = d.batches;
        const logs = [...d.logs];
        if (status === "停机" || status === "维护中") {
          const res = releaseSlotAndReschedule(batches, slots, slotId);
          batches = res.batches;
          logs.unshift(
            pushLog(
              "machine",
              `${slot?.name ?? slotId} ${status}：${
                res.releasedIds.length
              } 个未开始批次释放占用，按剩余容量顺延重排。`
            )
          );
        } else {
          batches = scheduleBatches(batches, slots);
          logs.unshift(
            pushLog(
              "machine",
              `${slot?.name ?? slotId} 恢复运行，已按加急顺序重新占位。`
            )
          );
        }
        return { ...d, slots, batches, logs };
      });
    },
    [pushLog]
  );

  const addBatch: StoreCtx["addBatch"] = useCallback(
    (b) => {
      setData((d) => {
        const batch: RepairBatch = {
          id: b.id ?? nextId("BAT"),
          patternId: b.patternId ?? d.patterns[0]?.id ?? "",
          colorCardId: b.colorCardId ?? d.cards[0]?.id ?? "",
          colorCardBatch: b.colorCardBatch ?? d.cards[0]?.batch ?? "",
          usageKg: b.usageKg ?? 1,
          weightKg: b.weightKg ?? 10,
          days: b.days ?? 2,
          urgency: b.urgency ?? "普通",
          dueDate: b.dueDate ?? null,
          source: b.source ?? "私人订单",
          slotId: null,
          plannedStart: null,
          plannedEnd: null,
          actualStart: null,
          actualEnd: null,
          status: "待分配",
          outsourced: b.outsourced ?? false,
          workshop: b.workshop ?? null,
          confirmed: false,
          legacy: false,
          createdAt: Date.now(),
          note: b.note,
        };
        const batches = scheduleBatches([...d.batches, batch], d.slots);
        return {
          ...d,
          batches,
          logs: [
            pushLog(
              "schedule",
              `新增批次 ${batch.id}（${batch.urgency}），已按加急顺序占位/排队。`
            ),
            ...d.logs,
          ],
        };
      });
    },
    [pushLog]
  );

  const updateBatch: StoreCtx["updateBatch"] = useCallback((id, patch) => {
    setData((d) => ({
      ...d,
      batches: d.batches.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }, []);

  const runSchedule: StoreCtx["runSchedule"] = useCallback(() => {
    setData((d) => {
      const batches = scheduleBatches(d.batches, d.slots);
      return {
        ...d,
        batches,
        logs: [
          pushLog(
            "schedule",
            `自动排产完成：按加急顺序占位，容量满的批次保留交期继续排队。`
          ),
          ...d.logs,
        ],
      };
    });
  }, [pushLog]);

  const startBatch: StoreCtx["startBatch"] = useCallback(
    (id) => {
      setData((d) => ({
        ...d,
        batches: d.batches.map((b) =>
          b.id === id && b.status === "已占位"
            ? { ...b, status: "染机上", actualStart: todayStr() }
            : b
        ),
        logs: [
          pushLog("schedule", `批次 ${id} 开始染色（已上染机）。`),
          ...d.logs,
        ],
      }));
    },
    [pushLog]
  );

  const finishBatch: StoreCtx["finishBatch"] = useCallback(
    (id) => {
      setData((d) => ({
        ...d,
        batches: d.batches.map((b) =>
          b.id === id && b.status === "染机上"
            ? { ...b, status: "已完工", actualEnd: todayStr() }
            : b
        ),
        logs: [
          pushLog("schedule", `批次 ${id} 染色完工，待入库。`),
          ...d.logs,
        ],
      }));
    },
    [pushLog]
  );

  const warehouseBatch: StoreCtx["warehouseBatch"] = useCallback(
    (id) => {
      setData((d) => ({
        ...d,
        batches: d.batches.map((b) =>
          b.id === id && b.status === "已完工"
            ? { ...b, status: "已入库" }
            : b
        ),
        logs: [
          pushLog("schedule", `批次 ${id} 已完工入库（已染好的照旧入库）。`),
          ...d.logs,
        ],
      }));
    },
    [pushLog]
  );

  const addReceipt: StoreCtx["addReceipt"] = useCallback(
    (r) => {
      setData((d) => ({
        ...d,
        receipts: [
          {
            id: nextId("REC"),
            batchId: r.batchId ?? d.batches[0]?.id ?? "",
            workshop: r.workshop ?? "云染坊",
            arrivedAt: Date.now(),
            colorCardBatch: r.colorCardBatch ?? "",
            usageKg: r.usageKg ?? 0,
            status: "待对账",
          },
          ...d.receipts,
        ],
        logs: [
          pushLog("receipt", `收到外协回执（${r.workshop}），待对账。`),
          ...d.logs,
        ],
      }));
    },
    [pushLog]
  );

  const reconcileOne: StoreCtx["reconcileOne"] = useCallback(
    (id) => {
      setData((d) => {
        const target = d.receipts.find((r) => r.id === id);
        if (!target) return d;
        const result = reconcileReceiptLogic(
          target,
          d.batches,
          d.receipts,
          Date.now()
        );
        const receipts = d.receipts.map((r) =>
          r.id === id ? result.receipt : r
        );
        let batches = d.batches;
        if (result.ok && result.patch) {
          batches = batches.map((b) =>
            b.id === target.batchId ? { ...b, ...result.patch } : b
          );
        }
        return {
          ...d,
          receipts,
          batches,
          logs: [
            pushLog(
              "receipt",
              result.ok
                ? `回执 ${id} 对账通过：批次 ${target.batchId} 工序已确认。`
                : `回执 ${id} 对账未通过：${result.receipt.reason ?? "留待处理"}`
            ),
            ...d.logs,
          ],
        };
      });
    },
    [pushLog]
  );

  const reconcileAll: StoreCtx["reconcileAll"] = useCallback(() => {
    setData((d) => {
      let batches = d.batches;
      const receipts = d.receipts.map((r) => {
        if (r.status !== "待对账") return r;
        const result = reconcileReceiptLogic(r, batches, d.receipts, Date.now());
        if (result.ok && result.patch) {
          batches = batches.map((b) =>
            b.id === r.batchId ? { ...b, ...result.patch } : b
          );
        }
        return result.receipt;
      });
      const passed = receipts.filter(
        (r) => r.status === "已对账" && !d.receipts.find((x) => x.id === r.id && x.status === "已对账")
      ).length;
      return {
        ...d,
        batches,
        receipts,
        logs: [
          pushLog("receipt", `批量对账完成：${passed} 份回执通过，其余留待处理/迟到留存。`),
          ...d.logs,
        ],
      };
    });
  }, [pushLog]);

  const resetAll: StoreCtx["resetAll"] = useCallback(() => {
    const fresh = freshData();
    fresh.logs = [
      {
        id: nextId("LOG"),
        at: Date.now(),
        kind: "system",
        text: "已重置为演示数据。",
      },
    ];
    setData(fresh);
  }, []);

  const value = useMemo<StoreCtx>(
    () => ({
      ...data,
      addPattern,
      addCard,
      addSlot,
      setSlotStatus,
      addBatch,
      updateBatch,
      runSchedule,
      startBatch,
      finishBatch,
      warehouseBatch,
      addReceipt,
      reconcileOne,
      reconcileAll,
      resetAll,
    }),
    [
      data,
      addPattern,
      addCard,
      addSlot,
      setSlotStatus,
      addBatch,
      updateBatch,
      runSchedule,
      startBatch,
      finishBatch,
      warehouseBatch,
      addReceipt,
      reconcileOne,
      reconcileAll,
      resetAll,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
