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

// 有効件数の入力。OPごとの入力（confirmed_quantities）が主で、
// 以前に入力した月×案件×単価の合計（confirmed_totals）は、OPごとの入力が無い行の初期値として使う
export type ConfirmedRow = {
  month: string; // "YYYY-MM-01"
  project_name: string;
  unit_price: number;
  quantity: number; // 全OPの合計
};
export type ConfirmedOpRow = ConfirmedRow & { staff_id: string }; // quantity はそのOPの有効件数
export type ConfirmedData = { totals: ConfirmedRow[]; perOp: ConfirmedOpRow[] };

// 確定の1行（月 × OP × 案件 × 単価）。確定金額＝有効件数×単価
export type ConfirmedLine = {
  month: string; // "YYYY-MM"
  staffId: string;
  projectName: string;
  unitPrice: number;
  quantity: number; // そのOPの有効件数
  amount: number;
};

// 入力した有効件数を、OPごとの行にする。
// その月・案件・単価の獲得があるOPだけが対象で、獲得を削除して見えなくなった入力は含めない。
// OPごとの入力があればそれを使い、無ければ、合計の入力を獲得件数の比率で按分した値、それも無ければ0件。
export function confirmedLines(args: {
  acquisitions: SalesAcquisition[];
  nameById: Map<string, string>; // 案件id -> 案件名
  confirmed: ConfirmedData;
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

  const totalBy = new Map(
    confirmed.totals.map((c) => [`${c.month.slice(0, 7)}|${c.project_name}|${Number(c.unit_price)}`, Number(c.quantity)])
  );
  const perOpBy = new Map(
    confirmed.perOp.map((c) => [
      `${c.month.slice(0, 7)}|${c.project_name}|${Number(c.unit_price)}|${c.staff_id}`,
      Number(c.quantity),
    ])
  );

  const lines: ConfirmedLine[] = [];
  for (const [key, byStaff] of groups) {
    const [month, projectName, unitPriceText] = key.split("|");
    const unitPrice = Number(unitPriceText);
    const acquiredTotal = Array.from(byStaff.values()).reduce((sum, q) => sum + q, 0);
    const total = totalBy.get(key);
    for (const [staffId, acquiredQty] of byStaff) {
      const own = perOpBy.get(`${key}|${staffId}`);
      const quantity =
        own !== undefined ? own : total !== undefined && acquiredTotal > 0 ? (total * acquiredQty) / acquiredTotal : 0;
      if (quantity === 0) continue;
      lines.push({ month, staffId, projectName, unitPrice, quantity, amount: quantity * unitPrice });
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
