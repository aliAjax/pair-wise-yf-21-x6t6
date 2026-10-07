import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { DyeSlot, RepairBatch } from "../types";
import { addDays, daysBetween, fmtDate, todayStr } from "../utils";
import { BatchStatusTag, LegacyTag, SlotStatusTag, UrgencyTag } from "./ui";

const COLS = 16;
const COL_W = 54;
const ROW_H = 62;
const today = todayStr();

const urgencyBar: Record<string, string> = {
  特急: "#b91c1c",
  加急: "#b45309",
  普通: "#0f766e",
};

function barGeometry(b: RepairBatch) {
  if (!b.plannedStart || !b.plannedEnd) return null;
  const winEnd = addDays(today, COLS);
  const vStart = b.plannedStart < today ? today : b.plannedStart;
  const vEnd = b.plannedEnd > winEnd ? winEnd : b.plannedEnd;
  if (vStart >= vEnd) return null;
  const offset = daysBetween(today, vStart);
  const span = daysBetween(vStart, vEnd);
  return { left: offset * COL_W, width: Math.max(span * COL_W - 2, 28) };
}

function BatchBar({
  b,
  selected,
  onSelect,
}: {
  b: RepairBatch;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const geo = barGeometry(b);
  if (!geo) return null;
  return (
    <button
      className={`gantt-bar ${selected ? "selected" : ""}`}
      style={{
        left: geo.left,
        width: geo.width,
        background: urgencyBar[b.urgency],
      }}
      onClick={() => onSelect(b.id)}
      title={`${b.id} · ${b.urgency} · ${b.status}`}
    >
      <span className="bar-id">{b.id}</span>
      <span className="bar-sub">
        {fmtDate(b.plannedStart)}–{fmtDate(b.plannedEnd)}
      </span>
    </button>
  );
}

function SlotRow({
  slot,
  batches,
  selectedId,
  onSelect,
}: {
  slot: DyeSlot;
  batches: RepairBatch[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { setSlotStatus } = useStore();
  const slotBatches = batches.filter(
    (b) => b.slotId === slot.id && (b.status === "已占位" || b.status === "染机上")
  );
  return (
    <div className="gantt-row">
      <div className="gantt-slot">
        <div className="slot-name">
          <strong>{slot.name}</strong>
          <SlotStatusTag value={slot.status} />
        </div>
        <div className="slot-meta">
          {slot.id} · {slot.capacityKg}kg · {slot.location}
        </div>
        <div className="slot-actions">
          {slot.status === "运行中" ? (
            <>
              <button
                className="mini"
                onClick={() => setSlotStatus(slot.id, "维护中")}
              >
                维护
              </button>
              <button
                className="mini danger"
                onClick={() => setSlotStatus(slot.id, "停机")}
              >
                停机
              </button>
            </>
          ) : (
            <button
              className="mini primary"
              onClick={() => setSlotStatus(slot.id, "运行中")}
            >
              恢复运行
            </button>
          )}
        </div>
      </div>
      <div className="gantt-track" style={{ height: ROW_H }}>
        <div className="gantt-grid">
          {Array.from({ length: COLS }, (_, i) => (
            <div
              key={i}
              className={`gantt-col ${i === 0 ? "today" : ""}`}
              style={{ width: COL_W }}
            >
              <span>{i === 0 ? "今天" : fmtDate(addDays(today, i))}</span>
            </div>
          ))}
        </div>
        {slotBatches.map((b) => (
          <BatchBar
            key={b.id}
            b={b}
            selected={selectedId === b.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function BatchDetail({
  batch,
  onClose,
}: {
  batch: RepairBatch;
  onClose: () => void;
}) {
  const {
    patterns,
    cards,
    startBatch,
    finishBatch,
    warehouseBatch,
  } = useStore();
  const pattern = patterns.find((p) => p.id === batch.patternId);
  const card = cards.find((c) => c.id === batch.colorCardId);
  return (
    <aside className="detail-drawer">
      <div className="drawer-head">
        <div>
          <p>批次详情</p>
          <h3>
            {batch.id} <UrgencyTag value={batch.urgency} />{" "}
            <BatchStatusTag value={batch.status} />
            {batch.legacy && <LegacyTag />}
          </h3>
        </div>
        <button className="mini" onClick={onClose}>
          关闭
        </button>
      </div>
      <dl className="detail-list">
        <div>
          <dt>纹样档案</dt>
          <dd>
            {pattern?.id} · {pattern?.name}
          </dd>
        </div>
        <div>
          <dt>材料色卡</dt>
          <dd>
            <span
              className="swatch"
              style={{ background: card?.hex ?? "#ccc" }}
            />
            {card?.name} · 批次 {batch.colorCardBatch}
          </dd>
        </div>
        <div>
          <dt>重量 / 用量</dt>
          <dd>
            {batch.weightKg}kg · 色料 {batch.usageKg}kg · 工期 {batch.days} 天
          </dd>
        </div>
        <div>
          <dt>交期</dt>
          <dd>{batch.dueDate ?? "无交期（旧档升级为普通单）"}</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>
            {batch.source}
            {batch.outsourced ? ` · 外协 ${batch.workshop ?? ""}` : ""}
          </dd>
        </div>
        <div>
          <dt>计划槽位 / 时段</dt>
          <dd>
            {batch.slotId
              ? `${batch.slotId} · ${fmtDate(batch.plannedStart)} → ${fmtDate(
                  batch.plannedEnd
                )}`
              : "未占位（排队中）"}
          </dd>
        </div>
        {batch.note && (
          <div>
            <dt>备注</dt>
            <dd>{batch.note}</dd>
          </div>
        )}
      </dl>
      <div className="drawer-actions">
        {batch.status === "已占位" && (
          <button className="primary" onClick={() => startBatch(batch.id)}>
            开始染色（上染机）
          </button>
        )}
        {batch.status === "染机上" && (
          <button className="primary" onClick={() => finishBatch(batch.id)}>
            染色完工
          </button>
        )}
        {batch.status === "已完工" && (
          <button className="primary" onClick={() => warehouseBatch(batch.id)}>
            入库（已染好照旧入库）
          </button>
        )}
        {batch.status === "已入库" && (
          <span className="muted">已完工入库</span>
        )}
        {batch.status === "待分配" && (
          <span className="muted">排队中，等待自动排产占位</span>
        )}
      </div>
    </aside>
  );
}

export default function Board() {
  const { slots, batches, runSchedule } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const queued = useMemo(
    () =>
      batches
        .filter((b) => b.status === "待分配")
        .sort((a, b) => {
          const dueA = a.dueDate ?? "9999";
          const dueB = b.dueDate ?? "9999";
          return dueA.localeCompare(dueB);
        }),
    [batches]
  );

  const selected = batches.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="board">
      <div className="heading">
        <div>
          <p>排产台</p>
          <h2>染槽排产 · 按加急顺序占位</h2>
        </div>
        <button className="primary" onClick={runSchedule}>
          自动排产
        </button>
      </div>

      <div className="legend">
        <span className="muted">加急：</span>
        <span className="legend-dot" style={{ background: urgencyBar.特急 }} />
        特急
        <span className="legend-dot" style={{ background: urgencyBar.加急 }} />
        加急
        <span className="legend-dot" style={{ background: urgencyBar.普通 }} />
        普通
      </div>

      <div className="gantt">
        {slots.map((slot) => (
          <SlotRow
            key={slot.id}
            slot={slot}
            batches={batches}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ))}
      </div>

      <div className="queue">
        <h3>
          排队中（容量满则保留交期继续排队） · {queued.length}
        </h3>
        {queued.length === 0 && <p className="muted">暂无排队批次。</p>}
        <div className="queue-chips">
          {queued.map((b) => (
            <button
              key={b.id}
              className={`queue-chip ${selectedId === b.id ? "selected" : ""}`}
              onClick={() => setSelectedId(b.id)}
            >
              <span
                className="chip-urgency"
                style={{ background: urgencyBar[b.urgency] }}
              />
              {b.id} · {b.urgency} · 交期 {b.dueDate ?? "无"}
              {b.legacy && <LegacyTag />}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <BatchDetail batch={selected} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
