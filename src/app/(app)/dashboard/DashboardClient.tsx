"use client";

import { Fragment, useMemo, useState } from "react";
import type { Acquisition, Profile, ProjectWithStaff } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import { AcquisitionButton } from "./AcquisitionButton";

export type AcquisitionRow = Acquisition & {
  project: { id: string; name: string; confirmed_quantity: number } | null;
  staff: { id: string; name: string } | null;
  rate: { id: string; confirmed_quantity: number } | null;
};

type SalesRow = {
  key: string;
  opName: string;
  projectName: string;
  unitPrice: number;
  acquiredQty: number;
  effectiveQty: number;
  billedAmount: number;
};

type OpGroup = {
  opName: string;
  rows: SalesRow[];
  acquiredQty: number;
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
      projectName,
      unitPrice: a.unit_price,
      acquiredQty: 0,
      effectiveQty,
      billedAmount: 0,
    };
    entry.acquiredQty += a.quantity;
    map.set(key, entry);
  }

  const rows = Array.from(map.values());
  for (const row of rows) {
    row.billedAmount = row.unitPrice * row.effectiveQty;
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
      group.billedAmount += row.billedAmount;
    } else {
      groups.push({ opName: row.opName, rows: [row], acquiredQty: row.acquiredQty, billedAmount: row.billedAmount });
    }
  }
  return groups;
}

export function DashboardClient({
  projects,
  staffList,
  acquisitions,
  currentUserId,
  todayISO,
}: {
  projects: ProjectWithStaff[];
  staffList: Profile[];
  acquisitions: AcquisitionRow[];
  currentUserId: string;
  todayISO: string;
}) {
  const currentMonthKey = todayISO.slice(0, 7);
  const [monthTab, setMonthTab] = useState(currentMonthKey);

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
          acc.billedAmount += r.billedAmount;
          return acc;
        },
        { acquiredQty: 0, billedAmount: 0 }
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
              <th className="px-3 py-2 text-right font-medium text-slate-500">有効件数</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">請求金額</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {opGroups.map((group) => (
              <Fragment key={group.opName}>
                <tr className="bg-slate-100">
                  <td colSpan={6} className="px-3 py-2 font-semibold text-slate-800">
                    {group.opName}
                  </td>
                </tr>
                {group.rows.map((r) => (
                  <tr key={r.key} className="hover:bg-slate-50">
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-slate-600">{r.projectName}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(r.unitPrice)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{r.acquiredQty}件</td>
                    <td className="px-3 py-2 text-right text-slate-700">{r.effectiveQty}件</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">
                      {formatCurrency(r.billedAmount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 text-xs font-medium text-slate-600">
                  <td className="px-3 py-1.5" colSpan={3}>
                    {group.opName}　小計
                  </td>
                  <td className="px-3 py-1.5 text-right">{group.acquiredQty}件</td>
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5 text-right">{formatCurrency(group.billedAmount)}</td>
                </tr>
              </Fragment>
            ))}
            {salesRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
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
