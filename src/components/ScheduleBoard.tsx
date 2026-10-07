import { useMemo } from "react";
import type { AppState, Batch } from "../types";
import { dayLabel, weekdayLabel } from "../lib/date";

interface Props {
  state: AppState;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const STATUS_LABEL: Record<Batch["status"], string> = {
  queued: "排队",
  scheduled: "已排产",
  in_progress: "在染",
  dyed: "已染好",
  stored: "已入库",
};

function barColor(b: Batch): string {
  if (b.status === "in_progress") return "#0f766e";
  if (b.status === "dyed" || b.status === "stored") return "#4b5563";
  if (b.source === "legacy") return "#8d7b5f";
  if (b.priority === "urgent") return "#b43a2a";
  return "#1f6f68";
}

export default function ScheduleBoard({ state, selectedId, onSelect }: Props) {
  const days = useMemo(
    () => Array.from({ length: state.horizon }, (_, i) => i),
    [state.horizon]
  );

  const overdueSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of state.batches) {
      if (
        b.status === "scheduled" &&
        b.startDay !== null &&
        b.startDay + b.duration - 1 > b.dueDay
      )
        s.add(b.id);
    }
    return s;
  }, [state.batches]);

  return (
    <div className="board-scroll">
      <div
        className="board"
        style={{ ["--days" as string]: state.horizon }}
      >
        <div className="board-corner">
          槽位 \ 日期
          <small>{state.baseDate} 起排</small>
        </div>
        <div className="day-row">
          {days.map((d) => (
            <div key={d} className={"day-head" + (d === 0 ? " today" : "")}>
              <b>D{d}</b>
              <span>
                {dayLabel(state.baseDate, d)} {weekdayLabel(state.baseDate, d)}
              </span>
            </div>
          ))}
        </div>

        {state.slots.map((slot) => {
          const uniq = [...new Map(
            state.batches
              .filter((b) => b.occupancy.some((o) => o.slotId === slot.id))
              .map((b) => [b.id, b])
          ).values()];
          return (
            <div className="slot-line" key={slot.id}>
              <div className="slot-head">
                <b>
                  {slot.id} <small className="slot-name">{slot.name}</small>
                </b>
                <small>
                  容量 {slot.capacityPerDay} ·{" "}
                  {slot.dyeTypes
                    .map((d) => ({ plant: "植物", mineral: "矿物", chemical: "化学" }[d]))
                    .join("/")}
                </small>
                {slot.downtime && (
                  <small className="down-tag">
                    停机 D{slot.downtime.from}-D{slot.downtime.to}
                  </small>
                )}
              </div>

              <div
                className="track"
                style={{
                  gridTemplateColumns: `repeat(${state.horizon}, minmax(86px,1fr))`,
                }}
              >
                {days.map((d) => (
                  <div key={d} className={"cell" + (d === 0 ? " today-cell" : "")} />
                ))}

                {slot.downtime && (
                  <div
                    className="down-bar"
                    style={{
                      gridColumn: `${slot.downtime.from + 1} / ${
                        Math.min(slot.downtime.to, state.horizon - 1) + 2
                      }`,
                    }}
                    title={slot.downtime.reason}
                  >
                    停机维护：{slot.downtime.reason}
                  </div>
                )}

                {uniq.map((b) => {
                  const start = Math.min(
                    ...b.occupancy.filter((o) => o.slotId === slot.id).map((o) => o.day)
                  );
                  const span = b.duration;
                  return (
                    <button
                      key={b.id}
                      className={
                        "batch-bar " +
                        (selectedId === b.id ? "selected" : "") +
                        (overdueSet.has(b.id) ? " overdue" : "")
                      }
                      style={{
                        background: barColor(b),
                        gridColumn: `${start + 1} / span ${span}`,
                      }}
                      onClick={() => onSelect(b.id)}
                      title={`${b.id} · ${STATUS_LABEL[b.status]}`}
                    >
                      <b>{b.id}</b>
                      <span>
                        {b.priority === "urgent" ? "加急" : "普通"} · {b.quantity}
                        {span > 1 ? ` · ${span}天` : ""}
                      </span>
                      {overdueSet.has(b.id) && <em className="overdue-flag">超期</em>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="legend">
        <span><i className="dot urgent" />加急单</span>
        <span><i className="dot normal" />普通单</span>
        <span><i className="dot running" />在染/完成(锁定)</span>
        <span><i className="dot legacy" />旧档升级单</span>
        <span><i className="dot down" />停机维护</span>
        <span><i className="dot overdue" />已超交期</span>
        <span className="muted">一格=一个槽·日，同格只容一批；停机只释放未开染批次</span>
      </div>
    </div>
  );
}
