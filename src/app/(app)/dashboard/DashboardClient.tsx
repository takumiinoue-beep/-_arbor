"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import type { Acquisition, ConfirmedQuantity, Profile, ProjectAssignment } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import { Progress } from "@/components/common/Progress";
import { defaultUnitPrice, latestByName } from "@/lib/projects";
import { acquisitionMonth } from "@/lib/sales";
import { AcquisitionButton, type AcquisitionProject } from "./AcquisitionButton";
import { DeleteAcquisitionButton } from "./DeleteAcquisitionButton";
import { setConfirmedQuantity } from "./actions";

export type AcquisitionRow = Pick<
  Acquisition,
  "id" | "acquired_date" | "target_month" | "project_id" | "rate_id" | "staff_id" | "unit_price" | "quantity" | "amount"
> & {
  project: { id: string; name: string } | null;
  staff: { id: string; name: string } | null;
};

type DashboardAssignment = Pick<ProjectAssignment, "month" | "staff_id" | "project_id" | "target_quantity">;

type SalesEntry = { id: string; acquiredDate: string; quantity: number; unitPrice: number };

// 月 × 単価ごとの内訳（有効件数は、この単位で手入力する）
type Leaf = {
  key: string;
  month: string; // "YYYY-MM"
  staffId: string;
  projectName: string;
  unitPrice: number;
  acquiredQty: number;
  acquiredAmount: number;
  confirmedQty: number; // 有効件数（手入力）
  confirmedAmount: number; // 確定金額＝有効件数×単価
  entries: SalesEntry[];
};

// OP × 案件 の1行（案件設定の1行に当たる）
type Cell = {
  key: string;
  staffId: string;
  opName: string;
  projectName: string;
  target: number; // 案件設定の件数
  targetAmount: number; // 設定金額＝設定件数×デフォルト単価
  leaves: Leaf[];
  acquiredQty: number;
  acquiredAmount: number;
  confirmedQty: number;
  confirmedAmount: number;
};

// 表示の切り替え：OPごと（OP→案件）／案件ごと（案件→OP）
type View = "op" | "project";

type Group = {
  key: string;
  label: string;
  cells: Cell[];
  target: number;
  targetAmount: number;
  acquiredQty: number;
  acquiredAmount: number;
  confirmedQty: number;
  confirmedAmount: number;
};

const sum = <T,>(list: T[], f: (r: T) => number) => list.reduce((acc, r) => acc + f(r), 0);
const cmp = (a: string, b: string) => a.localeCompare(b, "ja");
const qtyText = (n: number) => `${Math.round(n * 10) / 10}件`;

