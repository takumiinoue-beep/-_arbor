"use client";

import { useMemo, useState } from "react";
import type { ProjectWithStaff } from "@/types/database";
import { aggregateByStaff, projectsGroupedByStaff, computeStaffGroupBands } from "@/lib/aggregate";
import { formatCurrency, formatPercent } from "@/lib/format";
import { StaffGroupedProjectBarChart } from "@/components/charts/StaffGroupedProjectBarChart";

export function StaffSummaryClient({ projects }: { projects: ProjectWithStaff[] }) {
  const [monthTab, setMonthTab] = useState("all");

  const monthTabs = useMemo(() => {
    const set = new Set(projects.map((p) => p.start_date.slice(0, 7)));
    return Array.from(set).sort();
  }, [projects]);

  const spansMultipleYears = useMemo(
    () => new Set(monthTabs.map((m) => m.slice(0, 4))).size > 1,
    [monthTabs]
  );

  const filteredProjects = useMemo(() => {
    if (monthTab === "all") return projects;
    return projects.filter((p) => p.start_date.slice(0, 7) === monthTab);
  }, [projects, monthTab]);

  const staffAgg = useMemo(() => aggregateByStaff(filteredProjects), [filteredProjects]);
  const staffProjectRows = useMemo(() => projectsGroupedByStaff(filteredProjects), [filteredProjects]);
  const staffGroupBands = useMemo(() => computeStaffGroupBands(staffProjectRows), [staffProjectRows]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setMonthTab("all")}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            monthTab === "all"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          全て
        </button>
        {monthTabs.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMonthTab(m)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap ${
              monthTab === m
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {spansMultipleYears ? `${m.slice(0, 4)}年${Number(m.slice(5, 7))}月` : `${Number(m.slice(5, 7))}月`}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <StaffGroupedProjectBarChart data={staffProjectRows} bands={staffGroupBands} />
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
                  <td className={`px-3 py-2 text-right ${diff >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(diff)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatPercent(s.actual, s.budget)}</td>
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
