// 演示数据：几家修复工坊共用染线槽的真实场景
// 馆藏借展(loan)与私人订单(private)会为同一色卡批次抢槽。

import type {
  AppState,
  Batch,
  CarpetArchive,
  ColorCard,
  Slot,
} from "../types";
import { migrateLegacyBatches, type LegacyBatchRow } from "./migrate";
import { replan } from "./scheduler";
import { reconcileReceipt } from "./reconcile";
import { BASE_DATE, uid, nowStamp } from "./date";

export const cards: ColorCard[] = [
  {
    id: "CARD-INDIGO-03",
    name: "靛蓝",
    color: "#1e3a8a",
    dyeType: "plant",
    recipe: "板蓝根发酵，三浸三晾",
    unit: "绞",
    note: "馆藏最常借展色，多家工坊抢 LOT-IND-2609",
  },
  {
    id: "CARD-POMEGRANATE-07",
    name: "石榴皮黄",
    color: "#b45309",
    dyeType: "plant",
    recipe: "石榴皮+铁媒染",
    unit: "绞",
  },
  {
    id: "CARD-COCHINEAL-12",
    name: "胭脂虫红",
    color: "#9f1239",
    dyeType: "plant",
    recipe: "胭脂虫+明矾媒染",
    unit: "绞",
  },
  {
    id: "CARD-WALNUT-05",
    name: "核桃棕",
    color: "#57391e",
    dyeType: "plant",
    recipe: "核桃外皮煮染",
    unit: "绞",
  },
  {
    id: "CARD-LAPIS-02",
    name: "青金石蓝",
    color: "#0f4b6e",
    dyeType: "mineral",
    recipe: "青金石粉+胶，低温入槽",
    unit: "绞",
  },
  {
    id: "CARD-CHROME-18",
    name: "铬绿",
    color: "#3f6212",
    dyeType: "chemical",
    recipe: "酸性媒介染料，专用槽",
    unit: "绞",
  },
];

export const archives: CarpetArchive[] = [
  {
    id: "CAR-092",
    title: "波斯缠枝纹地毯",
    origin: "波斯",
    era: "约1960s",
    knotDensity: 180,
    material: "羊毛",
    dyeType: "plant",
    damage: "边缘磨损，待补线",
    threadColorId: "CARD-INDIGO-03",
  },
  {
    id: "CAR-117",
    title: "安纳托利亚中心徽章毯",
    origin: "安纳托利亚",
    era: "19世纪末",
    knotDensity: 42,
    material: "羊毛",
    dyeType: "plant",
    damage: "中心纹样缺口",
    threadColorId: "CARD-COCHINEAL-12",
  },
  {
    id: "CAR-138",
    title: "藏毯蓝龙纹",
    origin: "藏毯",
    era: "清代",
    knotDensity: 96,
    material: "羊毛",
    dyeType: "mineral",
    damage: "局部褪色，需匹配靛蓝色卡",
    threadColorId: "CARD-LAPIS-02",
  },
  {
    id: "CAR-144",
    title: "高加索几何纹毯",
    origin: "高加索",
    era: "1920s",
    knotDensity: 150,
    material: "羊毛",
    dyeType: "plant",
    damage: "边角虫蛀",
    threadColorId: "CARD-POMEGRANATE-07",
  },
  {
    id: "CAR-160",
    title: "波斯狩猎图毯",
    origin: "波斯",
    era: "19世纪",
    knotDensity: 220,
    material: "羊毛丝经",
    dyeType: "plant",
    damage: "主纹褪色",
    threadColorId: "CARD-WALNUT-05",
  },
  {
    id: "CAR-201",
    title: "土库曼部落地毯",
    origin: "高加索",
    era: "1970s",
    knotDensity: 130,
    material: "羊毛",
    dyeType: "chemical",
    damage: "边穗磨损",
    threadColorId: "CARD-CHROME-18",
  },
  {
    id: "CAR-212",
    title: "安纳托利亚祈祷毯",
    origin: "安纳托利亚",
    era: "18世纪",
    knotDensity: 200,
    material: "羊毛",
    dyeType: "plant",
    damage: "米哈拉布拱尖褪色",
    threadColorId: "CARD-INDIGO-03",
  },
];

export const slots: Slot[] = [
  {
    id: "T1",
    name: "一号公用大染槽",
    dyeTypes: ["plant", "mineral", "chemical"],
    capacityPerDay: 60,
    downtime: null,
  },
  {
    id: "T2",
    name: "二号植物染专用槽",
    dyeTypes: ["plant"],
    capacityPerDay: 40,
    downtime: null,
  },
  {
    id: "T3",
    name: "三号矿物染槽",
    dyeTypes: ["mineral"],
    capacityPerDay: 30,
    downtime: null,
  },
  {
    id: "T4",
    name: "四号化学染槽",
    dyeTypes: ["chemical"],
    capacityPerDay: 45,
    downtime: null,
  },
];

