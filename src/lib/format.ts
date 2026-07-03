export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(value);
}

export function formatPercent(actual: number, budget: number): string {
  if (!budget) return "-";
  return `${((actual / budget) * 100).toFixed(1)}%`;
}

export function formatDate(value: string | null): string {
  if (!value) return "-";
  return value;
}
