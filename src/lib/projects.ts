// 案件は案件名ごとに1つの案件として登録する。
// 以前は月ごとに同じ名前の案件を作っていたため、同じ名前が複数ある場合は一番新しいものを案件として扱う
// （過去の獲得はそのまま残り、案件名で結びつける）。
export function latestByName<T extends { name: string; start_date: string }>(projects: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const p of projects) {
    const cur = map.get(p.name);
    if (!cur || p.start_date > cur.start_date) map.set(p.name, p);
  }
  return map;
}

// 案件のデフォルト単価。0円のときは、料金表があればその平均を使う
export function defaultUnitPrice(p: { unit_price: number; price_rates?: { unit_price: number }[] | null }): number {
  const price = Number(p.unit_price);
  if (price > 0) return price;
  const rates = p.price_rates ?? [];
  if (rates.length === 0) return 0;
  return Math.round(rates.reduce((sum, r) => sum + Number(r.unit_price), 0) / rates.length);
}

export type RateProject = { id: string; name: string; start_date: string; effective_rate: number };
export type RateAssignment = { month: string; staff_id: string; project_id: string; effective_rate: number };

// 獲得の有効率（%）を返す関数を作る。
// その月・そのOPの案件設定に有効率があればそれを、無ければ案件一覧のデフォルトの有効率（無ければ100%）を使う。
export function createRateResolver(projects: RateProject[], assignments: RateAssignment[]) {
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const defaultByName = new Map(
    Array.from(latestByName(projects), ([name, p]) => [name, Number(p.effective_rate)] as const)
  );
  const assigned = new Map<string, number>();
  for (const a of assignments) {
    const name = nameById.get(a.project_id);
    if (name) assigned.set(`${a.month.slice(0, 7)}|${a.staff_id}|${name}`, Number(a.effective_rate));
  }
  return (month: string, staffId: string, projectId: string): number => {
    const name = nameById.get(projectId);
    if (!name) return 100;
    return assigned.get(`${month}|${staffId}|${name}`) ?? defaultByName.get(name) ?? 100;
  };
}
