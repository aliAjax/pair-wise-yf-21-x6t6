// 日期与编号工具

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / 86400000);
}

export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  // 区间 [start, end) 重叠判定
  return aStart < bEnd && bStart < aEnd;
}

export function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return dateStr.slice(5); // MM-DD
}

export function fmtFull(dateStr: string | null): string {
  if (!dateStr) return "无交期";
  return dateStr;
}

let seq = 0;
export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

export function fmtTs(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}
