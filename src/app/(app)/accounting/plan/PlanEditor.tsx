"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SECTION_LABELS, monthLabel, formatYen } from "@/lib/accounting";
import type { PlSection } from "@/types/database";
import { savePlActual, savePlan } from "../actions";

export type EditorRow = { section: PlSection; label: string; values: string[]; auto: string[] | null; fixed: boolean };

const SECTIONS: PlSection[] = ["sales", "labor", "outsource", "sga"];

export function PlanEditor({
  mode = "plan",
  fy,
  months,
  initialRows,
  suggestions,
}: {
  mode?: "plan" | "actual";
  fy: number;
  months: string[];
  initialRows: EditorRow[];
  suggestions: Record<PlSection, string[]>;
}) {
  const [rows, setRows] = useState<EditorRow[]>(initialRows);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function update(idx: number, patch: Partial<EditorRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setDirty(true);
    setMessage(null);
  }

  function updateValue(idx: number, monthIdx: number, value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, values: r.values.map((v, m) => (m === monthIdx ? value : v)) } : r))
    );
    setDirty(true);
    setMessage(null);
  }

  function fillAll(idx: number) {
    const first = rows[idx].values.find((v) => Number(v) !== 0) ?? rows[idx].values[0] ?? "0";
    update(idx, { values: Array(12).fill(first) });
  }

  function resetToAuto(idx: number) {
    const auto = rows[idx].auto;
    if (auto) update(idx, { values: [...auto] });
  }

  function addRow(section: PlSection) {
    setRows((prev) => {
      const lastIdx = prev.map((r) => r.section).lastIndexOf(section);
      const next = [...prev];
      next.splice(lastIdx + 1, 0, { section, label: "", values: Array(12).fill("0"), auto: null, fixed: false });
      return next;
    });
    setDirty(true);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await (mode === "plan" ? savePlan : savePlActual)(
        fy,
        rows.map((r) => ({
          section: r.section,
          label: r.label,
          values: r.values.map((v) => Number(v) || 0),
          auto: r.auto ? r.auto.map((v) => Number(v) || 0) : null,
        }))
      );
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setDirty(false);
      setMessage({ type: "ok", text: "保存しました" });
      router.refresh();
    });
  }

  const inputClass = "w-24 rounded border border-slate-300 px-1.5 py-1 text-right text-xs";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {mode === "plan" ? (
          <p className="text-xs text-slate-500">
            メンバー人件費・経費・取引先請求の登録内容は、計画に<span className="mx-1 rounded bg-sky-100 px-1 text-sky-700">自動で反映</span>されます（青い欄）。
            金額を書き換えた月だけが手入力として保存されます（0円には変更できないので、不要な登録は削除してください）。
            売上は手入力です。行名にOP名を入れると、結果の行と同じ行に並び、そのOPのインセンティブの計画計算にも使われます。
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            売上（獲得登録・有効件数）・メンバー人件費・経費・取引先請求の登録内容から、結果は
            <span className="mx-1 rounded bg-sky-100 px-1 text-sky-700">自動で計算</span>されています（青い欄）。
            実際の数字と違う月は、金額を書き換えて保存してください。書き換えた月だけが手入力として優先され、他の月は自動計算のままです
            （「自動に戻す」で元に戻せます。0円には変更できません）。
          </p>
        )}
        <div className="flex items-center gap-3">
          {message && (
            <span className={`text-sm ${message.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
              {message.text}
            </span>
          )}
          {dirty && !message && <span className="text-xs text-amber-600">未保存の変更があります</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {pending ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>

      {SECTIONS.map((section) => {
        const indexed = rows.map((r, idx) => ({ r, idx })).filter((x) => x.r.section === section);
        const sectionTotals = months.map((_, m) => indexed.reduce((sum, x) => sum + (Number(x.r.values[m]) || 0), 0));
        const listId = `suggest-${section}`;
        return (
          <div key={section} className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <datalist id={listId}>
              {suggestions[section].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky left-0 z-10 min-w-44 bg-slate-50 px-2 py-2 text-left font-semibold text-slate-700">
                    {SECTION_LABELS[section]}
                  </th>
                  {months.map((m) => (
                    <th key={m} className="px-1 py-2 text-center font-medium text-slate-500">
                      {monthLabel(m)}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right font-medium text-slate-500">合計</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {indexed.map(({ r, idx }) => (
                  <tr key={idx}>
                    <td className="sticky left-0 z-10 bg-white px-2 py-1">
                      {r.fixed ? (
                        <span className="text-slate-700">
                          {r.label}
                          {r.auto && (
                            <span className="ml-1.5 rounded bg-sky-100 px-1 text-[10px] text-sky-700">自動</span>
                          )}
                        </span>
                      ) : (
                        <input
                          list={listId}
                          value={r.label}
                          onChange={(e) => update(idx, { label: e.target.value })}
                          placeholder="行の名前"
                          className="w-40 rounded border border-slate-300 px-1.5 py-1 text-xs"
                        />
                      )}
                    </td>
                    {r.values.map((v, m) => (
                      <td key={m} className="px-0.5 py-0.5">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={v}
                          onChange={(e) => updateValue(idx, m, e.target.value)}
                          className={`${inputClass} ${
                            r.auto && Number(v) === Number(r.auto[m]) && Number(v) !== 0
                              ? "border-sky-300 bg-sky-50"
                              : ""
                          }`}
                        />
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-2 py-1 text-right text-slate-700">
                      {formatYen(r.values.reduce((s, v) => s + (Number(v) || 0), 0))}
                    </td>
                    <td className="whitespace-nowrap px-1 py-1 text-right">
                      {r.auto && (
                        <button
                          type="button"
                          onClick={() => resetToAuto(idx)}
                          className="mr-2 text-[11px] text-sky-700 hover:underline"
                          title="手入力をやめて、登録内容からの自動値に戻す"
                        >
                          自動に戻す
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => fillAll(idx)}
                        className="mr-2 text-[11px] text-slate-500 hover:text-slate-800 hover:underline"
                        title="最初に入力した金額を全ての月にコピー"
                      >
                        全月同額
                      </button>
                      {!r.fixed && (
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="text-[11px] text-red-500 hover:underline"
                        >
                          削除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr>
                  <td className="sticky left-0 z-10 bg-slate-50 px-2 py-1.5 text-slate-700">{SECTION_LABELS[section]} 計</td>
                  {sectionTotals.map((t, m) => (
                    <td key={m} className="whitespace-nowrap px-1 py-1.5 text-right text-slate-700">
                      {formatYen(t)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-2 py-1.5 text-right text-slate-900">
                    {formatYen(sectionTotals.reduce((a, b) => a + b, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
            <div className="border-t border-slate-100 px-3 py-2">
              <button
                type="button"
                onClick={() => addRow(section)}
                className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
              >
                ＋ {SECTION_LABELS[section]}の行を追加
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
