import { useState } from "react";
import type { AppState, Receipt } from "../types";

interface Props {
  state: AppState;
  onReceive: (input: {
    batchNo: string;
    cardLot: string;
    quantity: number;
    workshop: string;
  }) => void;
  onAdjudicate: (id: string, action: "accept" | "reject") => void;
}

const STATUS_META: Record<
  Receipt["status"],
  { label: string; cls: string }
> = {
  matched: { label: "一致·已确认", cls: "matched" },
  duplicate: { label: "重复·已忽略", cls: "duplicate" },
  mismatch: { label: "不一致·留待", cls: "mismatch" },
  unknown: { label: "查无批次·留待", cls: "unknown" },
};

export default function ReceiptPanel({ state, onReceive, onAdjudicate }: Props) {
  const [batchNo, setBatchNo] = useState("B-2026-02");
  const [cardLot, setCardLot] = useState("LOT-COC-2610");
  const [quantity, setQuantity] = useState(25);
  const [workshop, setWorkshop] = useState("青格达染坊");

  const pending = state.receipts.filter(
    (r) => r.status === "mismatch" || r.status === "unknown"
  );

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>外协工坊回执</p>
          <h2>按批次号对账</h2>
        </div>
      </div>

      <div className="receipt-form">
        <label>
          <span>回执批次号</span>
          <input value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
        </label>
        <label>
          <span>色卡批次</span>
          <input value={cardLot} onChange={(e) => setCardLot(e.target.value)} />
        </label>
        <label>
          <span>用量</span>
          <input type="number" min={0} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        </label>
        <label>
          <span>来源工坊</span>
          <input value={workshop} onChange={(e) => setWorkshop(e.target.value)} />
        </label>
        <button
          className="primary"
          onClick={() =>
            onReceive({
              batchNo: batchNo.trim(),
              cardLot: cardLot.trim(),
              quantity: Number(quantity),
              workshop: workshop.trim() || "未具名工坊",
            })
          }
        >
          回执到达·对账
        </button>
      </div>

      <p className="muted rule">
        对账仅按批次号匹配本院记录：色卡批次或用量不一致→留待处理；晚到的重复回执忽略；后到回执不能改写已确认工序，一致时只向流水追加一条确认。
      </p>

      {pending.length > 0 && (
        <div className="pending-box">
          <h3>留待人工处理（{pending.length}）</h3>
          {pending.map((r) => (
            <div key={r.id} className="receipt-row pending">
              <div>
                <b>
                  {r.batchNo} · {r.workshop}
                </b>
                <span>{r.detail}</span>
              </div>
              <div className="btn-row">
                <button onClick={() => onAdjudicate(r.id, "accept")}>采纳更正</button>
                <button className="ghost" onClick={() => onAdjudicate(r.id, "reject")}>
                  驳回
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ul className="receipt-log">
        {state.receipts.map((r) => {
          const meta = STATUS_META[r.status];
          return (
            <li key={r.id} className="receipt-row">
              <div>
                <b>
                  {r.batchNo} · {r.workshop}{" "}
                  <em className={"rcp-tag r-" + meta.cls}>{meta.label}</em>
                  {r.applied && <em className="applied-tag">已追加确认</em>}
                </b>
                <span>{r.detail}</span>
                <small>{r.arrivedAt.replace("T", " ")}</small>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
