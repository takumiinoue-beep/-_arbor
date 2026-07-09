export type PeriodTab = "past" | "year" | "last_month" | "this_month" | "next_month";

export const PERIOD_TABS: { key: PeriodTab }[] = [
  { key: "past" },
  { key: "year" },
  { key: "last_month" },
  { key: "this_month" },
  { key: "next_month" },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
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

// 先月・当月・来月は「⚪︎月」という実際の月番号で表示する（案件一覧の月タブと表記を揃える）。
// 過去期間・年間はそのままのラベル。
export function getPeriodTabLabel(tab: PeriodTab, todayISO: string): string {
  const year = Number(todayISO.slice(0, 4));
  const month = Number(todayISO.slice(5, 7));

  switch (tab) {
    case "past":
      return "過去期間";
    case "year":
      return "年間";
    case "last_month":
      return `${shiftMonth(year, month, -1).month}月`;
    case "this_month":
      return `${month}月`;
    case "next_month":
      return `${shiftMonth(year, month, 1).month}月`;
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

// "YYYY-MM" を指定して、その月ちょうどの [start, end) 範囲を返す（過去期間タブの月選択用）
export function getExactMonthRange(yearMonth: string): { start: string; end: string } {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  const next = shiftMonth(year, month, 1);
  return { start: monthStart(year, month), end: monthStart(next.year, next.month) };
}

export function filterByExactMonth<T>(rows: T[], yearMonth: string, getDate: (row: T) => string): T[] {
  const { start, end } = getExactMonthRange(yearMonth);
  return rows.filter((row) => {
    const dateKey = getDate(row);
    return dateKey >= start && dateKey < end;
  });
}

export function formatYearMonth(yearMonth: string): string {
  return `${yearMonth.slice(0, 4)}年${Number(yearMonth.slice(5, 7))}月`;
}

// 半開区間 [start, end) に含まれる "YYYY-MM" の一覧を返す（月の繰り返し集計用）。
// start/end のどちらかが null（無制限）の場合は呼び出し側で個別対応する前提で空配列を返す。
export function monthKeysInRange(start: string | null, end: string | null): string[] {
  if (!start || !end) return [];

  const keys: string[] = [];
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  const endKey = end.slice(0, 7);
  let key = `${year}-${pad2(month)}`;

  while (key < endKey) {
    keys.push(key);
    const next = shiftMonth(year, month, 1);
    year = next.year;
    month = next.month;
    key = `${year}-${pad2(month)}`;
  }

  return keys;
}
