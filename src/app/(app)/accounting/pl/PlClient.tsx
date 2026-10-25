"use client";

import { useMemo, useState } from "react";
import {
  buildPlRows,
  formatPercentValue,
  formatYen,
  monthLabel,
  type PlDetail,
  type PlInput,
  type PlRow,
} from "@/lib/accounting";

type View = "both" | "plan" | "actual";

const ROW_STYLE: Record<string, string> = {
  line: "",
  subtotal: "bg-indigo-100 font-semibold text-indigo-950",
  total: "bg-indigo-200 font-bold text-indigo-950 [&>td]:border-t-2 [&>td]:border-indigo-300",
  highlight: "bg-yellow-100 font-bold",
  percent: "bg-yellow-50 font-semibold text-slate-700",
  memo: "text-slate-600",
};

// 結果列の背景（小計・合計は行の色より一段濃くして計画列と見分ける）
const ACTUAL_STYLE: Record<string, string> = {
  line: "bg-sky-50/60",
  subtotal: "bg-indigo-200/70",
  total: "bg-indigo-300/70",
  highlight: "bg-yellow-200",
  percent: "bg-yellow-100",
  memo: "bg-sky-50/60",
};

function cell(row: PlRow, value: number | null): string {
  if (value === null) return "-";
  if (row.kind === "percent") return formatPercentValue(value);
  return formatYen(value);
}

type Tip = { title: string; details: PlDetail[]; total: number; left: number; top: number };

export function PlClient({ months, plan, actual }: { months: string[]; plan: PlInput; actual: PlInput }) {
  const [view, setView] = useState<View>("both");
  const [showZero, setShowZero] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);

  // カーソルを当てたセルの下（右端付近では左寄せ）に内訳を出す。スクロール領域に隠れないよう fixed で描画
  function showTip(e: React.MouseEvent<HTMLElement>, title: string, details: PlDetail[], total: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = 320;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top = rect.bottom + 6 + 200 > window.innerHeight ? Math.max(8, rect.top - 6 - 200) : rect.bottom + 6;
    setTip({ title, details, total, left, top });
  }

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

  const numCell = (
    row: PlRow,
    value: number | null,
    key: string,
    tone: "plan" | "actual",
    monthText: string,
    details?: PlDetail[]
  ) => {
    const hasDetails = !!details && details.length > 0;
    return (
      <td
        key={key}
        onMouseEnter={
          hasDetails
            ? (e) =>
                showTip(
                  e,
                  `${row.label}　${monthText}（${tone === "plan" ? "計画" : "結果"}）`,
                  details!,
                  value ?? 0
                )
            : undefined
        }
        onMouseLeave={hasDetails ? () => setTip(null) : undefined}
        className={`whitespace-nowrap px-2 py-1 text-right ${tone === "actual" ? ACTUAL_STYLE[row.kind] : ""} ${
          value !== null && value < 0 ? "text-red-600" : ""
        } ${hasDetails ? "cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2" : ""}`}
      >
        {cell(row, value)}
      </td>
    );
  };

  // 合計列の内訳：12か月分をまとめる（同じ内容は金額を合算）
  const totalDetails = (all: PlDetail[][] | undefined): PlDetail[] => {
    const merged = new Map<string, number>();
    for (const month of all ?? []) for (const d of month) merged.set(d.text, (merged.get(d.text) ?? 0) + d.amount);
    return Array.from(merged, ([text, amount]) => ({ text, amount }));
  };

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
                  showPlan && numCell(row, row.plan[i], `${m}-p`, "plan", monthLabel(m), row.planDetails?.[i]),
                  showActual && numCell(row, row.actual[i], `${m}-a`, "actual", monthLabel(m), row.actualDetails?.[i]),
                ])}
                {showPlan && numCell(row, row.planTotal, "t-p", "plan", "年間合計", totalDetails(row.planDetails))}
                {showActual &&
                  numCell(row, row.actualTotal, "t-a", "actual", "年間合計", totalDetails(row.actualDetails))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tip && (
        <div
          className="pointer-events-none fixed z-50 w-80 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xl"
          style={{ left: tip.left, top: tip.top }}
        >
          <p className="mb-1.5 font-semibold text-slate-800">{tip.title}</p>
          <ul className="flex flex-col gap-1">
            {tip.details.map((d, i) => (
              <li key={i} className="flex items-start justify-between gap-3">
                <span className="text-slate-600">{d.text}</span>
                <span className="whitespace-nowrap font-medium text-slate-800">{formatYen(d.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 flex justify-between border-t border-slate-100 pt-1.5 font-semibold text-slate-800">
            <span>合計</span>
            <span>{formatYen(tip.total)}</span>
          </p>
        </div>
      )}

      <p className="text-xs text-slate-400">
        ※ 金額にカーソルを当てると、その内訳（登録した経費・メンバー・取引先請求）が表示されます。<br />
        ※ 売上は「OPごとの請求金額（単価×有効件数）」を、獲得件数の月別の比率で各月に按分した金額です。
        人件費は「メンバー・人件費」、販管費は「経費」「取引先請求」の登録から、結果は自動で集計されます。
        計画は「計画入力」で入力します。
      </p>
    </div>
  );
}
