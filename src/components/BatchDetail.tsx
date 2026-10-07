import type { AppState, Batch } from "../types";
import { addDays } from "../lib/date";

interface Props {
  state: AppState;
  batch: Batch | null;
  onAdvance: (id: string) => void;
}

const NEXT_LABEL: Partial<Record<Batch["status"], string>> = {
  scheduled: "确认开染（占用锁定）",
  in_progress: "标记染线完成",
  dyed: "照旧入库",
};

const STATUS_TEXT: Record<Batch["status"], string> = {
  queued: "排队待排",
  scheduled: "已占槽未开染",
  in_progress: "在染中（停机不可释放）",
  dyed: "已染好待入库",
  stored: "已入库（记录锁定）",
};

export default function BatchDetail({ state, batch, onAdvance }: Props) {
  if (!batch) {
    return (
      <section className="panel detail-empty">
        <p className="muted">在左侧批次或甘特图中点选一个批次，查看纹样档案、色卡与工序流水。</p>
      </section>
    );
  }

  const arc = state.archives.find((a) => a.id === batch.archiveId);
  const card = state.cards.find((c) => c.id === batch.cardId);
  const receipts = state.receipts.filter((r) => r.batchNo === batch.id);

  return (
    <section className="panel detail">
      <div className="heading">
        <div>
          <p>批次详情</p>
          <h2>
            {batch.id}{" "}
            {batch.source === "legacy" && (
              <span className="legacy-tag big">旧档升级</span>
            )}
            {batch.outsourced && <span className="out-tag big">外协</span>}
          </h2>
        </div>
        {NEXT_LABEL[batch.status] && (
          <button className="primary" onClick={() => onAdvance(batch.id)}>
            {NEXT_LABEL[batch.status]}
          </button>
        )}
      </div>

      <div className="status-line">
        <span className={"status s-" + batch.status}>{STATUS_TEXT[batch.status]}</span>
        <span className={batch.priority === "urgent" ? "urgent-tag big" : ""}>
          {batch.loanKind === "loan" ? "馆藏借展" : "私人订单"} ·{" "}
          {batch.priority === "urgent" ? "加急" : "普通"}
        </span>
      </div>

      {batch.note && <p className="note-box">{batch.note}</p>}

      <div className="detail-grid">
        <div>
          <h3>纹样档案</h3>
          {arc ? (
            <dl>
              <dt>档案号 / 名称</dt>
              <dd>{arc.id} · {arc.title}</dd>
              <dt>产地 / 年代</dt>
              <dd>{arc.origin} · {arc.era}</dd>
              <dt>结密度 / 材质</dt>
              <dd>{arc.knotDensity} 结/英寸 · {arc.material}</dd>
              <dt>原染色类型</dt>
              <dd>
                {{ plant: "植物染", mineral: "矿物染", chemical: "化学染" }[arc.dyeType]}
              </dd>
              <dt>破损区域</dt>
              <dd>{arc.damage}</dd>
            </dl>
          ) : (
            <p className="muted">旧记录引用的档案 {batch.archiveId} 暂缺，仍可打开查看。</p>
          )}
        </div>

        <div>
          <h3>材料色卡与占用</h3>
          {card ? (
            <div className="card-block">
              <div className="card-chip">
                <i className="swatch big" style={{ background: card.color }} />
                <div>
                  <b>{card.name}</b>
                  <small>
                    {card.id} · {{ plant: "植物染", mineral: "矿物染", chemical: "化学染" }[card.dyeType]}
                  </small>
                </div>
              </div>
              <p className="muted recipe">{card.recipe}</p>
            </div>
          ) : (
            <p className="muted">色卡 {batch.cardId} 缺失。</p>
          )}
          <dl>
            <dt>色卡批次</dt>
            <dd>{batch.cardLot}</dd>
            <dt>染线用量</dt>
            <dd>{batch.quantity} {card?.unit ?? "绞"}</dd>
            <dt>交期</dt>
            <dd>D{batch.dueDay}（{addDays(state.baseDate, batch.dueDay)}）</dd>
            <dt>槽位 / 开染</dt>
            <dd>
              {batch.slotId ? `${batch.slotId} @ D${batch.startDay}` : "待分配"}
            </dd>
          </dl>
        </div>
      </div>

      <h3>工序流水（只增不改）</h3>
      <ul className="history">
        {batch.history.map((h) => (
          <li key={h.id} className={h.confirmed ? "confirmed" : ""}>
            <div>
              <b>{h.step}</b>
              <span>{h.by} · {h.at.replace("T", " ")}</span>
            </div>
            {h.confirmed && <em className="confirmed-tag">已确认·锁定</em>}
          </li>
        ))}
        {batch.history.length === 0 && (
          <li className="muted">暂无工序记录。</li>
        )}
      </ul>

      {receipts.length > 0 && (
        <>
          <h3>该批次外协回执</h3>
          <ul className="history">
            {receipts.map((r) => (
              <li key={r.id}>
                <div>
                  <b>
                    {r.workshop} · 色卡批次 {r.cardLot} / 用量 {r.quantity}
                  </b>
                  <span>{r.detail}</span>
                </div>
                <em className={"rcp-tag r-" + r.status}>
                  {{ matched: "一致", duplicate: "重复", mismatch: "不一致留待", unknown: "查无批次" }[r.status]}
                </em>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
