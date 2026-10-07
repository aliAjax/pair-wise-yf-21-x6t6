import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { Pattern } from "../types";
import { LegacyTag } from "./ui";

const ORIGINS = ["全部", "波斯", "安纳托利亚", "高加索", "藏毯"];

/** 纹样局部标记图：用 SVG 模拟地毯，并在破损区域打标记 */
function PatternMap({ pattern: _pattern }: { pattern: Pattern }) {
  const markers = [
    { x: 70, y: 60, label: "破损" },
    { x: 230, y: 120, label: "褪色" },
    { x: 150, y: 200, label: "补线" },
  ];
  return (
    <svg viewBox="0 0 320 240" className="pattern-map" role="img" aria-label="纹样局部标记图">
      <rect x="0" y="0" width="320" height="240" rx="10" fill="#f3ead9" />
      <rect x="14" y="14" width="292" height="212" rx="8" fill="none" stroke="#b45309" strokeWidth="3" />
      <rect x="30" y="30" width="260" height="180" rx="6" fill="none" stroke="#0f766e" strokeWidth="1.5" />
      {/* 中心纹样 */}
      <path
        d="M160 70 L190 120 L160 170 L130 120 Z"
        fill="none"
        stroke="#7c2d12"
        strokeWidth="2"
      />
      <circle cx="160" cy="120" r="14" fill="#7c2d12" opacity="0.18" />
      {/* 角隅纹样 */}
      <path d="M40 40 q30 10 40 40" fill="none" stroke="#0f766e" strokeWidth="1.5" />
      <path d="M280 40 q-30 10 -40 40" fill="none" stroke="#0f766e" strokeWidth="1.5" />
      <path d="M40 200 q30 -10 40 -40" fill="none" stroke="#0f766e" strokeWidth="1.5" />
      <path d="M280 200 q-30 -10 -40 -40" fill="none" stroke="#0f766e" strokeWidth="1.5" />
      {markers.map((m, i) => (
        <g key={i}>
          <circle cx={m.x} cy={m.y} r="9" fill="#b91c1c" opacity="0.85" />
          <text x={m.x} y={m.y + 3} textAnchor="middle" fontSize="9" fill="#fff">
            {i + 1}
          </text>
          <text x={m.x + 12} y={m.y + 4} fontSize="10" fill="#b91c1c">
            {m.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function Patterns() {
  const { patterns, batches, cards } = useStore();
  const [origin, setOrigin] = useState("全部");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useMemo(
    () =>
      patterns.filter((p) => (origin === "全部" ? true : p.origin === origin)),
    [patterns, origin]
  );
  const selected = patterns.find((p) => p.id === selectedId) ?? null;
  const linkedBatches = selected
    ? batches.filter((b) => b.patternId === selected.id)
    : [];
  const linkedCard = selected
    ? cards.find((c) => c.name.includes(selected.threadColor) || c.id === linkedBatches[0]?.colorCardId)
    : null;

  return (
    <div>
      <div className="heading">
        <div>
          <p>纹样档案</p>
          <h2>纹样 · 修复前后 · 色卡</h2>
        </div>
      </div>

      <div className="chips filter-chips">
        {ORIGINS.map((o) => (
          <button
            key={o}
            className={origin === o ? "active" : ""}
            onClick={() => setOrigin(o)}
          >
            {o}
          </button>
        ))}
      </div>

      <div className="pattern-grid">
        {list.map((p) => (
          <article
            key={p.id}
            className={`pattern-card ${selectedId === p.id ? "selected" : ""}`}
            onClick={() => setSelectedId(p.id)}
          >
            <div className="pattern-top">
              <strong>{p.id}</strong>
              {p.legacy && <LegacyTag />}
            </div>
            <h3>{p.name}</h3>
            <p className="muted">
              {p.origin} · {p.era} · {p.knotDensity}
            </p>
            <p className="pattern-damage">破损：{p.damageArea}</p>
            <p className="muted">补线：{p.threadColor}</p>
          </article>
        ))}
      </div>

      {selected && (
        <section className="panel pattern-detail">
          <div className="heading">
            <div>
              <p>{selected.id}</p>
              <h2>{selected.name}</h2>
            </div>
            <button className="mini" onClick={() => setSelectedId(null)}>
              收起
            </button>
          </div>
          <div className="pattern-detail-grid">
            <PatternMap pattern={selected} />
            <div>
              <dl className="detail-list">
                <div>
                  <dt>产地 / 年代</dt>
                  <dd>
                    {selected.origin} · {selected.era}
                  </dd>
                </div>
                <div>
                  <dt>结密度</dt>
                  <dd>{selected.knotDensity}</dd>
                </div>
                <div>
                  <dt>材质 / 染色类型</dt>
                  <dd>
                    {selected.material} · {selected.dyeType}
                  </dd>
                </div>
                <div>
                  <dt>破损区域</dt>
                  <dd>{selected.damageArea}</dd>
                </div>
                <div>
                  <dt>补线颜色</dt>
                  <dd>
                    {linkedCard && (
                      <span
                        className="swatch"
                        style={{ background: linkedCard.hex }}
                      />
                    )}
                    {selected.threadColor}
                  </dd>
                </div>
                <div>
                  <dt>修复工序</dt>
                  <dd>{selected.process}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="before-after">
            <div>
              <h4>修复前记录</h4>
              <p>{selected.beforeNote ?? "（旧档案未记录修复前状况）"}</p>
            </div>
            <div>
              <h4>修复后记录</h4>
              <p>{selected.afterNote ?? "（修复后待补录）"}</p>
            </div>
          </div>
          <div className="linked-batches">
            <h4>关联修复批次</h4>
            {linkedBatches.length === 0 ? (
              <p className="muted">暂无关联批次。</p>
            ) : (
              <div className="queue-chips">
                {linkedBatches.map((b) => (
                  <span key={b.id} className="queue-chip">
                    {b.id} · {b.status} · {b.urgency}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
