import { useState } from "react";
import { useStore } from "../store";
import { SlotStatusTag } from "./ui";

export default function Slots() {
  const { slots, batches, addSlot, setSlotStatus } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", capacityKg: 30, location: "" });

  const occupancy = (slotId: string) =>
    batches.filter(
      (b) =>
        b.slotId === slotId &&
        (b.status === "已占位" || b.status === "染机上")
    );

  const submit = () => {
    addSlot({
      name: form.name || "新染槽",
      capacityKg: Number(form.capacityKg),
      status: "运行中",
      location: form.location || "未分区",
    });
    setForm({ name: "", capacityKg: 30, location: "" });
    setShowForm(false);
  };

  return (
    <div>
      <div className="heading">
        <div>
          <p>槽位</p>
          <h2>染槽容量 · 运行 / 维护 / 停机</h2>
        </div>
        <button className="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "收起" : "新增染槽"}
        </button>
      </div>

      {showForm && (
        <section className="panel form-panel">
          <div className="field-grid">
            <label>
              <span>槽位名称</span>
              <input
                value={form.name}
                placeholder="如 东染槽"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label>
              <span>容量 (kg)</span>
              <input
                type="number"
                value={form.capacityKg}
                onChange={(e) => setForm((f) => ({ ...f, capacityKg: Number(e.target.value) }))}
              />
            </label>
            <label>
              <span>位置</span>
              <input
                value={form.location}
                placeholder="如 一号车间"
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="primary" onClick={submit}>
              保存染槽
            </button>
          </div>
        </section>
      )}

      <div className="slot-list">
        {slots.map((s) => {
          const occ = occupancy(s.id);
          const load = occ.reduce((sum, b) => sum + b.weightKg, 0);
          return (
            <article key={s.id} className="slot-card">
              <div className="slot-card-head">
                <div>
                  <strong>
                    {s.name}（{s.id}）
                  </strong>
                  <div className="muted">
                    {s.location} · 容量 {s.capacityKg}kg
                  </div>
                </div>
                <SlotStatusTag value={s.status} />
              </div>
              <div className="slot-load">
                <div className="slot-load-bar">
                  <div
                    className="slot-load-fill"
                    style={{
                      width: `${Math.min(100, (load / s.capacityKg) * 100)}%`,
                      background:
                        s.status === "运行中" ? "var(--accent)" : "#94a3b8",
                    }}
                  />
                </div>
                <span className="muted">
                  在槽 {load}kg / {s.capacityKg}kg · {occ.length} 批次
                </span>
              </div>
              <div className="slot-occupancy">
                {occ.length === 0 && <span className="muted">当前空闲</span>}
                {occ.map((b) => (
                  <span key={b.id} className="queue-chip">
                    {b.id} · {b.urgency} · {b.status}
                  </span>
                ))}
              </div>
              <div className="slot-card-actions">
                {s.status === "运行中" ? (
                  <>
                    <button
                      className="mini"
                      onClick={() => setSlotStatus(s.id, "维护中")}
                    >
                      维护
                    </button>
                    <button
                      className="mini danger"
                      onClick={() => setSlotStatus(s.id, "停机")}
                    >
                      停机
                    </button>
                  </>
                ) : (
                  <button
                    className="mini primary"
                    onClick={() => setSlotStatus(s.id, "运行中")}
                  >
                    恢复运行
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
