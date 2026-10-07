import { useStore } from "../store";
import { fmtTs } from "../utils";

const kindLabel: Record<string, string> = {
  schedule: "排产",
  machine: "染机",
  receipt: "回执",
  legacy: "升级",
  system: "系统",
};

const kindColor: Record<string, string> = {
  schedule: "#2563eb",
  machine: "#b45309",
  receipt: "#0f766e",
  legacy: "#7c3aed",
  system: "#475569",
};

export default function Logs() {
  const { logs } = useStore();
  return (
    <div>
      <div className="heading">
        <div>
          <p>操作日志</p>
          <h2>排产 / 染机 / 回执 记录</h2>
        </div>
      </div>
      <div className="log-list">
        {logs.length === 0 && <p className="muted">暂无日志。</p>}
        {logs.map((l) => (
          <article key={l.id} className="log-item">
            <span
              className="tag"
              style={{
                color: kindColor[l.kind],
                background: `${kindColor[l.kind]}14`,
                borderColor: `${kindColor[l.kind]}44`,
              }}
            >
              {kindLabel[l.kind] ?? l.kind}
            </span>
            <span className="log-text">{l.text}</span>
            <span className="muted log-time">{fmtTs(l.at)}</span>
          </article>
        ))}
      </div>
    </div>
  );
}
