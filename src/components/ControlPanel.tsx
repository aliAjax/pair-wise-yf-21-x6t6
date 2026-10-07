import { useState } from "react";
import type { AppState } from "../types";

interface Props {
  state: AppState;
  onSetDowntime: (slotId: string, from: number, to: number, reason: string) => void;
  onClearDowntime: (slotId: string) => void;
  onReplan: () => void;
  onFill: () => void;
}

const REASONS = ["染机故障检修", "定期保养", "换色清槽", "停电待工"];

export default function ControlPanel({
  state,
  onSetDowntime,
  onClearDowntime,
  onReplan,
  onFill,
}: Props) {
  const [slotId, setSlotId] = useState(state.slots[0]?.id ?? "");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(2);
  const [reason, setReason] = useState(REASONS[0]);

  const downSlots = state.slots.filter((s) => s.downtime);

  return (
    <section className="panel control">
      <div className="heading">
        <div>
          <p>染机与槽位</p>
          <h2>停机 / 维护 / 顺延</h2>
        </div>
        <div className="btn-row">
          <button onClick={onFill}>按剩余容量补位</button>
          <button className="primary" onClick={onReplan}>
            全量重排
          </button>
        </div>
      </div>

      <div className="downtime-form">
        <label>
          <span>槽位</span>
          <select value={slotId} onChange={(e) => setSlotId(e.target.value)}>
            {state.slots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>停机起 D</span>
          <input type="number" min={0} value={from} onChange={(e) => setFrom(Number(e.target.value))} />
        </label>
        <label>
          <span>停机止 D</span>
          <input type="number" min={from} value={to} onChange={(e) => setTo(Number(e.target.value))} />
        </label>
        <label>
          <span>原因</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <button
          className="danger"
          disabled={to < from}
          onClick={() => onSetDowntime(slotId, from, to, reason)}
        >
          登记停机并顺延
        </button>
      </div>

      {downSlots.length > 0 && (
        <ul className="down-list">
          {downSlots.map((s) => (
            <li key={s.id}>
              <b>
                {s.id}：{s.downtime!.reason}
              </b>
              <span>
                D{s.downtime!.from}–D{s.downtime!.to}，未开染批次已释放顺延，在染/已染好批次不动
              </span>
              <button onClick={() => onClearDowntime(s.id)}>恢复运行</button>
            </li>
          ))}
        </ul>
      )}

      <p className="muted rule">
        规则：停机只释放「已排产未开染」的占用并按剩余容量顺延；在染、已染好、已入库批次锁定，染好的照旧入库；排不进的批次交期不变、继续排队。
      </p>
    </section>
  );
}
