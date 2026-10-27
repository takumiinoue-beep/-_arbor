export type SalesAcquisition = {
  acquired_date: string;
  target_month?: string | null;
  quantity: number;
  unit_price: number;
  staff_id: string;
  project_id: string;
};

// その獲得を計上する月（"YYYY-MM"）。来月のアポなどは計上月を別に持ち、無ければ獲得日の月
export function acquisitionMonth(a: { acquired_date: string; target_month?: string | null }): string {
  return (a.target_month ?? a.acquired_date).slice(0, 7);
}

// 売上（請求金額）をOP×月ごとに集計する。
// 獲得金額（単価×件数）に有効率を掛けた金額を、その獲得を計上する月に載せる。
// 戻り値: staff_id -> ("YYYY-MM" -> 金額)
export function monthlyBilledByStaff(args: {
  acquisitions: SalesAcquisition[];
  rateOf: (month: string, staffId: string, projectId: string) => number; // 有効率（%）
}): Map<string, Map<string, number>> {
  const { acquisitions, rateOf } = args;
  const result = new Map<string, Map<string, number>>();
  for (const a of acquisitions) {
    const month = acquisitionMonth(a);
    const billed = (a.unit_price * a.quantity * rateOf(month, a.staff_id, a.project_id)) / 100;
    const months = result.get(a.staff_id) ?? new Map<string, number>();
    months.set(month, (months.get(month) ?? 0) + billed);
    result.set(a.staff_id, months);
  }
  for (const months of result.values()) {
    for (const [month, value] of months) months.set(month, Math.round(value));
  }
  return result;
}
