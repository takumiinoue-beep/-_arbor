"use client";

import { Fragment, useMemo, useState } from "react";
import type { Acquisition, Profile, ProjectWithStaff } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import { AcquisitionButton } from "./AcquisitionButton";
import { DeleteAcquisitionButton } from "./DeleteAcquisitionButton";
import { ConfirmedQuantityEditor } from "../projects/ConfirmedQuantityEditor";
import { RateConfirmedQuantityEditor } from "../projects/RateConfirmedQuantityEditor";

export type AcquisitionRow = Acquisition & {
  project: { id: string; name: string; confirmed_quantity: number } | null;
  staff: { id: string; name: string } | null;
  rate: { id: string; confirmed_quantity: number } | null;
};

type SalesEntry = { id: string; acquiredDate: string; quantity: number };

type SalesRow = {
  key: string;
  opName: string;
  projectId: string;
  projectName: string;
  rateId: string | null;
  unitPrice: number;
  acquiredQty: number;
  acquiredAmount: number;
  effectiveQty: number;
  billedAmount: number;
  entries: SalesEntry[];
};

type OpGroup = {
  opName: string;
  rows: SalesRow[];
  acquiredQty: number;
  acquiredAmount: number;
  billedAmount: number;
};

// OP（担当者）×案件×単価の組み合わせごとに獲得件数を積み上げる。
// 有効件数（確定件数）は案件・料金表の行そのものが持つ値のため、
// 同じ案件を複数のOPが獲得している場合は各行に同じ値が表示される
// （OPごとに確定件数を按分する仕組みは無い）。
function buildSalesRows(acquisitions: AcquisitionRow[]): SalesRow[] {
  const map = new Map<string, SalesRow>();

  for (const a of acquisitions) {
    const opName = a.staff?.name ?? "不明";
    const projectName = a.project?.name ?? "(削除済み案件)";
    const effectiveQty = a.rate ? a.rate.confirmed_quantity : (a.project?.confirmed_quantity ?? 0);
    const key = `${a.staff_id}:${a.rate_id ?? a.project_id}:${a.unit_price}`;

    const entry = map.get(key) ?? {
      key,
      opName,
      projectId: a.project_id,
      projectName,
      rateId: a.rate_id,
      unitPrice: a.unit_price,
      acquiredQty: 0,
      acquiredAmount: 0,
      effectiveQty,
      billedAmount: 0,
      entries: [],
    };
    entry.acquiredQty += a.quantity;
    entry.entries.push({ id: a.id, acquiredDate: a.acquired_date, quantity: a.quantity });
    map.set(key, entry);
  }

  const rows = Array.from(map.values());
  for (const row of rows) {
    row.acquiredAmount = row.unitPrice * row.acquiredQty;
    row.billedAmount = row.unitPrice * row.effectiveQty;
    row.entries.sort((a, b) => b.acquiredDate.localeCompare(a.acquiredDate));
  }

  return rows.sort(
    (a, b) => a.opName.localeCompare(b.opName, "ja") || a.projectName.localeCompare(b.projectName, "ja")
  );
}

function groupByOp(rows: SalesRow[]): OpGroup[] {
  const groups: OpGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    const group = last && last.opName === row.opName ? last : undefined;
    if (group) {
      group.rows.push(row);
      group.acquiredQty += row.acquiredQty;
      group.acquiredAmount += row.acquiredAmount;
      group.billedAmount += row.billedAmount;
    } else {
      groups.push({
        opName: row.opName,
        rows: [row],
        acquiredQty: row.acquiredQty,
        acquiredAmount: row.acquiredAmount,
        billedAmount: row.billedAmount,
      });
    }
  }
  return groups;
}

