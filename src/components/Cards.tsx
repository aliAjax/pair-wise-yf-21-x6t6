import { useState } from "react";
import { useStore } from "../store";

export default function Cards() {
  const { cards, addCard } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    hex: "#1e3a5f",
    batch: "",
    material: "羊毛",
    stockKg: 5,
  });

  const submit = () => {
    addCard({
      name: form.name || "新色卡",
      hex: form.hex,
      batch: form.batch || "B-2699",
      material: form.material,
      stockKg: Number(form.stockKg),
      unit: "kg",
    });
    setForm({ name: "", hex: "#1e3a5f", batch: "", material: "羊毛", stockKg: 5 });
    setShowForm(false);
  };

  return (
    <div>
      <div className="heading">
        <div>
          <p>材料色卡</p>
          <h2>色卡批次 · 库存</h2>
        </div>
        <button className="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "收起" : "新增色卡"}
        </button>
      </div>

      {showForm && (
        <section className="panel form-panel">
          <div className="field-grid">
            <label>
              <span>色名</span>
              <input
                value={form.name}
                placeholder="如：靛蓝"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label>
              <span>颜色</span>
              <input
                type="color"
                value={form.hex}
                onChange={(e) => setForm((f) => ({ ...f, hex: e.target.value }))}
              />
            </label>
            <label>
              <span>色卡批次</span>
              <input
                value={form.batch}
                placeholder="如 B-2610"
                onChange={(e) => setForm((f) => ({ ...f, batch: e.target.value }))}
              />
            </label>
            <label>
              <span>适用材质</span>
              <input
                value={form.material}
                onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
              />
            </label>
            <label>
              <span>库存 (kg)</span>
              <input
                type="number"
                value={form.stockKg}
                onChange={(e) => setForm((f) => ({ ...f, stockKg: Number(e.target.value) }))}
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="primary" onClick={submit}>
              保存色卡
            </button>
          </div>
        </section>
      )}

      <div className="card-grid">
        {cards.map((c) => (
          <article key={c.id} className="color-card">
            <div className="color-swatch" style={{ background: c.hex }}>
              <span className="color-id">{c.id}</span>
            </div>
            <div className="color-body">
              <strong>{c.name}</strong>
              <p className="muted">批次 {c.batch}</p>
              <p className="muted">
                {c.material} · 库存 {c.stockKg}
                {c.unit}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