type BatchSeed = Partial<Batch> & {
  id: string;
  archiveId: string;
  cardId: string;
  cardLot: string;
  quantity: number;
  loanKind: Batch["loanKind"];
  priority: Batch["priority"];
  dueDay: number;
};

function makeBatch(seed: BatchSeed): Batch {
  const duration = seed.duration ?? 1;
  return {
    status: "queued",
    slotId: null,
    startDay: null,
    occupancy: [],
    duration,
    weightPerDay: seed.quantity,
    source: "new",
    history: [],
    ...seed,
  } as Batch;
}

// 锁定批次：一个在染、一个已入库 —— 停机后这两条都不能被挪动
const lockedBatches: Batch[] = [
  {
    ...makeBatch({
      id: "B-2026-00",
      archiveId: "CAR-138",
      cardId: "CARD-LAPIS-02",
      cardLot: "LOT-LAP-2608",
      quantity: 18,
      loanKind: "loan",
      priority: "normal",
      dueDay: 1,
    }),
    status: "in_progress",
    slotId: "T3",
    startDay: 0,
    occupancy: [{ slotId: "T3", day: 0 }],
    history: [
      {
        id: uid("ev"),
        at: BASE_DATE + "T08:10:00",
        step: "开染（三号矿物染槽）",
        by: "本院染工组",
        confirmed: true,
      },
    ],
  },
  {
    ...makeBatch({
      id: "B-2025-88",
      archiveId: "CAR-092",
      cardId: "CARD-INDIGO-03",
      cardLot: "LOT-IND-2598",
      quantity: 20,
      loanKind: "loan",
      priority: "urgent",
      dueDay: 0,
    }),
    status: "stored",
    slotId: "T1",
    startDay: 0,
    occupancy: [{ slotId: "T1", day: 0 }],
    history: [
      {
        id: uid("ev"),
        at: "2026-10-05T15:00:00",
        step: "外协染线确认：色卡批次 LOT-IND-2598 / 用量 20",
        by: "青格达染坊",
        confirmed: true,
      },
      {
        id: uid("ev"),
        at: "2026-10-06T10:00:00",
        step: "入库登记",
        by: "本院库房",
        confirmed: true,
      },
    ],
  },
];

const newBatches: Batch[] = [
  // 加急：两张馆藏借展 + 一张化学染
  ["B-2026-01", "CAR-092", "CARD-INDIGO-03", "LOT-IND-2609", 30, "loan", "urgent", 1],
  ["B-2026-02", "CAR-117", "CARD-COCHINEAL-12", "LOT-COC-2610", 25, "loan", "urgent", 1],
  ["B-2026-03", "CAR-138", "CARD-LAPIS-02", "LOT-LAP-2608", 20, "loan", "urgent", 2],
  ["B-2026-06", "CAR-201", "CARD-CHROME-18", "LOT-CHR-2605", 35, "loan", "urgent", 2],
  // 普通单（含同色卡批次抢槽、跨两天的长槽批、超大负载批）
  ["B-2026-04", "CAR-144", "CARD-POMEGRANATE-07", "LOT-POM-2611", 18, "loan", "normal", 2],
  ["B-2026-05", "CAR-160", "CARD-WALNUT-05", "LOT-WAL-2607", 22, "private", "normal", 3],
  ["B-2026-07", "CAR-212", "CARD-INDIGO-03", "LOT-IND-2609", 28, "private", "normal", 3],
  ["B-2026-08", "CAR-092", "CARD-WALNUT-05", "LOT-WALNUT-2607", 20, "private", "normal", 4, 2],
  ["B-2026-09", "CAR-117", "CARD-POMEGRANATE-07", "LOT-POM-2611", 15, "loan", "normal", 4],
  ["B-2026-10", "CAR-144", "CARD-COCHINEAL-12", "LOT-COC-2610", 24, "private", "normal", 5],
  ["B-2026-11", "CAR-160", "CARD-CHROME-18", "LOT-CHR-2605", 40, "private", "normal", 5],
  // 超大负载：超过所有槽位单日容量 → 必然排队，交期保留
  ["B-2026-12", "CAR-138", "CARD-LAPIS-02", "LOT-LAP-2608", 65, "private", "normal", 5],
].map((row) =>
  makeBatch({
    id: row[0] as string,
    archiveId: row[1] as string,
    cardId: row[2] as string,
    cardLot: row[3] as string,
    quantity: row[4] as number,
    loanKind: row[5] as Batch["loanKind"],
    priority: row[6] as Batch["priority"],
    dueDay: row[7] as number,
    duration: (row[8] as number | undefined) ?? 1,
  })
);

