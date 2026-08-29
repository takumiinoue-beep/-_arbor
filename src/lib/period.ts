export function formatYearMonth(yearMonth: string): string {
  return `${yearMonth.slice(0, 4)}年${Number(yearMonth.slice(5, 7))}月`;
}
