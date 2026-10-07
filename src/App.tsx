import { useState } from "react";
import "./styles.css";
import { useStore } from "./store";
import ScheduleBoard from "./components/ScheduleBoard";
import BatchList from "./components/BatchList";
import BatchDetail from "./components/BatchDetail";
import NewBatchForm from "./components/NewBatchForm";
import ControlPanel from "./components/ControlPanel";
import ReceiptPanel from "./components/ReceiptPanel";
import { ArchivesPanel, LogPanel } from "./components/ReferencePanels";
import type { Batch } from "./types";

type Tab = "board" | "data";

function App() {
  const {
    state,
    notice,
    stats,
    replanAll,
    fillQueue,
    setDowntime,
    clearDowntime,
    advanceBatch,
    addBatch,
    receiveReceipt,
    adjudicateReceipt,
    resetAll,
  } = useStore();

  const [tab, setTab] = useState<Tab>("board");
  const [selectedId, setSelectedId] = useState<string | null>(
    state.batches[0]?.id ?? null
  );

  const selected: Batch | null =
    state.batches.find((b) => b.id === selectedId) ?? null;

  const queueItems = state.batches.filter((b) => b.status === "queued");

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <h1>染线排产台</h1>
          <span className="subtitle">
            纹样档案 · 修复批次 · 材料色卡 · 染线槽 联动排产
          </span>
        </div>
        <nav className="tabs">
          <button
            className={tab === "board" ? "active" : ""}
            onClick={() => setTab("board")}
          >
            排产与对账
          </button>
          <button
            className={tab === "data" ? "active" : ""}
            onClick={() => setTab("data")}
          >
            纹样与色卡
          </button>
          <button className="ghost reset" onClick={resetAll}>
            重置演示数据
          </button>
        </nav>
      </header>

      <section className="metrics">
        <Metric label="批次总数" value={stats.total} />
        <Metric label="已占槽" value={stats.scheduled} tone="ok" />
        <Metric label="在染" value={stats.inProgress} tone="ok" />
        <Metric label="排队待排" value={stats.queued} tone={stats.queued ? "warn" : undefined} />
        <Metric label="超期风险" value={stats.overdue} tone={stats.overdue ? "bad" : undefined} />
        <Metric label="已染/入库" value={stats.stored} />
        <Metric
          label="回执留待处理"
          value={stats.pendingReceipts}
          tone={stats.pendingReceipts ? "bad" : undefined}
        />
      </section>

      {notice && <div className="notice">{notice}</div>}

      {tab === "board" && (
        <>
          <section className="panel">
            <div className="heading">
              <div>
                <p>槽位排产甘特</p>
                <h2>同一槽·日只容一批 · 加急优先占位</h2>
              </div>
              <div className="btn-row">
                <button onClick={fillQueue}>排队单补位</button>
                <button className="primary" onClick={replanAll}>
                  按加急重排
                </button>
              </div>
            </div>
            <ScheduleBoard
              state={state}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {queueItems.length > 0 && (
              <div className="queue-strip">
                <b>排队队列（交期保留，容量释放后按加急顺延）：</b>
                {queueItems
                  .slice()
                  .sort((a, b) =>
                    a.priority === b.priority
                      ? a.dueDay - b.dueDay
                      : a.priority === "urgent"
                      ? -1
                      : 1
                  )
                  .map((b) => (
                    <button
                      key={b.id}
                      className={"queue-pill" + (b.priority === "urgent" ? " urgent" : "")}
                      onClick={() => setSelectedId(b.id)}
                    >
                      {b.id}
                      <small>
                        {b.priority === "urgent" ? "加急" : "普通"} · 交期 D{b.dueDay}
                      </small>
                    </button>
                  ))}
              </div>
            )}
          </section>

          <div className="two-col">
            <ControlPanel
              state={state}
              onSetDowntime={setDowntime}
              onClearDowntime={clearDowntime}
              onReplan={replanAll}
              onFill={fillQueue}
            />
            <ReceiptPanel
              state={state}
              onReceive={receiveReceipt}
              onAdjudicate={adjudicateReceipt}
            />
          </div>

          <NewBatchForm state={state} onAdd={addBatch} />

          <div className="two-col wide-left">
            <BatchList
              state={state}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <BatchDetail state={state} batch={selected} onAdvance={advanceBatch} />
          </div>

          <LogPanel state={state} />
        </>
      )}

      {tab === "data" && <ArchivesPanel state={state} />}
    </main>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "bad";
}) {
  return (
    <article className={"metric" + (tone ? " " + tone : "")}>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

export default App;
