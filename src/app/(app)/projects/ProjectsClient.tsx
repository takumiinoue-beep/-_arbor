"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import type { PriceRate, Profile, ProjectStatus, ProjectWithStaff } from "@/types/database";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getEffectiveCounts } from "@/lib/aggregate";
import { ActualEditor } from "./ActualEditor";
import { TargetQuantityEditor } from "./TargetQuantityEditor";
import { RateQuantityEditor } from "./RateQuantityEditor";
import { RateActualEditor } from "./RateActualEditor";
import { ConfirmedQuantityEditor } from "./ConfirmedQuantityEditor";
import { RateConfirmedQuantityEditor } from "./RateConfirmedQuantityEditor";
import { StatusEditor } from "./StatusEditor";
import { DeleteProjectButton } from "./DeleteProjectButton";

function rateRangeLabel(rate: PriceRate) {
  return rate.employee_max === null
    ? `${rate.employee_min}人以上`
    : `${rate.employee_min}〜${rate.employee_max}人`;
}

function sortedRates(rates: PriceRate[] | undefined) {
  if (!rates) return [];
  return [...rates].sort((a, b) => a.sort_order - b.sort_order);
}

export function ProjectsClient({
  projects,
  staffList,
  currentUserId,
  isAdmin,
  todayISO,
}: {
  projects: ProjectWithStaff[];
  staffList: Profile[];
  currentUserId: string;
  isAdmin: boolean;
  todayISO: string;
}) {
  const currentMonthKey = todayISO.slice(0, 7);
  const [keyword, setKeyword] = useState("");
  const [staffId, setStaffId] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [monthTab, setMonthTab] = useState(currentMonthKey);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const monthTabs = useMemo(() => {
    const set = new Set(projects.map((p) => p.start_date.slice(0, 7)));
    set.add(currentMonthKey);
    return Array.from(set).sort();
  }, [projects, currentMonthKey]);

  // 複数年にまたがる場合のみ「2026年7月」のように年を併記して曖昧さを避ける
  const spansMultipleYears = useMemo(
    () => new Set(monthTabs.map((m) => m.slice(0, 4))).size > 1,
    [monthTabs]
  );

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (keyword) {
        const k = keyword.toLowerCase();
        const hit =
          p.name.toLowerCase().includes(k) || (p.staff?.name ?? "").toLowerCase().includes(k);
        if (!hit) return false;
      }
      if (staffId && p.staff_id !== staffId) return false;
      if (status && p.status !== status) return false;
      if (monthTab !== "all" && p.start_date.slice(0, 7) !== monthTab) return false;
      return true;
    });
  }, [projects, keyword, staffId, status, monthTab]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, p) => {
        const { actualQty, confirmedQty, confirmedAmount } = getEffectiveCounts(p);
        acc.budget += p.budget;
        acc.actual += p.actual;
        acc.actualQty += actualQty;
        acc.confirmedQty += confirmedQty;
        acc.confirmedAmount += confirmedAmount;
        return acc;
      },
      { budget: 0, actual: 0, actualQty: 0, confirmedQty: 0, confirmedAmount: 0 }
    );
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
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

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">キーワード</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="案件名・担当者名"
              className="w-48 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">担当者</label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">すべて</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">ステータス</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus | "")}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">すべて</option>
              <option value="進行中">進行中</option>
              <option value="完了">完了</option>
              <option value="中止">中止</option>
            </select>
          </div>
        </div>

        {isAdmin && (
          <Link
            href="/projects/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            + 案件を登録
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[1600px] whitespace-nowrap divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">案件名</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">担当者</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">期間</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">予算</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">実績</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">確定件数</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">有効率</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">差異</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">達成率</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">ステータス</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">備考</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => {
              const diff = p.actual - p.budget;
              const canEditActual = isAdmin || p.staff_id === currentUserId;
              const rates = sortedRates(p.price_rates);
              const hasRates = rates.length > 0;
              const {
                budgetQty: totalBudgetQty,
                actualQty: totalActualQty,
                confirmedQty: totalConfirmedQty,
                confirmedAmount: totalConfirmedAmount,
              } = getEffectiveCounts(p);
              return (
                <Fragment key={p.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {hasRates && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(p.id)}
                          className="mr-1.5 inline-block w-3 text-xs text-slate-400 hover:text-slate-700"
                          aria-label={expanded.has(p.id) ? "料金表の内訳を閉じる" : "料金表の内訳を開く"}
                        >
                          {expanded.has(p.id) ? "▼" : "▶"}
                        </button>
                      )}
                      {p.name}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{p.staff?.name ?? "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                      {p.start_date}
                      {p.end_date ? ` ～ ${p.end_date}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {hasRates ? (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-700">{totalBudgetQty}件</span>
                          <span className="text-xs text-slate-400">→ {formatCurrency(p.budget)}</span>
                        </div>
                      ) : isAdmin ? (
                        <TargetQuantityEditor
                          projectId={p.id}
                          quantity={p.quantity}
                          unitPrice={p.unit_price}
                        />
                      ) : (
                        <span className="text-slate-700">
                          {formatCurrency(p.budget)}
                          <span className="ml-1 text-xs text-slate-400">({p.quantity}件)</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {hasRates ? (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-700">{totalActualQty}件</span>
                          <span className="text-xs text-slate-400">→ {formatCurrency(p.actual)}</span>
                        </div>
                      ) : canEditActual ? (
                        <ActualEditor
                          projectId={p.id}
                          actualQuantity={p.actual_quantity}
                          unitPrice={p.unit_price}
                        />
                      ) : (
                        <span className="text-slate-700">
                          {formatCurrency(p.actual)}
                          <span className="ml-1 text-xs text-slate-400">({p.actual_quantity}件)</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {hasRates ? (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-700">{totalConfirmedQty}件</span>
                          <span className="text-xs text-slate-400">→ {formatCurrency(totalConfirmedAmount)}</span>
                        </div>
                      ) : isAdmin ? (
                        <ConfirmedQuantityEditor
                          projectId={p.id}
                          confirmedQuantity={p.confirmed_quantity}
                          unitPrice={p.unit_price}
                        />
                      ) : (
                        <span className="text-slate-700">
                          {formatCurrency(totalConfirmedAmount)}
                          <span className="ml-1 text-xs text-slate-400">({p.confirmed_quantity}件)</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatPercent(totalConfirmedQty, totalActualQty)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${diff >= 0 ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {formatCurrency(diff)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatPercent(totalConfirmedAmount, p.budget)}
                    </td>
                    <td className="px-3 py-2">
                      {isAdmin ? (
                        <StatusEditor projectId={p.id} status={p.status} />
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            p.status === "完了"
                              ? "bg-emerald-100 text-emerald-700"
                              : p.status === "中止"
                                ? "bg-slate-200 text-slate-600"
                                : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {p.status}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2 text-slate-500" title={p.notes ?? ""}>
                      {p.notes ?? ""}
                    </td>
                    <td className="px-3 py-2">
                      {isAdmin && (
                        <div className="flex gap-2">
                          <Link
                            href={`/projects/${p.id}/edit`}
                            className="text-xs text-slate-600 hover:underline"
                          >
                            編集
                          </Link>
                          <DeleteProjectButton projectId={p.id} />
                        </div>
                      )}
                    </td>
                  </tr>
                  {hasRates &&
                    expanded.has(p.id) &&
                    rates.map((r) => {
                      const rBudget = r.unit_price * r.quantity;
                      const rActual = r.unit_price * r.actual_quantity;
                      const rConfirmedAmount = r.unit_price * r.confirmed_quantity;
                      const rDiff = rActual - rBudget;
                      return (
                        <tr key={r.id} className="bg-slate-50/60 text-xs">
                          <td className="px-3 py-1.5 pl-6 text-slate-500" colSpan={3}>
                            └ {r.position}（{rateRangeLabel(r)}）
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {isAdmin ? (
                              <RateQuantityEditor rateId={r.id} quantity={r.quantity} unitPrice={r.unit_price} />
                            ) : (
                              <span className="text-slate-500">
                                {formatCurrency(rBudget)}
                                <span className="ml-1 text-slate-400">({r.quantity}件)</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {canEditActual ? (
                              <RateActualEditor
                                rateId={r.id}
                                actualQuantity={r.actual_quantity}
                                unitPrice={r.unit_price}
                              />
                            ) : (
                              <span className="text-slate-500">
                                {formatCurrency(rActual)}
                                <span className="ml-1 text-slate-400">({r.actual_quantity}件)</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {isAdmin ? (
                              <RateConfirmedQuantityEditor
                                rateId={r.id}
                                confirmedQuantity={r.confirmed_quantity}
                                unitPrice={r.unit_price}
                              />
                            ) : (
                              <span className="text-slate-500">
                                {formatCurrency(rConfirmedAmount)}
                                <span className="ml-1 text-slate-400">({r.confirmed_quantity}件)</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-500">
                            {formatPercent(r.confirmed_quantity, r.actual_quantity)}
                          </td>
                          <td
                            className={`px-3 py-1.5 text-right ${rDiff >= 0 ? "text-emerald-600" : "text-red-600"}`}
                          >
                            {formatCurrency(rDiff)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-500">
                            {formatPercent(rConfirmedAmount, rBudget)}
                          </td>
                          <td colSpan={3} />
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-slate-400">
                  該当する案件がありません
                </td>
              </tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-slate-50 font-medium">
              <tr>
                <td className="px-3 py-2" colSpan={3}>
                  合計（{filtered.length}件）
                </td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.budget)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.actual)}</td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(totals.confirmedAmount)}
                  <span className="ml-1 text-xs text-slate-400">({totals.confirmedQty}件)</span>
                </td>
                <td className="px-3 py-2 text-right">
                  {formatPercent(totals.confirmedQty, totals.actualQty)}
                </td>
                <td
                  className={`px-3 py-2 text-right ${
                    totals.actual - totals.budget >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(totals.actual - totals.budget)}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatPercent(totals.confirmedAmount, totals.budget)}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
