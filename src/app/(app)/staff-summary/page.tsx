import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ProjectWithStaff } from "@/types/database";
import { aggregateByStaff } from "@/lib/aggregate";
import { formatCurrency, formatPercent } from "@/lib/format";
import { BudgetActualBarChart } from "@/components/charts/BudgetActualBarChart";

export default async function StaffSummaryPage() {
  await requireProfile();
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("*, staff:profiles!projects_staff_id_fkey(id, name)");

  const staffAgg = aggregateByStaff((projects as ProjectWithStaff[]) ?? []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">担当者別集計</h1>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <BudgetActualBarChart
          data={staffAgg.map((s) => ({ staffName: s.staffName, budget: s.budget, actual: s.actual }))}
          nameKey="staffName"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">担当者</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">予算合計</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">実績合計</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">差異</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">達成率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staffAgg.map((s) => {
              const diff = s.actual - s.budget;
              return (
                <tr key={s.staffId} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{s.staffName}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(s.budget)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(s.actual)}</td>
                  <td
                    className={`px-3 py-2 text-right ${diff >= 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {formatCurrency(diff)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {formatPercent(s.actual, s.budget)}
                  </td>
                </tr>
              );
            })}
            {staffAgg.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  データがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
