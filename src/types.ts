// 染线排产台：领域模型
// 把「纹样档案 / 修复批次 / 材料色卡 / 槽位」四类记录通过批次串起来。

export type LoanKind = "loan" | "private"; // 馆藏借展 / 私人订单
export type Priority = "urgent" | "normal"; // 加急 / 普通
export type DyeType = "plant" | "mineral" | "chemical"; // 植物染 / 矿物染 / 化学染

/** 批次生命周期状态 */
export type BatchStatus =
  | "queued" // 排队待排（容量满时保留交期并排队）
  | "scheduled" // 已占槽、未开染
  | "in_progress" // 已开染（停机不释放）
  | "dyed" // 已染好待入库
  | "stored"; // 已入库（停机/重排均不可动）

export type PriorityScore = number;

/** 材料色卡 */
export interface ColorCard {
  id: string; // 色卡编号，如 CARD-INDIGO-03
  name: string; // 色名
  color: string; // 展示色
  dyeType: DyeType;
  recipe: string; // 配方
  unit: string; // 用量单位
  note?: string;
}

/** 纹样档案（修复对象） */
export interface CarpetArchive {
  id: string; // 档案号 CAR-xxx
  title: string;
  origin: string; // 产地
  era: string; // 年代
  knotDensity: number; // 结密度 结/平方英寸
  material: string; // 材质
  dyeType: DyeType; // 原染色类型
  damage: string; // 破损区域
  threadColorId: string; // 补线色卡 → ColorCard.id
}

/** 修复批次 */
export interface Batch {
  id: string; // 批次号，如 B-2026-01
  archiveId: string; // 修复对象 → CarpetArchive.id
  cardId: string; // 色卡编号 → ColorCard.id
  cardLot: string; // 色卡批次号（同一色卡批次常抢槽）
  quantity: number; // 染线用量
  loanKind: LoanKind;
  priority: Priority;
  dueDay: number; // 交期（相对排产基准日的第 N 天，0 = 基准日）
  status: BatchStatus;
  /** 已排产占用：slotId × day（容量单位：槽·日）。未开染时会被停机释放 */
  slotId: string | null;
  startDay: number | null;
  duration: number; // 占用时长（天）
  /** 同一槽位同一时段只容纳一个批次：记录占用的每一天 */
  occupancy: { slotId: string; day: number }[];
  weightPerDay: number; // 每占用单元的负载（用于槽位容量约束）
  source: "new" | "legacy"; // 旧数据升级标记
  history: ProcessEvent[]; // 工序流水（只增不改，外协回执不能改写已确认工序）
  outsourced?: boolean; // 外协工坊承担染线
  note?: string;
}

/** 工序流水事件：只增不改 */
export interface ProcessEvent {
  id: string;
  at: string; // ISO 时间戳
  step: string; // 工序名
  by: string; // 确认人/来源
  confirmed: boolean; // 是否已确认；已确认工序不允许被后到回执改写
}

/** 染线槽 */
export interface Slot {
  id: string; // 槽位号，如 T1
  name: string;
  dyeTypes: DyeType[]; // 该槽支持的染色类型
  capacityPerDay: number; // 每日容量（负载上限）
  /** 维护停机窗口（闭区间，相对基准日的天）。null 表示运行中 */
  downtime: { from: number; to: number; reason: string } | null;
}

export type ReceiptStatus =
  | "matched" // 对得上：批次号、色卡批次、用量全部一致
  | "duplicate" // 重复回执（晚到且与已确认内容相同）
  | "mismatch" // 色卡批次或用量不一致 → 留待处理
  | "unknown"; // 本院无此批次号 → 留待处理

/** 外协工坊回执 */
export interface Receipt {
  id: string;
  batchNo: string; // 回执上的批次号
  cardLot: string; // 回执上的色卡批次
  quantity: number; // 回执上的用量
  arrivedAt: string; // 到达时间
  workshop: string; // 来源工坊
  status: ReceiptStatus;
  detail: string; // 对账说明
  /** 是否曾写入工序（matched 时追加 confirmed 工序；重复/不一致不写入） */
  applied: boolean;
}

export interface AuditLog {
  id: string;
  at: string;
  message: string;
}

export interface AppState {
  version: number;
  baseDate: string; // 排产基准日 YYYY-MM-DD
  horizon: number; // 排产视野天数
  cards: ColorCard[];
  archives: CarpetArchive[];
  slots: Slot[];
  batches: Batch[];
  receipts: Receipt[];
  logs: AuditLog[];
}
