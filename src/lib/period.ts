export type PeriodTab = "past" | "year" | "last_month" | "this_month" | "next_month";

export const PERIOD_TABS: { key: PeriodTab; label: string }[] = [
  { key: "past", label: "過去期間" },
  { key: "year", label: "年間" },
  { key: "last_month", label: "先月" },
  { key: "this_month", label: "当月" },
  { key: "next_month", label: "来月" },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function monthStart(year: number, month: number): string {
  return `${year}-${pad2(month)}-01`;
}

// 各タブの対象範囲を [start, end) の半開区間で返す（date文字列の比較でそのまま使える）。
// start が null は「下限なし」、end が null は「上限なし」を表す。
export function getPeriodRange(
  tab: PeriodTab,
  todayISO: string
): { start: string | null; end: string | null } {
  const year = Number(todayISO.slice(0, 4));
  const month = Number(todayISO.slice(5, 7));

  switch (tab) {
    case "this_month": {
      const next = shiftMonth(year, month, 1);
      return { start: monthStart(year, month), end: monthStart(next.year, next.month) };
    }
    case "last_month": {
      const prev = shiftMonth(year, month, -1);
      return { start: monthStart(prev.year, prev.month), end: monthStart(year, month) };
    }
    case "next_month": {
      const next = shiftMonth(year, month, 1);
      const nextNext = shiftMonth(year, month, 2);
      return { start: monthStart(next.year, next.month), end: monthStart(nextNext.year, nextNext.month) };
    }
    case "year":
      return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
    case "past":
      return { start: null, end: monthStart(year, month) };
  }
}

export function filterByPeriod<T>(
  rows: T[],
  tab: PeriodTab,
  todayISO: string,
  getDate: (row: T) => string
): T[] {
  const { start, end } = getPeriodRange(tab, todayISO);
  return rows.filter((row) => {
    const dateKey = getDate(row);
    if (start && dateKey < start) return false;
    if (end && dateKey >= end) return false;
    return true;
  });
}
