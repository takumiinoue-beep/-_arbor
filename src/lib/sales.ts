export type SalesAcquisition = {
  acquired_date: string;
  quantity: number;
  unit_price: number;
  staff_id: string;
  project_id: string;
  rate_id: string | null;
};

export type OpConfirmedRecord = {
  project_id: string;
  rate_id: string | null;
  staff_id: string;
  confirmed_quantity: number;
};

// 売上（請求金額）をOP×月ごとに集計する。
// ダッシュボードの請求金額（単価×OPごとの有効件数）と同じ金額を、
// 獲得件数の月別の比率で各月に按分する（有効件数は月ごとの値を持たないため）。
// 戻り値: staff_id -> ("YYYY-MM" -> 金額)
export function monthlyBilledByStaff(args: {
  acquisitions: SalesAcquisition[];
  opConfirmed: OpConfirmedRecord[];
  sharedConfirmed: Map<string, number>; // "projectId:rateId" -> 案件・料金表の確定件数
}): Map<string, Map<string, number>> {
  const { acquisitions, opConfirmed, sharedConfirmed } = args;
  const targetKey = (projectId: string, rateId: string | null) => `${projectId}:${rateId ?? ""}`;

  const opsByTarget = new Map<string, Set<string>>();
  for (const a of acquisitions) {
    const k = targetKey(a.project_id, a.rate_id);
    const set = opsByTarget.get(k) ?? new Set<string>();
    set.add(a.staff_id);
    opsByTarget.set(k, set);
  }

  const recordMap = new Map<string, number>();
  for (const r of opConfirmed) {
    recordMap.set(`${targetKey(r.project_id, r.rate_id)}:${r.staff_id}`, r.confirmed_quantity);
  }

  type Group = {
    staffId: string;
    unitPrice: number;
    effectiveQty: number;
    totalQty: number;
    byMonth: Map<string, number>;
  };
  const groups = new Map<string, Group>();

  for (const a of acquisitions) {
    const tk = targetKey(a.project_id, a.rate_id);
    const key = `${a.staff_id}:${tk}:${a.unit_price}`;
    let g = groups.get(key);
    if (!g) {
      const shared = sharedConfirmed.get(tk) ?? 0;
      const effectiveQty = recordMap.get(`${tk}:${a.staff_id}`) ?? (opsByTarget.get(tk)?.size === 1 ? shared : 0);
      g = { staffId: a.staff_id, unitPrice: a.unit_price, effectiveQty, totalQty: 0, byMonth: new Map() };
      groups.set(key, g);
    }
    const month = a.acquired_date.slice(0, 7);
    g.totalQty += a.quantity;
    g.byMonth.set(month, (g.byMonth.get(month) ?? 0) + a.quantity);
  }

  const result = new Map<string, Map<string, number>>();
  for (const g of groups.values()) {
    if (g.totalQty <= 0 || g.effectiveQty <= 0) continue;
    const billed = g.unitPrice * g.effectiveQty;
    const staffMonths = result.get(g.staffId) ?? new Map<string, number>();
    for (const [month, qty] of g.byMonth) {
      staffMonths.set(month, (staffMonths.get(month) ?? 0) + Math.round((billed * qty) / g.totalQty));
    }
    result.set(g.staffId, staffMonths);
  }
  return result;
}
