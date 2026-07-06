import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ProjectWithStaff } from "@/types/database";
import {
  aggregateByStaff,
  aggregateByMonth,
  projectsGroupedByStaff,
  computeStaffGroupBands,
} from "@/lib/aggregate";
import { MonthlyLineChart } from "@/components/charts/MonthlyLineChart";
import { StaffSharePieChart } from "@/components/charts/StaffSharePieChart";
import { StaffGroupedProjectBarChart } from "@/components/charts/StaffGroupedProjectBarChart";

export default async function ChartsPage() {
  await requireProfile();
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("*, staff:profiles!projects_staff_id_fkey(id, name)")
    .order("start_date");

  const projectList = (projects as ProjectWithStaff[]) ?? [];
  const staffAgg = aggregateByStaff(projectList);
  const monthlyAgg = aggregateByMonth(projectList);
  const staffProjectRows = projectsGroupedByStaff(projectList);
  const staffGroupBands = computeStaffGroupBands(staffProjectRows);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">グラフ</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            担当者別 予算・実績比較（案件別内訳）
          </h2>
          <StaffGroupedProjectBarChart data={staffProjectRows} bands={staffGroupBands} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">月別 売上推移</h2>
          <MonthlyLineChart data={monthlyAgg} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">担当者別 実績構成比</h2>
          <StaffSharePieChart data={staffAgg} />
        </div>
      </div>
    </div>
  );
}
