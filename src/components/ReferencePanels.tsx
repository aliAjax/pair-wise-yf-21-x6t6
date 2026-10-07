import type { AppState } from "../types";

export function ArchivesPanel({ state }: { state: AppState }) {
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>基础数据</p>
          <h2>纹样档案（{state.archives.length}）</h2>
        </div>
      </div>
      <div className="card-grid">
        {state.archives.map((a) => {
          const card = state.cards.find((c) => c.id === a.threadColorId);
          const batchCount = state.batches.filter(
            (b) => b.archiveId === a.id
          ).length;
          return (
            <article key={a.id} className="archive-card">
              <div className="ac-head">
                <b>{a.id}</b>
                <span className="origin-chip">{a.origin}</span>
              </div>
              <h3>{a.title}</h3>
              <p>
                {a.era} · {a.material} · {a.knotDensity} 结/英寸
              </p>
              <p className="muted">{a.damage}</p>
              <div className="ac-foot">
                <span>
                  <i className="swatch" style={{ background: card?.color }} />
                  补线 {card?.name ?? a.threadColorId}
                </span>
                <span className="muted">{batchCount} 个在产批次</span>
              </div>
            </article>
          );
        })}
      </div>

      <h3 className="mt">材料色卡（{state.cards.length}）</h3>
      <div className="colorcard-row">
        {state.cards.map((c) => {
          const sameLot = new Set(
            state.batches.filter((b) => b.cardId === c.id).map((b) => b.cardLot)
          );
          return (
            <div key={c.id} className="color-card">
              <i className="swatch big" style={{ background: c.color }} />
              <div>
                <b>{c.name}</b>
                <small>
                  {c.id} ·{" "}
                  {{ plant: "植物染", mineral: "矿物染", chemical: "化学染" }[c.dyeType]}
                </small>
                <small className="muted">{c.recipe}</small>
                <small>在用色卡批次：{[...sameLot].join("、") || "无"}</small>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function LogPanel({ state }: { state: AppState }) {
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>操作留痕</p>
          <h2>排产/对账日志</h2>
        </div>
      </div>
      <ul className="audit-log">
        {state.logs.map((l) => (
          <li key={l.id}>
            <time>{l.at.replace("T", " ")}</time>
            <span>{l.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