// OP × 案件 ごとに、案件設定の件数と、獲得の登録（件数・金額）、単価ごとの有効件数・確定金額をまとめる。
function buildCells(args: {
  acquisitions: AcquisitionRow[]; // 表示する期間の獲得
  assignments: DashboardAssignment[]; // 表示する期間の案件設定
  nameById: Map<string, string>;
  staffName: Map<string, string>;
  confirmed: ConfirmedQuantity[];
  defaultPriceByName: Map<string, number>; // 案件名 → デフォルト単価
}): Cell[] {
  const { acquisitions, assignments, nameById, staffName, confirmed, defaultPriceByName } = args;
  const confirmedBy = new Map(
    confirmed.map((c) => [`${c.month.slice(0, 7)}|${c.staff_id}|${c.project_name}|${c.unit_price}`, Number(c.quantity)])
  );
  const cells = new Map<string, Cell>();

  const cellFor = (staffId: string, projectName: string, opName: string): Cell => {
    const key = `${staffId}|${projectName}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = {
        key,
        staffId,
        opName,
        projectName,
        target: 0,
        targetAmount: 0,
        leaves: [],
        acquiredQty: 0,
        acquiredAmount: 0,
        confirmedQty: 0,
        confirmedAmount: 0,
      };
      cells.set(key, cell);
    }
    return cell;
  };

  for (const as of assignments) {
    const name = nameById.get(as.project_id);
    if (!name) continue;
    const cell = cellFor(as.staff_id, name, staffName.get(as.staff_id) ?? "不明");
    cell.target += as.target_quantity;
  }

  for (const a of acquisitions) {
    const name = a.project?.name ?? "(削除済み案件)";
    const cell = cellFor(a.staff_id, name, a.staff?.name ?? "不明");
    const month = acquisitionMonth(a);
    const leafKey = `${cell.key}|${month}|${a.unit_price}`;
    let leaf = cell.leaves.find((l) => l.key === leafKey);
    if (!leaf) {
      const confirmedQty = confirmedBy.get(`${month}|${a.staff_id}|${name}|${a.unit_price}`) ?? 0;
      leaf = {
        key: leafKey,
        month,
        staffId: a.staff_id,
        projectName: name,
        unitPrice: a.unit_price,
        acquiredQty: 0,
        acquiredAmount: 0,
        confirmedQty,
        confirmedAmount: confirmedQty * a.unit_price,
        entries: [],
      };
      cell.leaves.push(leaf);
    }
    leaf.acquiredQty += a.quantity;
    leaf.acquiredAmount += Number(a.amount);
    leaf.entries.push({ id: a.id, acquiredDate: a.acquired_date, quantity: a.quantity, unitPrice: a.unit_price });
  }

  for (const cell of cells.values()) {
    cell.targetAmount = cell.target * (defaultPriceByName.get(cell.projectName) ?? 0);
    cell.leaves.sort((a, b) => a.month.localeCompare(b.month) || b.unitPrice - a.unitPrice);
    for (const leaf of cell.leaves) leaf.entries.sort((a, b) => b.acquiredDate.localeCompare(a.acquiredDate));
    cell.acquiredQty = sum(cell.leaves, (l) => l.acquiredQty);
    cell.acquiredAmount = sum(cell.leaves, (l) => l.acquiredAmount);
    cell.confirmedQty = sum(cell.leaves, (l) => l.confirmedQty);
    cell.confirmedAmount = sum(cell.leaves, (l) => l.confirmedAmount);
  }

  return Array.from(cells.values());
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

// OP×案件の行を、OP→案件（または案件→OP）にまとめる
function groupCells(cells: Cell[], view: View): Group[] {
  const topOf = (c: Cell) => (view === "op" ? c.opName : c.projectName);
  const midOf = (c: Cell) => (view === "op" ? c.projectName : c.opName);

  const tops = new Map<string, Cell[]>();
  for (const c of cells) tops.set(topOf(c), [...(tops.get(topOf(c)) ?? []), c]);

  return Array.from(tops, ([label, list]) => ({
    key: `${view}|${label}`,
    label,
    cells: list.sort((a, b) => cmp(midOf(a), midOf(b))),
    target: sum(list, (c) => c.target),
    targetAmount: sum(list, (c) => c.targetAmount),
    acquiredQty: sum(list, (c) => c.acquiredQty),
    acquiredAmount: sum(list, (c) => c.acquiredAmount),
    confirmedQty: sum(list, (c) => c.confirmedQty),
    confirmedAmount: sum(list, (c) => c.confirmedAmount),
  })).sort((a, b) => cmp(a.label, b.label));
}

// 獲得件数の数字。カーソルを当てると、登録日ごとの件数を表示する（管理者は、そこから登録の削除もできる）
// 表の横スクロール領域に隠れないよう、ポップアップは画面基準（fixed）で表示する
function QtyWithDetail({ qty, entries, isAdmin }: { qty: number; entries: SalesEntry[]; isAdmin: boolean }) {
  const [anchor, setAnchor] = useState<{ right: number; top: number; bottom: number } | null>(null);
  if (entries.length === 0) return <>{qtyText(qty)}</>;
  const sorted = [...entries].sort((a, b) => b.acquiredDate.localeCompare(a.acquiredDate));

  const open = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setAnchor({ right: window.innerWidth - r.right, top: r.top, bottom: r.bottom });
  };
  // 下に収まらないときは上向きに出す
  const above = anchor !== null && anchor.bottom + 40 + sorted.length * 24 > window.innerHeight;

  return (
    <span
      className="inline-block"
      onMouseEnter={(e) => open(e.currentTarget)}
      onMouseLeave={() => setAnchor(null)}
      onFocus={(e) => open(e.currentTarget)}
      onBlur={() => setAnchor(null)}
    >
      <span tabIndex={0} className="cursor-default border-b border-dotted border-slate-400">
        {qtyText(qty)}
      </span>
      {anchor && (
        <span
          className="fixed z-30 max-h-80 overflow-y-auto py-1"
          style={above ? { right: anchor.right, bottom: window.innerHeight - anchor.top } : { right: anchor.right, top: anchor.bottom }}
        >
          <span className="block min-w-44 rounded-md border border-slate-200 bg-white p-2 text-left text-xs font-normal text-slate-700 shadow-lg">
            {sorted.map((e) => (
              <span key={e.id} className="flex items-center justify-between gap-4 py-0.5 whitespace-nowrap">
                <span>{e.acquiredDate}</span>
                <span className="flex items-center gap-2">
                  <span>{e.quantity}件</span>
                  {isAdmin && <DeleteAcquisitionButton id={e.id} />}
                </span>
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}

// 単価ごとの有効件数の入力。管理者のみ編集でき、Enter か枠の外をクリックで保存する
function ConfirmedInput({ leaf, isAdmin }: { leaf: Leaf; isAdmin: boolean }) {
  const [value, setValue] = useState(String(leaf.confirmedQty));
  const [pending, startTransition] = useTransition();
  if (!isAdmin) return <>{qtyText(leaf.confirmedQty)}</>;

  function save() {
    const n = Number(value);
    if (value.trim() === "" || !Number.isFinite(n) || n < 0) {
      setValue(String(leaf.confirmedQty));
      return;
    }
    if (n === leaf.confirmedQty) return;
    startTransition(async () => {
      const result = await setConfirmedQuantity({
        month: leaf.month,
        staffId: leaf.staffId,
        projectName: leaf.projectName,
        unitPrice: leaf.unitPrice,
        quantity: n,
      });
      if (result?.error) {
        alert(result.error);
        setValue(String(leaf.confirmedQty));
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        step="any"
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label="有効件数"
        className="w-16 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-right text-xs disabled:opacity-50"
      />
      件
    </span>
  );
}

export function DashboardClient({
  projects,
  assignments,
  staffList,
  acquisitions,
  confirmed,
  currentUserId,
  isAdmin,
  todayISO,
}: {
  projects: AcquisitionProject[];
  assignments: DashboardAssignment[];
  staffList: Pick<Profile, "id" | "name">[];
  acquisitions: AcquisitionRow[];
  confirmed: ConfirmedQuantity[];
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
    for (const a of assignments) set.add(a.month.slice(0, 7));
    set.add(currentMonthKey);
    return Array.from(set).sort();
  }, [acquisitions, assignments, currentMonthKey]);

  const spansMultipleYears = useMemo(
    () => new Set(monthTabs.map((m) => m.slice(0, 4))).size > 1,
    [monthTabs]
  );

  const filteredAcquisitions = useMemo(() => {
    if (monthTab === "all") return acquisitions;
    return acquisitions.filter((a) => acquisitionMonth(a) === monthTab);
  }, [acquisitions, monthTab]);

  const filteredAssignments = useMemo(() => {
    if (monthTab === "all") return assignments;
    return assignments.filter((a) => a.month.slice(0, 7) === monthTab);
  }, [assignments, monthTab]);

  const nameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const staffName = useMemo(() => new Map(staffList.map((s) => [s.id, s.name])), [staffList]);

  const defaultPriceByName = useMemo(
    () => new Map(Array.from(latestByName(projects), ([name, p]) => [name, defaultUnitPrice(p)] as const)),
    [projects]
  );

  const cells = useMemo(
    () =>
      buildCells({
        acquisitions: filteredAcquisitions,
        assignments: filteredAssignments,
        nameById,
        staffName,
        confirmed,
        defaultPriceByName,
      }),
    [filteredAcquisitions, filteredAssignments, nameById, staffName, confirmed, defaultPriceByName]
  );
  const groups = useMemo(() => groupCells(cells, view), [cells, view]);

  // 獲得の登録画面に出す、案件設定の件数と現在件数（月|OP|案件名 ごと）
  const progress = useMemo(() => {
    const map = new Map<string, { target: number; current: number }>();
    for (const a of assignments) {
      const name = nameById.get(a.project_id);
      if (!name) continue;
      const key = `${a.month.slice(0, 7)}|${a.staff_id}|${name}`;
      const cur = map.get(key) ?? { target: 0, current: 0 };
      cur.target += a.target_quantity;
      map.set(key, cur);
    }
    for (const a of acquisitions) {
      const key = `${acquisitionMonth(a)}|${a.staff_id}|${a.project?.name ?? ""}`;
      const cur = map.get(key);
      if (cur) cur.current += a.quantity;
    }
    return map;
  }, [assignments, acquisitions, nameById]);

  // タブが「全て」のときはデイリー表は当月を対象にする
  const dailyTargetMonth = monthTab === "all" ? currentMonthKey : monthTab;
  const daily = useMemo(
    () => buildDaily(acquisitions, dailyTargetMonth, view),
    [acquisitions, dailyTargetMonth, view]
  );

  const totals = useMemo(
    () => ({
      target: sum(cells, (c) => c.target),
      targetAmount: sum(cells, (c) => c.targetAmount),
      acquiredQty: sum(cells, (c) => c.acquiredQty),
      acquiredAmount: sum(cells, (c) => c.acquiredAmount),
      confirmedQty: sum(cells, (c) => c.confirmedQty),
      confirmedAmount: sum(cells, (c) => c.confirmedAmount),
    }),
    [cells]
  );

  const monthText = (m: string) =>
    spansMultipleYears ? `${m.slice(0, 4)}年${Number(m.slice(5, 7))}月` : `${Number(m.slice(5, 7))}月`;
  const midHeader = view === "op" ? "案件名" : "OP";
  const topKind = view === "op" ? "OP" : "案件";
  const midLabel = (c: Cell) => (view === "op" ? c.projectName : c.opName);
  const COLS = 8;

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
        <AcquisitionButton projects={projects} staffList={staffList} currentUserId={currentUserId} progress={progress} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">{midHeader}</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">設定件数</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">設定金額</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">獲得件数</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">進捗率</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">獲得金額</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">有効件数</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">確定金額</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((group) => (
              <Fragment key={group.key}>
                <tr className="bg-slate-700">
                  <td colSpan={COLS} className="px-3 py-2 font-bold text-white">
                    {group.label}
                  </td>
                </tr>
                {group.cells.map((cell) => {
                  const cellKey = `${group.key}|${cell.key}`;
                  const canExpand = cell.leaves.length > 0;
                  return (
                    <Fragment key={cellKey}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-700">
                          {canExpand ? (
                            <button
                              type="button"
                              onClick={() => toggle(setExpanded, cellKey)}
                              className="flex items-center gap-1.5 text-left hover:text-slate-900"
                              aria-label={expanded.has(cellKey) ? "単価ごとの内訳を閉じる" : "単価ごとの内訳を開く"}
                            >
                              <span className="inline-block w-3 text-xs text-slate-400">
                                {expanded.has(cellKey) ? "▼" : "▶"}
                              </span>
                              {midLabel(cell)}
                            </button>
                          ) : (
                            <span className="pl-[18px]">{midLabel(cell)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">{qtyText(cell.target)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(cell.targetAmount)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          <QtyWithDetail
                            qty={cell.acquiredQty}
                            entries={cell.leaves.flatMap((l) => l.entries)}
                            isAdmin={isAdmin}
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          <Progress acquired={cell.acquiredQty} target={cell.target} />
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(cell.acquiredAmount)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{qtyText(cell.confirmedQty)}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">
                          {formatCurrency(Math.round(cell.confirmedAmount))}
                        </td>
                      </tr>
                      {expanded.has(cellKey) &&
                        cell.leaves.map((leaf) => {
                          const leafKey = `${cellKey}|${leaf.key}`;
                          return (
                            <Fragment key={leafKey}>
                              <tr className="bg-slate-50/70 text-xs">
                                <td className="px-3 py-1.5 pl-9 text-slate-600">
                                  {monthTab === "all" && `${monthText(leaf.month)}　`}単価 {formatCurrency(leaf.unitPrice)}
                                </td>
                                <td className="px-3 py-1.5" colSpan={2} />
                                <td className="px-3 py-1.5 text-right text-slate-600">
                                  <QtyWithDetail qty={leaf.acquiredQty} entries={leaf.entries} isAdmin={isAdmin} />
                                </td>
                                <td className="px-3 py-1.5" />
                                <td className="px-3 py-1.5 text-right text-slate-600">
                                  {formatCurrency(leaf.acquiredAmount)}
                                </td>
                                <td className="px-3 py-1.5 text-right text-slate-600">
                                  <ConfirmedInput key={leaf.confirmedQty} leaf={leaf} isAdmin={isAdmin} />
                                </td>
                                <td className="px-3 py-1.5 text-right font-medium text-slate-800">
                                  {formatCurrency(Math.round(leaf.confirmedAmount))}
                                </td>
                              </tr>
                            </Fragment>
                          );
                        })}
                    </Fragment>
                  );
                })}
                <tr className="border-t-2 border-slate-300 bg-slate-200 font-bold text-slate-900">
                  <td className="px-3 py-2">{group.label}　小計</td>
                  <td className="px-3 py-2 text-right">{qtyText(group.target)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(group.targetAmount)}</td>
                  <td className="px-3 py-2 text-right">{qtyText(group.acquiredQty)}</td>
                  <td className="px-3 py-2 text-right">
                    <Progress acquired={group.acquiredQty} target={group.target} />
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(group.acquiredAmount)}</td>
                  <td className="px-3 py-2 text-right">{qtyText(group.confirmedQty)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(Math.round(group.confirmedAmount))}</td>
                </tr>
              </Fragment>
            ))}
            {cells.length === 0 && (
              <tr>
                <td colSpan={COLS} className="px-3 py-6 text-center text-slate-400">
                  この期間の案件設定・獲得データがありません
                </td>
              </tr>
            )}
          </tbody>
          {cells.length > 0 && (
            <tfoot className="border-t-2 border-slate-400 bg-slate-300 font-bold text-slate-900">
              <tr>
                <td className="px-3 py-2">合計</td>
                <td className="px-3 py-2 text-right">{qtyText(totals.target)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.targetAmount)}</td>
                <td className="px-3 py-2 text-right">{qtyText(totals.acquiredQty)}</td>
                <td className="px-3 py-2 text-right">
                  <Progress acquired={totals.acquiredQty} target={totals.target} />
                </td>
                <td className="px-3 py-2 text-right">{formatCurrency(totals.acquiredAmount)}</td>
                <td className="px-3 py-2 text-right">{qtyText(totals.confirmedQty)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(Math.round(totals.confirmedAmount))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="-mt-3 text-xs text-slate-400">
        {topKind}ごとにまとめています。設定件数は「案件設定」で決めた件数、設定金額＝設定件数×案件のデフォルト単価、獲得件数は案件獲得の登録の合計です。進捗率＝獲得件数÷設定件数です。有効件数は、行の▶で開く単価ごとの欄に入力します（管理者のみ）。確定金額＝有効件数×単価です。
        行の▶を押すと単価ごとの件数が見えます。獲得件数にカーソルを当てると、登録日ごとの件数が表示されます。
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
