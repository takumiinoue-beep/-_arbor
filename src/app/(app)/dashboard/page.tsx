import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ProjectWithStaff } from "@/types/database";
import { aggregateByStaff, aggregateByMonth, sumBudget, sumActual } from "@/lib/aggregate";
import { formatCurrency, formatPercent } from "@/lib/format";
import { SummaryCard } from "@/components/SummaryCard";
import { BudgetActualBarChart } from "@/components/charts/BudgetActualBarChart";
import { MonthlyLineChart } from "@/components/charts/MonthlyLineChart";

export default async function DashboardPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: projects }, { data: fixedCosts }] = await Promise.all([
    supabase.from("projects").select("*, staff:profiles!projects_staff_id_fkey(id, name)"),
    supabase.from("fixed_costs").select("*"),
  ]);

  const projectList = (projects as ProjectWithStaff[]) ?? [];
  const budget = sumBudget(projectList);
  const actual = sumActual(projectList);
  const fixedCostTotal = (fixedCosts ?? []).reduce((sum, f) => sum + f.amount, 0);
  const grossProfit = actual - fixedCostTotal;

  const staffAgg = aggregateByStaff(projectList);
  const monthlyAgg = aggregateByMonth(projectList);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">ダッシュボード</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="予算合計" value={formatCurrency(budget)} />
        <SummaryCard label="実績合計" value={formatCurrency(actual)} />
        <SummaryCard
          label="達成率"
          value={formatPercent(actual, budget)}
          tone={actual >= budget ? "positive" : "negative"}
        />
        <SummaryCard label="固定費合計" value={formatCurrency(fixedCostTotal)} />
        <SummaryCard
          label="粗利（実績－固定費）"
          value={formatCurrency(grossProfit)}
          tone={grossProfit >= 0 ? "positive" : "negative"}
        />
      </div>
      <p className="-mt-3 text-xs text-slate-400">
        ※ 固定費合計は登録済みの固定費（毎月・毎年・単発を問わず）の金額単純合計です。粗利は実績合計から固定費合計を差し引いた参考値です。
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">担当者別 予算・実績</h2>
          <BudgetActualBarChart
            data={staffAgg.map((s) => ({ staffName: s.staffName, budget: s.budget, actual: s.actual }))}
            nameKey="staffName"
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">月別 売上推移</h2>
          <MonthlyLineChart data={monthlyAgg} />
        </div>
      </div>
    </div>
  );
}
