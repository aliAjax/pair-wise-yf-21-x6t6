import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { BatchSource, BatchStatus, Urgency } from "../types";
import { fmtDate } from "../utils";
import { BatchStatusTag, LegacyTag, UrgencyTag } from "./ui";

const STATUSES: (BatchStatus | "全部")[] = [
  "全部",
  "待分配",
  "已占位",
  "染机上",
  "已完工",
  "已入库",
];

const emptyForm = {
  patternId: "",
  colorCardId: "",
  weightKg: 12,
  usageKg: 1.5,
  days: 2,
  urgency: "普通" as Urgency,
  dueDate: "",
  source: "私人订单" as BatchSource,
  workshop: "",
  note: "",
};

export default function Batches() {
  const {
    batches,
    patterns,
    cards,
    slots,
    addBatch,
    startBatch,
    finishBatch,
    warehouseBatch,
  } = useStore();
  const [statusFilter, setStatusFilter] = useState<BatchStatus | "全部">("全部");
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | "全部">("全部");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const patternName = (id: string) =>
    patterns.find((p) => p.id === id)?.name ?? id;
  const cardOf = (id: string) => cards.find((c) => c.id === id);
  const slotName = (id: string | null) =>
    id ? slots.find((s) => s.id === id)?.name ?? id : "—";

  const list = useMemo(() => {
    return batches
      .filter((b) => (statusFilter === "全部" ? true : b.status === statusFilter))
      .filter((b) =>
        urgencyFilter === "全部" ? true : b.urgency === urgencyFilter
      )
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [batches, statusFilter, urgencyFilter]);

  const submit = () => {
    addBatch({
      patternId: form.patternId || undefined,
      colorCardId: form.colorCardId || undefined,
      colorCardBatch: cardOf(form.colorCardId)?.batch,
      weightKg: Number(form.weightKg),
      usageKg: Number(form.usageKg),
      days: Number(form.days),
      urgency: form.urgency,
      dueDate: form.dueDate || null,
      source: form.source,
      outsourced: form.source === "外协",
      workshop: form.source === "外协" ? form.workshop || "外协工坊" : null,
      note: form.note || undefined,
    });
    setForm(emptyForm);
    setShowForm(false);
  };

  return (
    <div>
      <div className="heading">
        <div>
          <p>修复批次</p>
          <h2>批次台账 · 占位 / 染色 / 入库</h2>
        </div>
        <button
          className="primary"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "收起" : "新增批次"}
        </button>
      </div>

      {showForm && (
        <section className="panel form-panel">
          <div className="field-grid">
            <label>
              <span>纹样档案</span>
              <select
                value={form.patternId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, patternId: e.target.value }))
                }
              >
                <option value="">选择纹样…</option>
                {patterns.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>材料色卡</span>
              <select
                value={form.colorCardId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, colorCardId: e.target.value }))
                }
              >
                <option value="">选择色卡…</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} · {c.name}（{c.batch}）
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>织物重量 (kg)</span>
              <input
                type="number"
                value={form.weightKg}
                onChange={(e) =>
                  setForm((f) => ({ ...f, weightKg: Number(e.target.value) }))
                }
              />
            </label>
            <label>
              <span>色料用量 (kg)</span>
              <input
                type="number"
                step="0.1"
                value={form.usageKg}
                onChange={(e) =>
                  setForm((f) => ({ ...f, usageKg: Number(e.target.value) }))
                }
              />
            </label>
            <label>
              <span>染色天数</span>
              <input
                type="number"
                value={form.days}
                onChange={(e) =>
                  setForm((f) => ({ ...f, days: Number(e.target.value) }))
                }
              />
            </label>
            <label>
              <span>加急等级</span>
              <select
                value={form.urgency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, urgency: e.target.value as Urgency }))
                }
              >
                <option value="普通">普通</option>
                <option value="加急">加急</option>
                <option value="特急">特急</option>
              </select>
            </label>
            <label>
              <span>交期</span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueDate: e.target.value }))
                }
              />
            </label>
            <label>
              <span>来源</span>
              <select
                value={form.source}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    source: e.target.value as BatchSource,
                  }))
                }
              >
                <option value="私人订单">私人订单</option>
                <option value="馆藏借展">馆藏借展</option>
                <option value="外协">外协</option>
              </select>
            </label>
            {form.source === "外协" && (
              <label>
                <span>外协工坊</span>
                <input
                  value={form.workshop}
                  placeholder="如：云染坊"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, workshop: e.target.value }))
                  }
                />
              </label>
            )}
            <label>
              <span>备注</span>
              <input
                value={form.note}
                placeholder="可选"
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="primary" onClick={submit}>
              保存并自动排产
            </button>
          </div>
        </section>
      )}

      <div className="chips filter-chips">
        {STATUSES.map((s) => (
          <button
            key={s}
            className={statusFilter === s ? "active" : ""}
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="chips filter-chips">
        {(["全部", "特急", "加急", "普通"] as const).map((u) => (
          <button
            key={u}
            className={urgencyFilter === u ? "active" : ""}
            onClick={() => setUrgencyFilter(u)}
          >
            {u === "全部" ? "全部加急" : u}
          </button>
        ))}
      </div>

      <div className="batch-list">
        {list.map((b) => {
          const card = cardOf(b.colorCardId);
          return (
            <article key={b.id} className="batch-card">
              <div className="batch-main">
                <div className="batch-title">
                  <strong>{b.id}</strong>
                  <UrgencyTag value={b.urgency} />
                  <BatchStatusTag value={b.status} />
                  {b.legacy && <LegacyTag />}
                </div>
                <div className="batch-sub">
                  <span
                    className="swatch"
                    style={{ background: card?.hex ?? "#ccc" }}
                  />
                  {patternName(b.patternId)} · 色卡 {b.colorCardBatch}
                  {b.outsourced ? ` · 外协 ${b.workshop ?? ""}` : ""}
                </div>
                <div className="batch-meta">
                  <span>
                    槽位：{slotName(b.slotId)}
                    {b.plannedStart
                      ? `（${fmtDate(b.plannedStart)}→${fmtDate(b.plannedEnd)}）`
                      : ""}
                  </span>
                  <span>交期：{b.dueDate ?? "无（旧档普通单）"}</span>
                  <span>
                    {b.weightKg}kg / 色料 {b.usageKg}kg / {b.days}天
                  </span>
                  <span>{b.source}</span>
                </div>
              </div>
              <div className="batch-actions">
                {b.status === "已占位" && (
                  <button
                    className="mini primary"
                    onClick={() => startBatch(b.id)}
                  >
                    开始染色
                  </button>
                )}
                {b.status === "染机上" && (
                  <button
                    className="mini primary"
                    onClick={() => finishBatch(b.id)}
                  >
                    染色完工
                  </button>
                )}
                {b.status === "已完工" && (
                  <button
                    className="mini primary"
                    onClick={() => warehouseBatch(b.id)}
                  >
                    入库
                  </button>
                )}
                {b.status === "已入库" && (
                  <span className="muted">已入库</span>
                )}
                {b.status === "待分配" && (
                  <span className="muted">排队中</span>
                )}
              </div>
            </article>
          );
        })}
        {list.length === 0 && <p className="muted">当前筛选下没有批次。</p>}
      </div>
    </div>
  );
}
