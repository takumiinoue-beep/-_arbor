"use client";

import { useMemo, useState } from "react";
import {
  buildPlRows,
  formatPercentValue,
  formatYen,
  monthLabel,
  type PlInput,
  type PlRow,
} from "@/lib/accounting";

type View = "both" | "plan" | "actual";

const ROW_STYLE: Record<string, string> = {
  line: "",
  subtotal: "bg-slate-50 font-semibold",
  total: "bg-slate-100 font-semibold",
  highlight: "bg-yellow-100 font-bold",
  percent: "bg-yellow-50 font-semibold text-slate-700",
  memo: "text-slate-600",
};

function cell(row: PlRow, value: number | null): string {
  if (value === null) return "-";
  if (row.kind === "percent") return formatPercentValue(value);
  return formatYen(value);
}

export function PlClient({ months, plan, actual }: { months: string[]; plan: PlInput; actual: PlInput }) {
  const [view, setView] = useState<View>("both");
  const [showZero, setShowZero] = useState(false);

  const rows = useMemo(() => buildPlRows(plan, actual, showZero), [plan, actual, showZero]);

  const showPlan = view !== "actual";
  const showActual = view !== "plan";
  const perMonth = (showPlan ? 1 : 0) + (showActual ? 1 : 0);

  const viewButton = (value: View, label: string) => (
    <button
      type="button"
      onClick={() => setView(value)}
      className={`px-3 py-1.5 text-sm ${
        view === value ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );

  const numCell = (row: PlRow, value: number | null, key: string, tone: "plan" | "actual") => (
    <td
      key={key}
      className={`whitespace-nowrap px-2 py-1 text-right ${
        tone === "actual" ? "bg-sky-50/60" : ""
      } ${value !== null && value < 0 ? "text-red-600" : ""}`}
    >
      {cell(row, value)}
    </td>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-md border border-slate-200">
          {viewButton("both", "計画と結果を並べる")}
          {viewButton("plan", "計画のみ")}
          {viewButton("actual", "結果のみ")}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} />
          0円の科目も表示
        </label>
      </div>

      <div className="overflow-auto rounded-lg border border-slate-200 bg-white" style={{ maxHeight: "75vh" }}>
        <table className="min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 top-0 z-30 min-w-44 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-left">
                科目
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  colSpan={perMonth}
                  className="sticky top-0 z-20 border-b border-l border-slate-200 bg-slate-50 px-2 py-1.5 text-center"
                >
                  {monthLabel(m)}
                </th>
              ))}
              <th
                colSpan={perMonth}
                className="sticky top-0 z-20 border-b border-l border-slate-300 bg-slate-100 px-2 py-1.5 text-center"
              >
                合計
              </th>
            </tr>
            <tr>
              {[...months, "total"].flatMap((m) => [
                showPlan && (
                  <th key={`${m}-p`} className="sticky top-7 z-20 border-b border-l border-slate-200 bg-slate-50 px-2 py-1 text-center font-medium text-slate-500">
                    計画
                  </th>
                ),
                showActual && (
                  <th key={`${m}-a`} className="sticky top-7 z-20 border-b border-slate-200 bg-sky-50 px-2 py-1 text-center font-medium text-sky-700">
                    結果
                  </th>
                ),
              ])}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={ROW_STYLE[row.kind]}>
                <td
                  className={`sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 px-2 py-1 ${
                    ROW_STYLE[row.kind] || "bg-white"
                  } ${row.kind === "line" ? "pl-4 font-normal" : ""}`}
                >
                  {row.groupTitle && (
                    <span className="mr-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {row.groupTitle}
                    </span>
                  )}
                  {row.label}
                </td>
                {months.flatMap((m, i) => [
                  showPlan && numCell(row, row.plan[i], `${m}-p`, "plan"),
                  showActual && numCell(row, row.actual[i], `${m}-a`, "actual"),
                ])}
                {showPlan && numCell(row, row.planTotal, "t-p", "plan")}
                {showActual && numCell(row, row.actualTotal, "t-a", "actual")}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        ※ 売上は「OPごとの請求金額（単価×有効件数）」を、獲得件数の月別の比率で各月に按分した金額です。
        人件費は「メンバー・人件費」、販管費は「経費」「取引先請求」の登録から、結果は自動で集計されます。
        計画は「計画入力」で入力します。
      </p>
    </div>
  );
}
