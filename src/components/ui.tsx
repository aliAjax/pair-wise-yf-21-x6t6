// 通用展示组件
import type { BatchStatus, SlotStatus, Urgency } from "../types";

const urgencyColor: Record<Urgency, string> = {
  特急: "#b91c1c",
  加急: "#b45309",
  普通: "#0f766e",
};

const batchStatusColor: Record<BatchStatus, string> = {
  待分配: "#64748b",
  已占位: "#2563eb",
  染机上: "#b45309",
  已完工: "#0f766e",
  已入库: "#475569",
};

const slotStatusColor: Record<SlotStatus, string> = {
  运行中: "#0f766e",
  维护中: "#b45309",
  停机: "#b91c1c",
};

export function UrgencyTag({ value }: { value: Urgency }) {
  return (
    <span
      className="tag"
      style={{
        color: urgencyColor[value],
        background: `${urgencyColor[value]}14`,
        borderColor: `${urgencyColor[value]}44`,
      }}
    >
      {value}
    </span>
  );
}

export function BatchStatusTag({ value }: { value: BatchStatus }) {
  return (
    <span
      className="tag"
      style={{
        color: batchStatusColor[value],
        background: `${batchStatusColor[value]}14`,
        borderColor: `${batchStatusColor[value]}44`,
      }}
    >
      {value}
    </span>
  );
}

export function SlotStatusTag({ value }: { value: SlotStatus }) {
  return (
    <span
      className="tag"
      style={{
        color: slotStatusColor[value],
        background: `${slotStatusColor[value]}14`,
        borderColor: `${slotStatusColor[value]}44`,
      }}
    >
      {value}
    </span>
  );
}

export function LegacyTag() {
  return (
    <span className="tag" style={{ color: "#7c3aed", background: "#7c3aed14", borderColor: "#7c3aed44" }}>
      旧档
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