// 旧系统导出：缺交期/缺槽位号
export const legacyRows: LegacyBatchRow[] = [
  {
    id: "OLD-77",
    archiveId: "CAR-092",
    cardId: "CARD-INDIGO-03",
    cardLot: "LOT-IND-OLD",
    quantity: 12,
    loanKind: "private",
    note: "2019年旧账本誊抄，交期与槽位均缺失",
  },
  {
    id: "OLD-78",
    archiveId: "CAR-144",
    cardId: "CARD-POMEGRANATE-07",
    cardLot: "LOT-POM-OLD",
    quantity: 10,
    loanKind: "loan",
    priority: "urgent",
    dueDay: 3, // 有交期但仍缺槽位号
    note: "旧系统只登记了交期，未登记槽位",
  },
];

// 晚到的外协回执（初始即投递，跑一遍对账引擎得出真实状态）
const incomingReceipts = [
  {
    batchNo: "B-2026-07",
    cardLot: "LOT-IND-2609",
    quantity: 28,
    workshop: "青格达染坊",
    arrivedAt: BASE_DATE + "T08:40:00",
  },
  {
    // 晚到的重复回执：B-2025-88 已确认过相同内容
    batchNo: "B-2025-88",
    cardLot: "LOT-IND-2598",
    quantity: 20,
    workshop: "青格达染坊",
    arrivedAt: BASE_DATE + "T08:55:00",
  },
  {
    // 色卡批次不一致
    batchNo: "B-2026-01",
    cardLot: "LOT-IND-2699",
    quantity: 30,
    workshop: "和田染线社",
    arrivedAt: BASE_DATE + "T08:58:00",
  },
  {
    // 用量不一致
    batchNo: "B-2026-04",
    cardLot: "LOT-POM-2611",
    quantity: 28,
    workshop: "和田染线社",
    arrivedAt: BASE_DATE + "T09:02:00",
  },
  {
    // 本院查无批次
    batchNo: "B-2099-00",
    cardLot: "LOT-X-1",
    quantity: 9,
    workshop: "喀什外协点",
    arrivedAt: BASE_DATE + "T09:05:00",
  },
];

export function buildSeedState(): AppState {
  const HORIZON = 10;
  let state: AppState = {
    version: 1,
    baseDate: BASE_DATE,
    horizon: HORIZON,
    cards,
    archives,
    slots,
    batches: [...lockedBatches, ...newBatches],
    receipts: [],
    logs: [
      {
        id: uid("log"),
        at: nowStamp(),
        message: "排产台初始化：载入纹样档案、色卡、槽位与在产批次",
      },
    ],
  };

  // 1) 旧数据升级
  const migrated = migrateLegacyBatches(legacyRows, state);
  state = {
    ...state,
    batches: migrated.batches,
    logs: [
      {
        id: uid("log"),
        at: nowStamp(),
        message: `旧档案升级 ${migrated.report.total} 条：缺交期 ${migrated.report.filledDue.length} 条补为普通单，缺槽位 ${migrated.report.unassigned.length} 条待分配，旧记录照常可打开`,
      },
      ...state.logs,
    ],
  };

  // 2) 首版排产：锁定在产/入库批次，其余按加急顺序占位，满则排队
  const planned = replan(state);
  state = {
    ...state,
    batches: planned.batches,
    logs: [
      {
        id: uid("log"),
        at: nowStamp(),
        message: `首版排产完成：${planned.queue.length} 个批次容量不足/无槽位，已保留交期排队`,
      },
      ...state.logs,
    ],
  };

  // 3) 外协回执逐条对账
  for (const r of incomingReceipts) {
    const res = reconcileReceipt(state, r);
    state = {
      ...res.state,
      logs: [
        {
          id: uid("log"),
          at: r.arrivedAt,
          message: `收到 ${r.workshop} 回执（批次 ${r.batchNo}）：${
            res.receipt.status === "matched"
              ? "一致，已追加确认工序"
              : res.receipt.status === "duplicate"
              ? "重复回执，已忽略"
              : res.receipt.status === "mismatch"
              ? "色卡批次/用量不一致，留待处理"
              : "查无此批次，留待处理"
          }`,
        },
        ...state.logs,
      ],
    };
  }

  return state;
}
