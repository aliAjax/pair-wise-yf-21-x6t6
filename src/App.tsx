import { useState } from "react";
import { StoreProvider, useStore } from "./store";
import Board from "./components/Board";
import Batches from "./components/Batches";
import Patterns from "./components/Patterns";
import Cards from "./components/Cards";
import Slots from "./components/Slots";
import Receipts from "./components/Receipts";
import Logs from "./components/Logs";

const TABS = [
  { key: "board", label: "排产台" },
  { key: "batches", label: "修复批次" },
  { key: "patterns", label: "纹样档案" },
  { key: "cards", label: "材料色卡" },
  { key: "slots", label: "槽位" },
  { key: "receipts", label: "外协回执" },
  { key: "logs", label: "操作日志" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function Metrics() {
  const { batches, receipts, slots } = useStore();
  const running = slots.filter((s) => s.status === "运行中").length;
  const queued = batches.filter((b) => b.status === "待分配").length;
  const dyeing = batches.filter((b) => b.status === "染机上").length;
  const done = batches.filter((b) => b.status === "已入库").length;
  const pendingReceipts = receipts.filter((r) => r.status === "待对账").length;
  const items = [
    { label: "运行槽位", value: `${running}/${slots.length}` },
    { label: "排队批次", value: queued },
    { label: "染色中", value: dyeing },
    { label: "已入库", value: done },
    { label: "待对账回执", value: pendingReceipts },
  ];
  return (
    <section className="metrics">
      {items.map((m) => (
        <article key={m.label}>
          <small>{m.label}</small>
          <strong>{m.value}</strong>
        </article>
      ))}
    </section>
  );
}

function Shell() {
  const [tab, setTab] = useState<TabKey>("board");
  const { resetAll } = useStore();

  return (
    <main className="app">
      <section className="hero">
        <div className="hero-top">
          <div>
            <p>地毯修复 · 共享染槽排产台</p>
            <h1>染槽排产台</h1>
          </div>
          <button className="mini" onClick={resetAll}>
            重置演示数据
          </button>
        </div>
        <span>
          把纹样档案、修复批次、材料色卡与染槽槽位接起来：同一槽位同一时段只容纳一个批次，
          按加急顺序占位，容量满时保留交期并排队；染机停机/维护后未开始批次释放占用、按剩余容量顺延，
          已染好的照旧入库；外协回执按批次号与本院记录对账，色卡批次或用量不一致先留待处理，
          后到回执不改写已确认工序；旧数据缺交期与槽位号，升级为普通单与待分配，原记录仍可打开。
        </span>
      </section>

      <Metrics />

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="tab-body">
        {tab === "board" && <Board />}
        {tab === "batches" && <Batches />}
        {tab === "patterns" && <Patterns />}
        {tab === "cards" && <Cards />}
        {tab === "slots" && <Slots />}
        {tab === "receipts" && <Receipts />}
        {tab === "logs" && <Logs />}
      </div>
    </main>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
