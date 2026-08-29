import type { ProjectWithStaff } from "@/types/database";

export type EffectiveCounts = {
  budgetQty: number;
  actualQty: number;
  confirmedQty: number;
  confirmedAmount: number;
};

// 予算件数・実績件数・確定件数・確定金額を返す。料金表の行がある案件は
// 行ごとの合計、無い案件は案件本体の値を使う。
export function getEffectiveCounts(p: ProjectWithStaff): EffectiveCounts {
  const rates = p.price_rates;
  if (rates && rates.length > 0) {
    return {
      budgetQty: rates.reduce((sum, r) => sum + r.quantity, 0),
      actualQty: rates.reduce((sum, r) => sum + r.actual_quantity, 0),
      confirmedQty: rates.reduce((sum, r) => sum + r.confirmed_quantity, 0),
      confirmedAmount: rates.reduce((sum, r) => sum + r.unit_price * r.confirmed_quantity, 0),
    };
  }
  return {
    budgetQty: p.quantity,
    actualQty: p.actual_quantity,
    confirmedQty: p.confirmed_quantity,
    confirmedAmount: p.unit_price * p.confirmed_quantity,
  };
}

export function sumEffectiveCounts(projects: ProjectWithStaff[]): EffectiveCounts {
  return projects.reduce(
    (acc, p) => {
      const c = getEffectiveCounts(p);
      acc.budgetQty += c.budgetQty;
      acc.actualQty += c.actualQty;
      acc.confirmedQty += c.confirmedQty;
      acc.confirmedAmount += c.confirmedAmount;
      return acc;
    },
    { budgetQty: 0, actualQty: 0, confirmedQty: 0, confirmedAmount: 0 }
  );
}
