import { useMemo, useState } from "react";
import type { AppState, Batch } from "../types";
import { addDays } from "../lib/date";

interface Props {
  state: AppState;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const STATUS_LABEL: Record<Batch["status"], string> = {
  queued: "排队待排",
  scheduled: "已占槽",
  in_progress: "在染",
  dyed: "已染好",
  stored: "已入库",
};

type Filter = "all" | "queued" | "scheduled" | "running" | "overdue" | "legacy";

export default function BatchList({ state, selectedId, onSelect }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [origin, setOrigin] = useState<string>("all");

  const archiveOf = (id: string) =>
    state.archives.find((a) => a.id === id);
  const cardOf = (id: string) => state.cards.find((c) => c.id === id);

  const list = useMemo(() => {
    return state.batches
      .filter((b) => {
        if (filter === "queued") return b.status === "queued";
        if (filter === "scheduled") return b.status === "scheduled";
        if (filter === "running")
          return ["in_progress", "dyed", "stored"].includes(b.status);
        if (filter === "legacy") return b.source === "legacy";
        if (filter === "overdue") {
          return (
            b.status === "queued" ||
            (b.status === "scheduled" &&
              b.startDay !== null &&
              b.startDay + b.duration - 1 > b.dueDay)
          );
        }
        return true;
      })
      .filter((b) => {
        if (origin === "all") return true;
        return archiveOf(b.archiveId)?.origin === origin;
      })
      .slice()
      .sort((a, b) => {
        // 加急、排队、交期
        const rank = (x: Batch) =>
          x.status === "queued" ? 0 : x.status === "scheduled" ? 1 : 2;
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        if (a.priority !== b.priority)
          return a.priority === "urgent" ? -1 : 1;
        return a.dueDay - b.dueDay;
      });
  }, [state.batches, state.archives, filter, origin]);

  const origins = ["all", ...Array.from(new Set(state.archives.map((a) => a.origin)))];

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>修复批次</p>
          <h2>批次队列（{list.length}）</h2>
        </div>
      </div>

      <div className="filter-bar">
        {([
          ["all", "全部"],
          ["queued", "排队中"],
          ["scheduled", "已占槽"],
          ["running", "在染/入库"],
          ["overdue", "超期风险"],
          ["legacy", "旧档升级"],
        ] as [Filter, string][]).map(([k, label]) => (
          <button
            key={k}
            className={"chip" + (filter === k ? " active" : "")}
            onClick={() => setFilter(k)}
          >
            {label}
          </button>
        ))}
        <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
          {origins.map((o) => (
            <option key={o} value={o}>
              {o === "all" ? "全部产地" : o}
            </option>
          ))}
        </select>
      </div>

      <div className="batch-list">
        {list.map((b) => {
          const arc = archiveOf(b.archiveId);
          const card = cardOf(b.cardId);
          const overdue =
            b.status === "scheduled" &&
            b.startDay !== null &&
            b.startDay + b.duration - 1 > b.dueDay;
          return (
            <button
              key={b.id}
              className={
                "batch-item" +
                (selectedId === b.id ? " selected" : "") +
                (b.status === "queued" ? " queued" : "")
              }
              onClick={() => onSelect(b.id)}
            >
              <div className="bi-top">
                <b>{b.id}</b>
                <span className={"status s-" + b.status}>
                  {STATUS_LABEL[b.status]}
                </span>
              </div>
              <div className="bi-mid">
                {arc ? `${arc.id} ${arc.origin}` : "档案缺失"} ·{" "}
                <i style={{ background: card?.color }} className="swatch" />
                {card?.name ?? b.cardId} · {b.cardLot}
              </div>
              <div className="bi-bot">
                <span className={b.priority === "urgent" ? "urgent-tag" : ""}>
                  {b.loanKind === "loan" ? "馆藏借展" : "私人订单"} ·{" "}
                  {b.priority === "urgent" ? "加急" : "普通"}
                </span>
                <span>
                  交期 {addDays(state.baseDate, b.dueDay)}
                  {overdue && <em className="overdue-tag"> 将超期</em>}
                </span>
              </div>
              <div className="bi-bot">
                <span>
                  {b.status === "queued"
                    ? "未占槽（交期保留）"
                    : `槽位 ${b.slotId} @ D${b.startDay}，用量 ${b.quantity}`}
                </span>
                {b.source === "legacy" && <span className="legacy-tag">旧档</span>}
                {b.outsourced && <span className="out-tag">外协</span>}
              </div>
            </button>
          );
        })}
        {list.length === 0 && <p className="muted pad">没有符合筛选的批次。</p>}
      </div>
    </section>
  );
}