export function DashboardClient({
  projects,
  staffList,
  acquisitions,
  currentUserId,
  isAdmin,
  todayISO,
}: {
  projects: ProjectWithStaff[];
  staffList: Profile[];
  acquisitions: AcquisitionRow[];
  currentUserId: string;
  isAdmin: boolean;
  todayISO: string;
}) {
  const currentMonthKey = todayISO.slice(0, 7);
  const [monthTab, setMonthTab] = useState(currentMonthKey);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const monthTabs = useMemo(() => {
    const set = new Set(acquisitions.map((a) => a.acquired_date.slice(0, 7)));
    set.add(currentMonthKey);
    return Array.from(set).sort();
  }, [acquisitions, currentMonthKey]);

  const spansMultipleYears = useMemo(
    () => new Set(monthTabs.map((m) => m.slice(0, 4))).size > 1,
    [monthTabs]
  );

  const filteredAcquisitions = useMemo(() => {
    if (monthTab === "all") return acquisitions;
    return acquisitions.filter((a) => a.acquired_date.slice(0, 7) === monthTab);
  }, [acquisitions, monthTab]);

  const salesRows = useMemo(() => buildSalesRows(filteredAcquisitions), [filteredAcquisitions]);
  const opGroups = useMemo(() => groupByOp(salesRows), [salesRows]);

  const totals = useMemo(
    () =>
      salesRows.reduce(
        (acc, r) => {
          acc.acquiredQty += r.acquiredQty;
          acc.acquiredAmount += r.acquiredAmount;
          acc.billedAmount += r.billedAmount;
          return acc;
        },
        { acquiredQty: 0, acquiredAmount: 0, billedAmount: 0 }
      ),
    [salesRows]
  );

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

      <div className="flex justify-end">
        <AcquisitionButton projects={projects} staffList={staffList} currentUserId={currentUserId} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">OP</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">案件名</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">単価</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">獲得件数</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">獲得金額</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">有効件数</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">請求金額</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {opGroups.map((group) => (
              <Fragment key={group.opName}>
                <tr className="bg-slate-100">
                  <td colSpan={7} className="px-3 py-2 font-semibold text-slate-800">
                    {group.opName}
                  </td>
                </tr>
                {group.rows.map((r) => (
                  <Fragment key={r.key}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-slate-600">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(r.key)}
                          className="mr-1.5 inline-block w-3 text-xs text-slate-400 hover:text-slate-700"
                          aria-label={expanded.has(r.key) ? "内訳を閉じる" : "内訳を開く"}
                        >
                          {expanded.has(r.key) ? "▼" : "▶"}
                        </button>
                        {r.projectName}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(r.unitPrice)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{r.acquiredQty}件</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(r.acquiredAmount)}</td>
                      <td className="px-3 py-2 text-right">
                        {isAdmin ? (
                          r.rateId ? (
                            <RateConfirmedQuantityEditor
                              rateId={r.rateId}
                              confirmedQuantity={r.effectiveQty}
                              unitPrice={r.unitPrice}
                            />
                          ) : (
                            <ConfirmedQuantityEditor
                              projectId={r.projectId}
                              confirmedQuantity={r.effectiveQty}
                              unitPrice={r.unitPrice}
                            />
                          )
                        ) : (
                          <span className="text-slate-700">{r.effectiveQty}件</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-900">
                        {formatCurrency(r.billedAmount)}
                      </td>
                    </tr>
                    {expanded.has(r.key) &&
                      r.entries.map((e) => (
                        <tr key={e.id} className="bg-slate-50/60 text-xs">
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5 pl-8 text-slate-500">└ {e.acquiredDate}</td>
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5 text-right text-slate-500">{e.quantity}件</td>
                          <td className="px-3 py-1.5 text-right text-slate-500">
                            {formatCurrency(e.quantity * r.unitPrice)}
                          </td>
                          <td className="px-3 py-1.5" colSpan={2}>
                            {isAdmin && (
                              <div className="flex justify-end">
                                <DeleteAcquisitionButton id={e.id} />
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                ))}
                <tr className="bg-slate-50 text-xs font-medium text-slate-600">
                  <td className="px-3 py-1.5" colSpan={3}>
                    {group.opName}　小計
                  </td>
                  <td className="px-3 py-1.5 text-right">{group.acquiredQty}件</td>
                  <td className="px-3 py-1.5 text-right">{formatCurrency(group.acquiredAmount)}</td>
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5 text-right">{formatCurrency(group.billedAmount)}</td>
                </tr>
              </Fragment>
            ))}
            {salesRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  この期間の獲得データがありません
                </td>
              </tr>
            )}
          </tbody>
          {salesRows.length > 0 && (
            <tfoot className="bg-slate-50 font-medium">
              <tr>
                <td className="px-3 py-2" colSpan={3}>
                  合計
                </td>
                <td className="px-3 py-2 text-right">{totals.acquiredQty}件</td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.acquiredAmount)}</td>
                <td className="px-3 py-2 text-right" />
                <td className="px-3 py-2 text-right">{formatCurrency(totals.billedAmount)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
