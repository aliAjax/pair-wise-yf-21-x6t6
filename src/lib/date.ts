// 以固定基准日做排产时钟（演示用），停机/顺延都基于相对天数。
export const BASE_DATE = "2026-10-07";

export function addDays(base: string, n: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayLabel(base: string, n: number): string {
  const d = new Date(addDays(base, n) + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function weekdayLabel(base: string, n: number): string {
  const names = ["日", "一", "二", "三", "四", "五", "六"];
  const d = new Date(addDays(base, n) + "T00:00:00");
  return "周" + names[d.getDay()];
}

export function nowStamp(): string {
  // 演示环境用基准日期 + 时刻，保证可复现
  return BASE_DATE + "T09:00:00";
}

let seq = 0;
export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}${seq}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}
