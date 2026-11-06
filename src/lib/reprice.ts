import { acquisitionMonth } from "@/lib/sales";
import { defaultUnitPrice, latestByName } from "@/lib/projects";

export type RepriceAcquisition = {
  id: string;
  acquired_date: string;
  target_month: string | null;
  project_id: string;
  staff_id: string;
  quantity: number;
  unit_price: number;
  position: string | null;
  employee_count: number | null;
};

export type RepriceProject = {
  id: string;
  name: string;
  start_date: string;
  unit_price: number;
  price_rates?: { position: string; employee_min: number; employee_max: number | null; unit_price: number }[] | null;
};

export type RepriceChange = {
  id: string;
  month: string; // 計上月 "YYYY-MM"
  staffId: string;
  projectName: string;
  quantity: number;
  oldPrice: number;
  newPrice: number;
};

// 登録済みの案件獲得について、案件一覧の「いまの」単価に直した場合の変更を求める。
// 獲得の登録のときと同じ決め方：登録した役職・従業員数が料金表に当てはまればその行の単価、
// 当てはまらない・料金表が無ければデフォルトの単価。変わらないものは含めない。
export function planRepricing(acquisitions: RepriceAcquisition[], projects: RepriceProject[]): RepriceChange[] {
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const master = latestByName(projects);

  const changes: RepriceChange[] = [];
  for (const a of acquisitions) {
    const name = nameById.get(a.project_id);
    const project = name ? master.get(name) : undefined;
    if (!name || !project) continue;

    const count = a.employee_count;
    const rate =
      a.position && count !== null
        ? (project.price_rates ?? []).find(
            (r) => r.position === a.position && count >= r.employee_min && (r.employee_max === null || count <= r.employee_max)
          )
        : undefined;
    const newPrice = rate ? Number(rate.unit_price) : defaultUnitPrice(project);
    const oldPrice = Number(a.unit_price);
    if (!(newPrice > 0) || newPrice === oldPrice) continue;

    changes.push({
      id: a.id,
      month: acquisitionMonth(a),
      staffId: a.staff_id,
      projectName: name,
      quantity: a.quantity,
      oldPrice,
      newPrice,
    });
  }
  return changes;
}

// 有効件数の付け替え先。
// 同じ（月・OP・案件・旧単価）の獲得が、すべて新しい単価に変わるときだけ付け替える
// （一部しか変わらないと、入力済みの有効件数を分けられないため、そのまま残す）。
// 複数の新単価に分かれるときは、件数が一番多い新単価にまとめる。
export function planMoves(changes: RepriceChange[], acquisitions: RepriceAcquisition[], projects: RepriceProject[]) {
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const totalInGroup = new Map<string, number>();
  for (const a of acquisitions) {
    const name = nameById.get(a.project_id);
    if (!name) continue;
    const key = `${acquisitionMonth(a)}|${a.staff_id}|${name}|${Number(a.unit_price)}`;
    totalInGroup.set(key, (totalInGroup.get(key) ?? 0) + 1);
  }

  const groups = new Map<
    string,
    { month: string; staffId: string; projectName: string; oldPrice: number; count: number; byNew: Map<number, number> }
  >();
  for (const c of changes) {
    const key = `${c.month}|${c.staffId}|${c.projectName}|${c.oldPrice}`;
    const g = groups.get(key) ?? {
      month: c.month,
      staffId: c.staffId,
      projectName: c.projectName,
      oldPrice: c.oldPrice,
      count: 0,
      byNew: new Map<number, number>(),
    };
    g.count += 1;
    g.byNew.set(c.newPrice, (g.byNew.get(c.newPrice) ?? 0) + c.quantity);
    groups.set(key, g);
  }

  return Array.from(groups, ([key, g]) => ({ key, g }))
    .filter(({ key, g }) => g.count === (totalInGroup.get(key) ?? 0))
    .map(({ g }) => ({
      month: `${g.month}-01`,
      staff_id: g.staffId,
      project_name: g.projectName,
      old_price: g.oldPrice,
      new_price: Array.from(g.byNew).sort((a, b) => b[1] - a[1])[0][0],
    }));
}
