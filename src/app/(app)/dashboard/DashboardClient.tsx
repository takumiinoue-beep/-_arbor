"use client";

import { useMemo, useState } from "react";
import type { Acquisition, FixedCost, ProjectWithStaff } from "@/types/database";
import {
  aggregateByStaff,
  aggregateByMonth,
  sumBudget,
  sumActual,
  getEffectiveCounts,
  sumEffectiveCounts,
  projectsGroupedByStaff,
  computeStaffGroupBands,
} from "@/lib/aggregate";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  PERIOD_TABS,
  filterByPeriod,
  filterByExactMonth,
  formatYearMonth,
  getPeriodTabLabel,
  type PeriodTab,
} from "@/lib/period";
import { filterFixedCostsByPeriod, filterFixedCostsByExactMonth } from "@/lib/fixedCostPeriod";
import { SummaryCard } from "@/components/SummaryCard";
import { BudgetActualBarChart } from "@/components/charts/BudgetActualBarChart";
import { MonthlyLineChart } from "@/components/charts/MonthlyLineChart";
import { StaffGroupedProjectBarChart } from "@/components/charts/StaffGroupedProjectBarChart";
import { StaffSharePieChart } from "@/components/charts/StaffSharePieChart";
import { AcquisitionButton } from "./AcquisitionButton";

export function DashboardClient({
  projects,
  fixedCosts,
  acquisitions,
  todayISO,
}: {
  projects: ProjectWithStaff[];
  fixedCosts: FixedCost[];
  acquisitions: Acquisition[];
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
      return filterFixedCostsByExactMonth(fixedCosts, selectedPastMonth);
    }
    return filterFixedCostsByPeriod(fixedCosts, tab, todayISO);
  }, [fixedCosts, tab, todayISO, isPastTab, selectedPastMonth]);

  const budget = sumBudget(filteredProjects);
  const actual = sumActual(filteredProjects);
  const fixedCostTotal = filteredFixedCosts.reduce((sum, f) => sum + f.amount, 0);
  const grossProfit = actual - fixedCostTotal;
  const {
    actualQty: totalActualQty,
    confirmedQty: totalConfirmedQty,
    confirmedAmount: totalConfirmedAmount,
  } = sumEffectiveCounts(filteredProjects);

  const filteredAcquisitions = useMemo(() => {
    if (isPastTab) {
      if (!selectedPastMonth) return [];
      return filterByExactMonth(acquisitions, selectedPastMonth, (a) => a.acquired_date);
    }
    return filterByPeriod(acquisitions, tab, todayISO, (a) => a.acquired_date);
  }, [acquisitions, tab, todayISO, isPastTab, selectedPastMonth]);

  const dailyAcquisitions = useMemo(() => {
    const map = new Map<string, { date: string; count: number; amount: number }>();
    for (const a of filteredAcquisitions) {
      const entry = map.get(a.acquired_date) ?? { date: a.acquired_date, count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += a.amount;
      map.set(a.acquired_date, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredAcquisitions]);

  const staffAgg = aggregateByStaff(filteredProjects);
  const monthlyAgg = aggregateByMonth(filteredProjects);
  const staffProjectRows = useMemo(() => projectsGroupedByStaff(filteredProjects), [filteredProjects]);
  const staffGroupBands = useMemo(() => computeStaffGroupBands(staffProjectRows), [staffProjectRows]);

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
            {getPeriodTabLabel(t.key, todayISO)}
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

      <div className="flex justify-end">
        <AcquisitionButton projects={projects} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        <SummaryCard label="予算合計" value={formatCurrency(budget)} />
        <SummaryCard label="実績合計" value={formatCurrency(actual)} />
        <SummaryCard label="確定合計" value={formatCurrency(totalConfirmedAmount)} />
        <SummaryCard
          label="達成率（確定金額÷予算）"
          value={formatPercent(totalConfirmedAmount, budget)}
          tone={totalConfirmedAmount >= budget ? "positive" : "negative"}
        />
        <SummaryCard label="固定費合計" value={formatCurrency(fixedCostTotal)} />
        <SummaryCard
          label="粗利（実績－固定費）"
          value={formatCurrency(grossProfit)}
          tone={grossProfit >= 0 ? "positive" : "negative"}
        />
        <SummaryCard label="有効率（確定件数÷実績件数）" value={formatPercent(totalConfirmedQty, totalActualQty)} />
      </div>
      <p className="-mt-3 text-xs text-slate-400">
        ※ 案件は開始日、固定費は対象年月をもとに選択中の期間で絞り込んでいます。固定費合計はその期間に該当する固定費の単純合計です。
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">デイリー獲得件数・金額</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-500">日付</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">獲得件数</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">獲得金額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dailyAcquisitions.map((d) => (
                <tr key={d.date} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-800">{d.date}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{d.count}件</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(d.amount)}</td>
                </tr>
              ))}
              {dailyAcquisitions.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                    この期間の獲得記録がありません
                  </td>
                </tr>
              )}
            </tbody>
            {dailyAcquisitions.length > 0 && (
              <tfoot className="bg-slate-50 font-medium">
                <tr>
                  <td className="px-3 py-2">合計</td>
                  <td className="px-3 py-2 text-right">
                    {dailyAcquisitions.reduce((sum, d) => sum + d.count, 0)}件
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(dailyAcquisitions.reduce((sum, d) => sum + d.amount, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

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
                <th className="px-3 py-2 text-right font-medium text-slate-500">確定金額</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">有効率</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">達成率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projectRows.map((p) => {
                const { budgetQty, actualQty, confirmedQty, confirmedAmount } = getEffectiveCounts(p);
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                    <td className="px-3 py-2 text-slate-600">{p.staff?.name ?? "-"}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatCurrency(p.budget)}
                      <span className="ml-1 text-xs text-slate-400">({budgetQty}件)</span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatCurrency(p.actual)}
                      <span className="ml-1 text-xs text-slate-400">({actualQty}件)</span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatCurrency(confirmedAmount)}
                      <span className="ml-1 text-xs text-slate-400">({confirmedQty}件)</span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatPercent(confirmedQty, actualQty)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatPercent(confirmedAmount, p.budget)}
                    </td>
                  </tr>
                );
              })}
              {projectRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                    この期間に該当する案件がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-slate-900">担当者別集計</h2>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            担当者別 予算・実績比較（案件別内訳）
          </h3>
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
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatPercent(s.confirmedAmount, s.budget)}
                    </td>
                  </tr>
                );
              })}
              {staffAgg.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    この期間に該当するデータがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-slate-900">グラフ</h2>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">担当者別 実績構成比</h3>
          <StaffSharePieChart data={staffAgg} />
        </div>
      </div>
    </div>
  );
}
