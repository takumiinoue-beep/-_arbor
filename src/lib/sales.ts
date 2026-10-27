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

// ダッシュボードで入力した単価ごとの有効件数（confirmed_quantities の1行）
export type ConfirmedRow = {
  month: string; // "YYYY-MM-01"
  staff_id: string;
  project_name: string;
  unit_price: number;
  quantity: number;
};

// 確定の1行（月 × OP × 案件 × 単価）。確定金額＝有効件数×単価
export type ConfirmedLine = {
  month: string; // "YYYY-MM"
  staffId: string;
  projectName: string;
  unitPrice: number;
  quantity: number;
  amount: number;
};

// 有効件数の入力を、確定の行にする。
// ダッシュボードに出る行（その月・OP・案件・単価の獲得がある行）だけを対象にし、
// 獲得を削除して見えなくなった入力は含めない。
export function confirmedLines(args: {
  acquisitions: SalesAcquisition[];
  nameById: Map<string, string>; // 案件id -> 案件名
  confirmed: ConfirmedRow[];
}): ConfirmedLine[] {
  const { acquisitions, nameById, confirmed } = args;
  const shown = new Set<string>();
  for (const a of acquisitions) {
    const name = nameById.get(a.project_id);
    if (name) shown.add(`${acquisitionMonth(a)}|${a.staff_id}|${name}|${a.unit_price}`);
  }

  const lines: ConfirmedLine[] = [];
  for (const c of confirmed) {
    const month = c.month.slice(0, 7);
    if (!shown.has(`${month}|${c.staff_id}|${c.project_name}|${c.unit_price}`)) continue;
    const quantity = Number(c.quantity);
    lines.push({
      month,
      staffId: c.staff_id,
      projectName: c.project_name,
      unitPrice: Number(c.unit_price),
      quantity,
      amount: quantity * Number(c.unit_price),
    });
  }
  return lines;
}

// 売上（請求金額）をOP×月ごとに集計する。確定金額（有効件数×単価）を、その月に載せる。
// 戻り値: staff_id -> ("YYYY-MM" -> 金額)
export function monthlyBilledByStaff(lines: ConfirmedLine[]): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  for (const l of lines) {
    const months = result.get(l.staffId) ?? new Map<string, number>();
    months.set(l.month, (months.get(l.month) ?? 0) + l.amount);
    result.set(l.staffId, months);
  }
  for (const months of result.values()) {
    for (const [month, value] of months) months.set(month, Math.round(value));
  }
  return result;
}
