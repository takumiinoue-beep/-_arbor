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

// ダッシュボードで入力した有効件数（confirmed_totals の1行）。月 × 案件 × 単価ごとの、全OPの合計
export type ConfirmedRow = {
  month: string; // "YYYY-MM-01"
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
  quantity: number; // OPごとの有効件数（合計を、獲得件数の比率で按分した値）
  amount: number;
};

// 入力した有効件数（合計）を、OPごとの行に按分する。
// その月・案件・単価の獲得があるものだけが対象で、獲得を削除して見えなくなった入力は含めない。
// 按分は、そのOPの獲得件数 ÷ 全OPの獲得件数。
export function confirmedLines(args: {
  acquisitions: SalesAcquisition[];
  nameById: Map<string, string>; // 案件id -> 案件名
  confirmed: ConfirmedRow[];
}): ConfirmedLine[] {
  const { acquisitions, nameById, confirmed } = args;

  // 月|案件名|単価 -> OPごとの獲得件数
  const groups = new Map<string, Map<string, number>>();
  for (const a of acquisitions) {
    const name = nameById.get(a.project_id);
    if (!name) continue;
    const key = `${acquisitionMonth(a)}|${name}|${a.unit_price}`;
    const byStaff = groups.get(key) ?? new Map<string, number>();
    byStaff.set(a.staff_id, (byStaff.get(a.staff_id) ?? 0) + a.quantity);
    groups.set(key, byStaff);
  }

  const lines: ConfirmedLine[] = [];
  for (const c of confirmed) {
    const month = c.month.slice(0, 7);
    const byStaff = groups.get(`${month}|${c.project_name}|${c.unit_price}`);
    if (!byStaff) continue;
    const acquiredTotal = Array.from(byStaff.values()).reduce((sum, q) => sum + q, 0);
    if (acquiredTotal <= 0) continue;
    for (const [staffId, acquiredQty] of byStaff) {
      const quantity = (Number(c.quantity) * acquiredQty) / acquiredTotal;
      lines.push({
        month,
        staffId,
        projectName: c.project_name,
        unitPrice: Number(c.unit_price),
        quantity,
        amount: quantity * Number(c.unit_price),
      });
    }
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
