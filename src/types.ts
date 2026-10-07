// 排产台核心数据模型

export type Urgency = "特急" | "加急" | "普通";

export type BatchStatus =
  | "待分配" // 排队 / 未占位
  | "已占位" // 已排上槽位，未开始染色
  | "染机上" // 正在染色
  | "已完工" // 染色完成，待入库
  | "已入库"; // 已入库

export type SlotStatus = "运行中" | "维护中" | "停机";

export type ReceiptStatus = "待对账" | "已对账" | "待处理" | "迟到";

export type BatchSource = "馆藏借展" | "私人订单" | "外协";

/** 纹样档案 */
export interface Pattern {
  id: string; // 纹样编号 PAT-xxx
  name: string; // 名称
  origin: string; // 产地
  era: string; // 年代
  knotDensity: string; // 结密度
  material: string; // 材质
  dyeType: string; // 染色类型
  damageArea: string; // 破损区域
  threadColor: string; // 补线颜色
  process: string; // 修复工序
  beforeNote?: string; // 修复前记录
  afterNote?: string; // 修复后记录
  createdAt: number;
  legacy?: boolean; // 旧数据
}

/** 材料色卡 */
export interface ColorCard {
  id: string; // 色卡号 COL-xxx
  name: string; // 色名
  hex: string; // 颜色值
  batch: string; // 色卡批次
  material: string; // 适用材质
  stockKg: number; // 库存量(kg)
  unit: string;
}

/** 染槽槽位 */
export interface DyeSlot {
  id: string; // 槽位号 VAT-xx
  name: string;
  capacityKg: number; // 单槽容量(kg)
  status: SlotStatus;
  location: string;
}

/** 修复批次 */
export interface RepairBatch {
  id: string; // 批次号 BAT-xxxx
  patternId: string; // 关联纹样档案
  colorCardId: string; // 关联材料色卡
  colorCardBatch: string; // 色卡批次(快照, 对账依据)
  usageKg: number; // 色料用量(kg, 对账依据)
  weightKg: number; // 织物重量(kg)
  days: number; // 染色占用天数
  urgency: Urgency; // 加急等级
  dueDate: string | null; // 交期 YYYY-MM-DD（旧数据可能缺失）
  source: BatchSource; // 来源
  slotId: string | null; // 槽位号（旧数据可能缺失）
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  status: BatchStatus;
  outsourced: boolean; // 是否外协
  workshop: string | null; // 外协工坊
  confirmed: boolean; // 工序是否已确认
  legacy: boolean; // 旧数据(缺交期/槽位)
  createdAt: number;
  note?: string;
}

/** 外协工坊回执 */
export interface Receipt {
  id: string; // 回执号 REC-xxxx
  batchId: string; // 对应批次号
  workshop: string; // 外协工坊
  arrivedAt: number; // 到件时间
  colorCardBatch: string; // 回执色卡批次
  usageKg: number; // 回执用量(kg)
  status: ReceiptStatus;
  reason?: string; // 待处理 / 迟到 原因
  duplicateOf?: string; // 重复的原回执号
  reconciledAt?: number;
}

export interface LogEntry {
  id: string;
  at: number;
  kind: "schedule" | "machine" | "receipt" | "legacy" | "system";
  text: string;
}
