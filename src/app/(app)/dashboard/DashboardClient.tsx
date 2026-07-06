"use client";

import { useMemo, useState } from "react";
import type { FixedCost, ProjectWithStaff } from "@/types/database";
import { aggregateByStaff, aggregateByMonth, sumBudget, sumActual } from "@/lib/aggregate";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  PERIOD_TABS,
  filterByPeriod,
  filterByExactMonth,
  formatYearMonth,
  type PeriodTab,
} from "@/lib/period";
import { SummaryCard } from "@/components/SummaryCard";
import { BudgetActualBarChart } from "@/components/charts/BudgetActualBarChart";
import { MonthlyLineChart } from "@/components/charts/MonthlyLineChart";

export function DashboardClient({
  projects,
  fixedCosts,
  todayISO,
}: {
  projects: ProjectWithStaff[];
  fixedCosts: FixedCost[];
  todayISO: string;
}) {
  const [tab, setTab] = useState<PeriodTab>("this_month");

  const currentMonthKey = todayISO.slice(0, 7);
  const pastMonths = useMemo(() => {
    const set = new Set(projects.map((p) => p.start_date.slice(0, 7)));
    return Array.from(set)
      .filter((m) => m < currentMonthKey)
      .sort()
      .reverse();
  }, [projects, currentMonthKey]);

  const [selectedPastMonth, setSelectedPastMonth] = useState(() => pastMonths[0] ?? "");

  const isPastTab = tab === "past";

  const filteredProjects = useMemo(() => {
    if (isPastTab) {
      if (!selectedPastMonth) return [];
      return filterByExactMonth(projects, selectedPastMonth, (p) => p.start_date);
    }
    return filterByPeriod(projects, tab, todayISO, (p) => p.start_date);
  }, [projects, tab, todayISO, isPastTab, selectedPastMonth]);

  const filteredFixedCosts = useMemo(() => {
    if (isPastTab) {
      if (!selectedPastMonth) return [];
      return filterByExactMonth(fixedCosts, selectedPastMonth, (f) => f.target_month);
    }
    return filterByPeriod(fixedCosts, tab, todayISO, (f) => f.target_month);
  }, [fixedCosts, tab, todayISO, isPastTab, selectedPastMonth]);

  const budget = sumBudget(filteredProjects);
  const actual = sumActual(filteredProjects);
  const fixedCostTotal = filteredFixedCosts.reduce((sum, f) => sum + f.amount, 0);
  const grossProfit = actual - fixedCostTotal;

  const staffAgg = aggregateByStaff(filteredProjects);
  const monthlyAgg = aggregateByMonth(filteredProjects);

  const projectRows = useMemo(
    () => [...filteredProjects].sort((a, b) => b.actual - a.actual),
    [filteredProjects]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {PERIOD_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isPastTab && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">対象月</label>
          {pastMonths.length > 0 ? (
            <select
              value={selectedPastMonth}
              onChange={(e) => setSelectedPastMonth(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {pastMonths.map((m) => (
                <option key={m} value={m}>
                  {formatYearMonth(m)}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-slate-400">過去の案件データがありません</span>
          )}
        </div>
      )}

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
        ※ 案件は開始日、固定費は対象年月をもとに選択中の期間で絞り込んでいます。固定費合計はその期間に該当する固定費の単純合計です。
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

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">案件別 売上</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-500">案件名</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">担当者</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">予算</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">実績</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">達成率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projectRows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                  <td className="px-3 py-2 text-slate-600">{p.staff?.name ?? "-"}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(p.budget)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(p.actual)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {formatPercent(p.actual, p.budget)}
                  </td>
                </tr>
              ))}
              {projectRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    この期間に該当する案件がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
