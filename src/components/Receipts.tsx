import { useState } from "react";
import { useStore } from "../store";
import type { ReceiptStatus } from "../types";
import { fmtTs } from "../utils";

const statusColor: Record<ReceiptStatus, string> = {
  待对账: "#2563eb",
  已对账: "#0f766e",
  待处理: "#b91c1c",
  迟到: "#b45309",
};

export default function Receipts() {
  const { receipts, batches, addReceipt, reconcileOne, reconcileAll } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    batchId: "",
    workshop: "云染坊",
    colorCardBatch: "",
    usageKg: 1,
  });

  const batchOf = (id: string) => batches.find((b) => b.id === id);

  const submit = () => {
    addReceipt({
      batchId: form.batchId || undefined,
      workshop: form.workshop || "外协工坊",
      colorCardBatch: form.colorCardBatch || batchOf(form.batchId)?.colorCardBatch || "",
      usageKg: Number(form.usageKg),
    });
    setForm({ batchId: "", workshop: "云染坊", colorCardBatch: "", usageKg: 1 });
    setShowForm(false);
  };

  const pendingCount = receipts.filter((r) => r.status === "待对账").length;

  return (
    <div>
      <div className="heading">
        <div>
          <p>外协回执</p>
          <h2>回执对账 · 不一致留待 · 迟到不改写</h2>
        </div>
        <div className="heading-actions">
          <button onClick={() => setShowForm((v) => !v)}>登记回执</button>
          <button className="primary" onClick={reconcileAll} disabled={pendingCount === 0}>
            批量对账（{pendingCount}）
          </button>
        </div>
      </div>

      {showForm && (
        <section className="panel form-panel">
          <div className="field-grid">
            <label>
              <span>对应批次号</span>
              <input
                value={form.batchId}
                placeholder="如 BAT-005"
                onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}
              />
            </label>
            <label>
              <span>外协工坊</span>
              <input
                value={form.workshop}
                onChange={(e) => setForm((f) => ({ ...f, workshop: e.target.value }))}
              />
            </label>
            <label>
              <span>回执色卡批次</span>
              <input
                value={form.colorCardBatch}
                placeholder="如 B-2606"
                onChange={(e) => setForm((f) => ({ ...f, colorCardBatch: e.target.value }))}
              />
            </label>
            <label>
              <span>回执用量 (kg)</span>
              <input
                type="number"
                step="0.1"
                value={form.usageKg}
                onChange={(e) => setForm((f) => ({ ...f, usageKg: Number(e.target.value) }))}
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="primary" onClick={submit}>
              登记并对账
            </button>
          </div>
        </section>
      )}

      <div className="receipt-list">
        {receipts.map((r) => {
          const b = batchOf(r.batchId);
          return (
            <article key={r.id} className="receipt-card">
              <div className="receipt-head">
                <strong>{r.id}</strong>
                <span
                  className="tag"
                  style={{
                    color: statusColor[r.status],
                    background: `${statusColor[r.status]}14`,
                    borderColor: `${statusColor[r.status]}44`,
                  }}
                >
                  {r.status}
                </span>
              </div>
              <div className="receipt-body">
                <p>
                  批次 <strong>{r.batchId}</strong>
                  {b ? `（本院色卡批次 ${b.colorCardBatch} / 用量 ${b.usageKg}kg）` : "（本院无此批次）"}
                </p>
                <p className="muted">
                  {r.workshop} · 到件 {fmtTs(r.arrivedAt)}
                </p>
                <p className="muted">
                  回执：色卡批次 {r.colorCardBatch} · 用量 {r.usageKg}kg
                </p>
                {r.reason && <p className="receipt-reason">处理说明：{r.reason}</p>}
                {r.duplicateOf && (
                  <p className="receipt-reason">重复原回执：{r.duplicateOf}</p>
                )}
              </div>
              {r.status === "待对账" && (
                <div className="batch-actions">
                  <button
                    className="mini primary"
                    onClick={() => reconcileOne(r.id)}
                  >
                    对账
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
