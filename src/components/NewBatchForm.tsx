import { useMemo, useState } from "react";
import type { AppState, LoanKind, Priority } from "../types";
import type { NewBatchInput } from "../store";

interface Props {
  state: AppState;
  onAdd: (input: NewBatchInput) => void;
}

export default function NewBatchForm({ state, onAdd }: Props) {
  const [archiveId, setArchiveId] = useState(state.archives[0]?.id ?? "");
  const [cardId, setCardId] = useState(state.cards[0]?.id ?? "");
  const [cardLot, setCardLot] = useState("LOT-IND-2609");
  const [quantity, setQuantity] = useState(20);
  const [loanKind, setLoanKind] = useState<LoanKind>("loan");
  const [priority, setPriority] = useState<Priority>("normal");
  const [dueDay, setDueDay] = useState(3);
  const [duration, setDuration] = useState(1);
  const [outsourced, setOutsourced] = useState(false);
  const [note, setNote] = useState("");

  const card = state.cards.find((c) => c.id === cardId);
  const maxCap = useMemo(
    () =>
      Math.max(
        0,
        ...state.slots
          .filter((s) => (card ? s.dyeTypes.includes(card.dyeType) : true))
          .map((s) => s.capacityPerDay)
      ),
    [state.slots, card]
  );

  const submit = () => {
    if (!archiveId || !cardId || !cardLot.trim()) return;
    onAdd({
      archiveId,
      cardId,
      cardLot,
      quantity: Number(quantity),
      loanKind,
      priority,
      dueDay: Number(dueDay),
      duration: Math.max(1, Number(duration)),
      outsourced,
      note: note.trim() || undefined,
    });
    setNote("");
  };

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>新增修复批次</p>
          <h2>建单排产</h2>
        </div>
        <button className="primary" onClick={submit}>
          建单并按加急排队
        </button>
      </div>

      <div className="form-grid">
        <label>
          <span>纹样档案</span>
          <select value={archiveId} onChange={(e) => setArchiveId(e.target.value)}>
            {state.archives.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} · {a.origin} · {a.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>材料色卡</span>
          <select
            value={cardId}
            onChange={(e) => {
              setCardId(e.target.value);
              const c = state.cards.find((x) => x.id === e.target.value);
              if (c) setCardLot("");
            }}
          >
            {state.cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}（{c.id}）
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>色卡批次号（抢槽键）</span>
          <input value={cardLot} onChange={(e) => setCardLot(e.target.value)} placeholder="如 LOT-IND-2609" />
        </label>
        <label>
          <span>染线用量（绞/负载）</span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
          {card && quantity > maxCap && (
            <small className="warn">
              超过兼容槽最大容量 {maxCap}，建单后将保留交期排队
            </small>
          )}
        </label>
        <label>
          <span>订单类型</span>
          <select value={loanKind} onChange={(e) => setLoanKind(e.target.value as LoanKind)}>
            <option value="loan">馆藏借展</option>
            <option value="private">私人订单</option>
          </select>
        </label>
        <label>
          <span>优先级</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="urgent">加急</option>
            <option value="normal">普通</option>
          </select>
        </label>
        <label>
          <span>交期（第 N 天）</span>
          <input type="number" min={0} value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))} />
        </label>
        <label>
          <span>占槽时长（天）</span>
          <input type="number" min={1} max={6} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
        </label>
        <label className="check">
          <input type="checkbox" checked={outsourced} onChange={(e) => setOutsourced(e.target.checked)} />
          <span>交外协工坊染线（回执将对账）</span>
        </label>
        <label className="wide">
          <span>备注</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
        </label>
      </div>
    </section>
  );
}
