"use client";

import { Fragment, useMemo, useState } from "react";
import type { Acquisition, OpConfirmedQuantity, Profile } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import { acquisitionMonth } from "@/lib/sales";
import { AcquisitionButton, type AcquisitionProject } from "./AcquisitionButton";
import { DeleteAcquisitionButton } from "./DeleteAcquisitionButton";
import { OpConfirmedQuantityEditor } from "./OpConfirmedQuantityEditor";

export type AcquisitionRow = Pick<
  Acquisition,
  "id" | "acquired_date" | "target_month" | "project_id" | "rate_id" | "staff_id" | "unit_price" | "quantity" | "amount"
> & {
  project: { id: string; name: string; confirmed_quantity: number } | null;
  staff: { id: string; name: string } | null;
  rate: { id: string; confirmed_quantity: number } | null;
};

type SalesEntry = { id: string; acquiredDate: string; quantity: number };

type SalesRow = {
  key: string;
  opName: string;
  staffId: string;
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

// 表示の切り替え：OPごと（OP→案件）／案件ごと（案件→OP）
type View = "op" | "project";

type MidRow = {
  key: string;
  label: string;
  leaves: SalesRow[];
  unitPriceText: string;
  acquiredQty: number;
  acquiredAmount: number;
  effectiveQty: number;
  billedAmount: number;
};

type TopGroup = {
  key: string;
  label: string;
  mids: MidRow[];
  acquiredQty: number;
  acquiredAmount: number;
  billedAmount: number;
};

// OP（担当者）×案件×単価の組み合わせごとに獲得件数を積み上げる。
// 有効件数はOPごとに持つ（op_confirmed_quantities）。まだOPごとの値が無い場合は、
// その案件（料金表の行）を獲得しているOPが1人だけなら案件側の確定件数を使い、
// 複数OPいる場合は0とする（共有値を全OPに出すと同数になってしまうため）。
function buildSalesRows(
  acquisitions: AcquisitionRow[],
  allAcquisitions: AcquisitionRow[],
  opConfirmed: Pick<OpConfirmedQuantity, "project_id" | "rate_id" | "staff_id" | "confirmed_quantity">[]
): SalesRow[] {
  const targetKey = (projectId: string, rateId: string | null) => `${projectId}:${rateId ?? ""}`;

  const opsByTarget = new Map<string, Set<string>>();
  for (const a of allAcquisitions) {
    const k = targetKey(a.project_id, a.rate_id);
    const set = opsByTarget.get(k) ?? new Set<string>();
    set.add(a.staff_id);
    opsByTarget.set(k, set);
  }

  const recordMap = new Map<string, number>();
  for (const r of opConfirmed) {
    recordMap.set(`${targetKey(r.project_id, r.rate_id)}:${r.staff_id}`, r.confirmed_quantity);
  }

  const map = new Map<string, SalesRow>();

  for (const a of acquisitions) {
    const opName = a.staff?.name ?? "不明";
    const projectName = a.project?.name ?? "(削除済み案件)";
    const tk = targetKey(a.project_id, a.rate_id);
    const sharedQty = a.rate ? a.rate.confirmed_quantity : (a.project?.confirmed_quantity ?? 0);
    const effectiveQty =
      recordMap.get(`${tk}:${a.staff_id}`) ?? (opsByTarget.get(tk)?.size === 1 ? sharedQty : 0);
    const key = `${a.staff_id}:${a.rate_id ?? a.project_id}:${a.unit_price}`;

    const entry = map.get(key) ?? {
      key,
      opName,
      staffId: a.staff_id,
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

type DailyGroup = {
  label: string;
  days: { day: number; date: string; count: number; amount: number }[];
  // 計上月以外の月に登録した分（来月のアポを今月のうちに登録した分など）
  other: { count: number; amount: number };
  totalCount: number;
  totalAmount: number;
};

// 指定した月の1日〜末日について、OP（または案件）ごとに獲得件数・獲得金額を積み上げる
// （データが無い日も0件として含め、月全体が見えるようにする）
function buildDaily(acquisitions: AcquisitionRow[], monthKey: string, view: View): DailyGroup[] {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  type Acc = { days: Map<number, { count: number; amount: number }>; other: { count: number; amount: number } };
  const byLabel = new Map<string, Acc>();
  for (const a of acquisitions) {
    if (acquisitionMonth(a) !== monthKey) continue;
    const label = view === "op" ? (a.staff?.name ?? "不明") : (a.project?.name ?? "(削除済み案件)");
    const acc = byLabel.get(label) ?? { days: new Map(), other: { count: 0, amount: 0 } };
    if (a.acquired_date.slice(0, 7) === monthKey) {
      const day = Number(a.acquired_date.slice(8, 10));
      const entry = acc.days.get(day) ?? { count: 0, amount: 0 };
      entry.count += a.quantity;
      entry.amount += a.amount;
      acc.days.set(day, entry);
    } else {
      acc.other.count += a.quantity;
      acc.other.amount += a.amount;
    }
    byLabel.set(label, acc);
  }

  const result: DailyGroup[] = [];
  for (const [label, acc] of byLabel) {
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const date = `${monthKey}-${String(day).padStart(2, "0")}`;
      const entry = acc.days.get(day) ?? { count: 0, amount: 0 };
      return { day, date, count: entry.count, amount: entry.amount };
    });
    result.push({
      label,
      days,
      other: acc.other,
      totalCount: days.reduce((sum, d) => sum + d.count, 0) + acc.other.count,
      totalAmount: days.reduce((sum, d) => sum + d.amount, 0) + acc.other.amount,
    });
  }

  return result.sort((a, b) => a.label.localeCompare(b.label, "ja"));
}

// 単価ごとの行を、OP→案件（または案件→OP）の2段にまとめる
function groupRows(rows: SalesRow[], view: View): TopGroup[] {
  const topOf = (r: SalesRow) => (view === "op" ? r.opName : r.projectName);
  const midOf = (r: SalesRow) => (view === "op" ? r.projectName : r.opName);

  const tops = new Map<string, Map<string, SalesRow[]>>();
  for (const r of rows) {
    const mids = tops.get(topOf(r)) ?? new Map<string, SalesRow[]>();
    mids.set(midOf(r), [...(mids.get(midOf(r)) ?? []), r]);
    tops.set(topOf(r), mids);
  }

  const sum = <T,>(list: T[], f: (r: T) => number) => list.reduce((acc, r) => acc + f(r), 0);
  const cmp = (a: string, b: string) => a.localeCompare(b, "ja");

  return Array.from(tops, ([topLabel, mids]) => {
    const midRows: MidRow[] = Array.from(mids, ([midLabel, leaves]) => {
      const prices = Array.from(new Set(leaves.map((l) => l.unitPrice)));
      leaves.sort((a, b) => b.unitPrice - a.unitPrice);
      return {
        key: `${view}|${topLabel}|${midLabel}`,
        label: midLabel,
        leaves,
        unitPriceText: prices.length === 1 ? formatCurrency(prices[0]) : `${prices.length}種類`,
        acquiredQty: sum(leaves, (l) => l.acquiredQty),
        acquiredAmount: sum(leaves, (l) => l.acquiredAmount),
        effectiveQty: sum(leaves, (l) => l.effectiveQty),
        billedAmount: sum(leaves, (l) => l.billedAmount),
      };
    }).sort((a, b) => cmp(a.label, b.label));

    return {
      key: `${view}|${topLabel}`,
      label: topLabel,
      mids: midRows,
      acquiredQty: sum(midRows, (m) => m.acquiredQty),
      acquiredAmount: sum(midRows, (m) => m.acquiredAmount),
      billedAmount: sum(midRows, (m) => m.billedAmount),
    };
  }).sort((a, b) => cmp(a.label, b.label));
}

export function DashboardClient({
  projects,
  staffList,
  acquisitions,
  opConfirmed,
  currentUserId,
  isAdmin,
  todayISO,
}: {
  projects: AcquisitionProject[];
  staffList: Pick<Profile, "id" | "name">[];
  acquisitions: AcquisitionRow[];
  opConfirmed: Pick<OpConfirmedQuantity, "project_id" | "rate_id" | "staff_id" | "confirmed_quantity">[];
  currentUserId: string;
  isAdmin: boolean;
  todayISO: string;
}) {
  const currentMonthKey = todayISO.slice(0, 7);
  const [monthTab, setMonthTab] = useState(currentMonthKey);
  const [view, setView] = useState<View>("op");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dailyExpanded, setDailyExpanded] = useState<Set<string>>(new Set());

  function toggle(setter: typeof setExpanded, key: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // 計上月（来月のアポなどは獲得日と別の月に載る）ごとのタブ
  const monthTabs = useMemo(() => {
    const set = new Set(acquisitions.map(acquisitionMonth));
    set.add(currentMonthKey);
    return Array.from(set).sort();
  }, [acquisitions, currentMonthKey]);

  const spansMultipleYears = useMemo(
    () => new Set(monthTabs.map((m) => m.slice(0, 4))).size > 1,
    [monthTabs]
  );

  const filteredAcquisitions = useMemo(() => {
    if (monthTab === "all") return acquisitions;
    return acquisitions.filter((a) => acquisitionMonth(a) === monthTab);
  }, [acquisitions, monthTab]);

  const salesRows = useMemo(
    () => buildSalesRows(filteredAcquisitions, acquisitions, opConfirmed),
    [filteredAcquisitions, acquisitions, opConfirmed]
  );
  const groups = useMemo(() => groupRows(salesRows, view), [salesRows, view]);

  // タブが「全て」のときはデイリー表は当月を対象にする
  const dailyTargetMonth = monthTab === "all" ? currentMonthKey : monthTab;
  const daily = useMemo(
    () => buildDaily(acquisitions, dailyTargetMonth, view),
    [acquisitions, dailyTargetMonth, view]
  );

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

  const monthText = (m: string) =>
    spansMultipleYears ? `${m.slice(0, 4)}年${Number(m.slice(5, 7))}月` : `${Number(m.slice(5, 7))}月`;
  const midHeader = view === "op" ? "案件名" : "OP";
  const topKind = view === "op" ? "OP" : "案件";

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
            {monthText(m)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-md border border-slate-200 text-sm">
          {(
            [
              ["op", "OPごと"],
              ["project", "案件ごと"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className={`px-4 py-1.5 ${
                view === value ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <AcquisitionButton projects={projects} staffList={staffList} currentUserId={currentUserId} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">{midHeader}</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">単価</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">獲得件数</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">獲得金額</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">有効件数</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">請求金額</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((group) => (
              <Fragment key={group.key}>
                <tr className="bg-slate-100">
                  <td colSpan={6} className="px-3 py-2 font-semibold text-slate-800">
                    {group.label}
                  </td>
                </tr>
                {group.mids.map((mid) => (
                  <Fragment key={mid.key}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-700">
                        <button
                          type="button"
                          onClick={() => toggle(setExpanded, mid.key)}
                          className="flex items-center gap-1.5 text-left hover:text-slate-900"
                          aria-label={expanded.has(mid.key) ? "単価ごとの内訳を閉じる" : "単価ごとの内訳を開く"}
                        >
                          <span className="inline-block w-3 text-xs text-slate-400">
                            {expanded.has(mid.key) ? "▼" : "▶"}
                          </span>
                          {mid.label}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500">{mid.unitPriceText}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{mid.acquiredQty}件</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(mid.acquiredAmount)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{mid.effectiveQty}件</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-900">
                        {formatCurrency(mid.billedAmount)}
                      </td>
                    </tr>
                    {expanded.has(mid.key) &&
                      mid.leaves.map((r) => {
                        const leafKey = `${mid.key}|${r.key}`;
                        return (
                          <Fragment key={leafKey}>
                            <tr className="bg-slate-50/70 text-xs">
                              <td className="px-3 py-1.5 pl-9 text-slate-600">
                                <button
                                  type="button"
                                  onClick={() => toggle(setExpanded, leafKey)}
                                  className="flex items-center gap-1.5 text-left hover:text-slate-900"
                                  aria-label={expanded.has(leafKey) ? "登録日ごとの内訳を閉じる" : "登録日ごとの内訳を開く"}
                                >
                                  <span className="inline-block w-3 text-slate-400">
                                    {expanded.has(leafKey) ? "▼" : "▶"}
                                  </span>
                                  単価 {formatCurrency(r.unitPrice)}
                                </button>
                              </td>
                              <td className="px-3 py-1.5 text-right text-slate-600">{formatCurrency(r.unitPrice)}</td>
                              <td className="px-3 py-1.5 text-right text-slate-600">{r.acquiredQty}件</td>
                              <td className="px-3 py-1.5 text-right text-slate-600">
                                {formatCurrency(r.acquiredAmount)}
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                {isAdmin ? (
                                  <OpConfirmedQuantityEditor
                                    projectId={r.projectId}
                                    rateId={r.rateId}
                                    staffId={r.staffId}
                                    confirmedQuantity={r.effectiveQty}
                                    unitPrice={r.unitPrice}
                                  />
                                ) : (
                                  <span className="text-slate-600">{r.effectiveQty}件</span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-right font-medium text-slate-800">
                                {formatCurrency(r.billedAmount)}
                              </td>
                            </tr>
                            {expanded.has(leafKey) &&
                              r.entries.map((e) => (
                                <tr key={e.id} className="bg-white text-xs">
                                  <td className="px-3 py-1 pl-16 text-slate-500">└ {e.acquiredDate}</td>
                                  <td className="px-3 py-1" />
                                  <td className="px-3 py-1 text-right text-slate-500">{e.quantity}件</td>
                                  <td className="px-3 py-1 text-right text-slate-500">
                                    {formatCurrency(e.quantity * r.unitPrice)}
                                  </td>
                                  <td className="px-3 py-1" colSpan={2}>
                                    {isAdmin && (
                                      <div className="flex justify-end">
                                        <DeleteAcquisitionButton id={e.id} />
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                ))}
                <tr className="bg-slate-50 text-xs font-medium text-slate-600">
                  <td className="px-3 py-1.5" colSpan={2}>
                    {group.label}　小計
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
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  この期間の獲得データがありません
                </td>
              </tr>
            )}
          </tbody>
          {salesRows.length > 0 && (
            <tfoot className="bg-slate-50 font-medium">
              <tr>
                <td className="px-3 py-2" colSpan={2}>
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
      <p className="-mt-3 text-xs text-slate-400">
        {topKind}ごとにまとめています。行の▶を押すと単価ごとの件数、さらに押すと登録日ごとの内訳が見えます。有効件数は単価ごとの行で編集できます。
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          デイリー実績（{monthText(dailyTargetMonth)}・{view === "op" ? "OPごと" : "案件ごと"}）
        </h2>
        <div className="flex flex-col gap-2">
          {daily.map((g) => (
            <div key={g.label} className="overflow-hidden rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => toggle(setDailyExpanded, g.label)}
                className="flex w-full items-center justify-between bg-slate-100 px-3 py-2 text-left"
              >
                <span className="font-semibold text-slate-800">
                  <span className="mr-1.5 inline-block w-3 text-xs text-slate-400">
                    {dailyExpanded.has(g.label) ? "▼" : "▶"}
                  </span>
                  {g.label}
                </span>
                <span className="text-xs text-slate-500">
                  月合計 {g.totalCount}件 / {formatCurrency(g.totalAmount)}
                </span>
              </button>
              {dailyExpanded.has(g.label) && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium text-slate-500">日付</th>
                        <th className="px-2 py-1 text-right font-medium text-slate-500">獲得件数</th>
                        <th className="px-2 py-1 text-right font-medium text-slate-500">獲得金額</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {g.other.count > 0 && (
                        <tr className="bg-amber-50 text-slate-700">
                          <td className="px-2 py-1">他の月に登録（アポなど）</td>
                          <td className="px-2 py-1 text-right">{g.other.count}件</td>
                          <td className="px-2 py-1 text-right">{formatCurrency(g.other.amount)}</td>
                        </tr>
                      )}
                      {g.days.map((d) => (
                        <tr key={d.date} className={d.count === 0 ? "text-slate-300" : undefined}>
                          <td className="px-2 py-1">{d.day}日</td>
                          <td className="px-2 py-1 text-right">{d.count}件</td>
                          <td className="px-2 py-1 text-right">{formatCurrency(d.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {daily.length === 0 && (
            <p className="px-1 py-4 text-center text-sm text-slate-400">この月の獲得データがありません</p>
          )}
        </div>
      </div>
    </div>
  );
}
