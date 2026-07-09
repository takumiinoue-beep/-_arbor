import type { FixedCost } from "@/types/database";
import { getPeriodRange, monthKeysInRange, type PeriodTab } from "./period";

// 対象年月＝その固定費が発生し始める月。発生周期に応じて、指定した月に
// 計上すべきかどうかを判定する。
// - 単発: 対象年月ちょうどの月のみ
// - 毎月: 対象年月以降のすべての月（家賃など、削除するまで毎月かかる費用）
// - 毎年: 対象年月と同じ月（1〜12月）で、対象年月以降の年
function costAppliesToMonth(cost: FixedCost, monthKey: string): boolean {
  const costMonthKey = cost.target_month.slice(0, 7);

  switch (cost.period_type) {
    case "単発":
      return costMonthKey === monthKey;
    case "毎月":
      return monthKey >= costMonthKey;
    case "毎年":
      return monthKey.slice(5, 7) === costMonthKey.slice(5, 7) && monthKey >= costMonthKey;
  }
}

// 対象の月群それぞれについて計上される固定費行を集める。
// 毎月/毎年の固定費は該当する月ごとに1回ずつ含まれるため、複数月にまたがる
// 期間（年間タブなど）では同じ固定費が複数回登場する＝合計計算用の展開結果。
function expandForMonths(costs: FixedCost[], monthKeys: string[]): FixedCost[] {
  const result: FixedCost[] = [];
  for (const monthKey of monthKeys) {
    for (const cost of costs) {
      if (costAppliesToMonth(cost, monthKey)) result.push(cost);
    }
  }
  return result;
}

export function filterFixedCostsByPeriod(
  costs: FixedCost[],
  tab: PeriodTab,
  todayISO: string
): FixedCost[] {
  const { start, end } = getPeriodRange(tab, todayISO);
  const monthKeys = monthKeysInRange(start, end);
  return expandForMonths(costs, monthKeys);
}

export function filterFixedCostsByExactMonth(costs: FixedCost[], yearMonth: string): FixedCost[] {
  return expandForMonths(costs, [yearMonth]);
}
