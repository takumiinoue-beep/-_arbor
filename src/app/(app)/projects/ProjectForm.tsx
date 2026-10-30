"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Client, PriceRate, Project } from "@/types/database";

type Action = (
  prevState: { error: string } | null,
  formData: FormData
) => Promise<{ error: string } | null>;

type PriceRateRow = {
  id: string;
  position: string;
  employee_min: string;
  employee_max: string;
  unit_price: string;
};

const emptyRateRow: PriceRateRow = { id: "", position: "", employee_min: "0", employee_max: "", unit_price: "" };

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const cellInputClass = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

export function ProjectForm({
  action,
  clients,
  priceRates,
  project,
  submitLabel,
}: {
  action: Action;
  clients: Pick<Client, "id" | "name">[];
  priceRates: PriceRate[];
  project?: Project;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [rateRows, setRateRows] = useState<PriceRateRow[]>(
    priceRates.map((r) => ({
      id: r.id,
      position: r.position,
      employee_min: String(r.employee_min),
      employee_max: r.employee_max === null ? "" : String(r.employee_max),
      unit_price: String(r.unit_price),
    }))
  );

  function updateRateRow(idx: number, field: keyof PriceRateRow, value: string) {
    setRateRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <input type="hidden" name="price_rates" value={JSON.stringify(rateRows)} />

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-slate-700">
          案件名 <span className="text-red-500">*</span>
        </label>
        <input id="name" name="name" required defaultValue={project?.name ?? ""} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="client_id" className="text-sm font-medium text-slate-700">
          取引先
        </label>
        <select id="client_id" name="client_id" defaultValue={project?.client_id ?? ""} className={inputClass}>
          <option value="">（指定しない）</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400">
          どこからの案件かを、取引先ページに登録した取引先から選びます（任意）。請求書発行で、その取引先の案件だけを一括追加できます。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="unit_price" className="text-sm font-medium text-slate-700">
            デフォルトの単価（円） <span className="text-red-500">*</span>
          </label>
          <input
            id="unit_price"
            name="unit_price"
            type="number"
            min={0}
            required
            defaultValue={project ? String(project.unit_price) : ""}
            className={inputClass}
          />
          <p className="text-xs text-slate-400">料金表に当てはまらないときの単価です。</p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="effective_rate" className="text-sm font-medium text-slate-700">
            有効率（%） <span className="text-red-500">*</span>
          </label>
          <input
            id="effective_rate"
            name="effective_rate"
            type="number"
            min={0}
            max={100}
            step="0.01"
            required
            defaultValue={project ? String(Number(project.effective_rate)) : "100"}
            className={inputClass}
          />
          <p className="text-xs text-slate-400">案件設定の有効率の初期値になります。</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">料金表（役職×従業員数 → 単価）</label>
        <p className="mb-2 text-xs text-slate-400">
          案件獲得を登録するとき、取引先の役職と従業員数に合う行の単価が使われます。料金表が無い案件は、デフォルトの単価になります。
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2 text-left font-medium text-slate-600">役職</th>
                <th className="px-2 py-2 text-left font-medium text-slate-600">従業員数(下限)</th>
                <th className="px-2 py-2 text-left font-medium text-slate-600">従業員数(上限・空欄可)</th>
                <th className="px-2 py-2 text-left font-medium text-slate-600">単価（円）</th>
                <th className="w-7"></th>
              </tr>
            </thead>
            <tbody>
              {rateRows.map((row, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="p-1.5">
                    <input
                      value={row.position}
                      onChange={(e) => updateRateRow(idx, "position", e.target.value)}
                      placeholder="例：部長"
                      className={cellInputClass}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.employee_min}
                      onChange={(e) => updateRateRow(idx, "employee_min", e.target.value)}
                      className={cellInputClass}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.employee_max}
                      onChange={(e) => updateRateRow(idx, "employee_max", e.target.value)}
                      placeholder="上限なし"
                      className={cellInputClass}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="number"
                      min={0}
                      value={row.unit_price}
                      onChange={(e) => updateRateRow(idx, "unit_price", e.target.value)}
                      className={cellInputClass}
                    />
                  </td>
                  <td className="p-1">
                    <button
                      type="button"
                      onClick={() => setRateRows((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-300 transition-colors hover:text-red-500"
                      aria-label="この行を削除"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {rateRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-400">
                    料金表はありません（デフォルトの単価を使います）
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={() => setRateRows((prev) => [...prev, { ...emptyRateRow }])}
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              ＋ 料金設定を追加
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="status" className="text-sm font-medium text-slate-700">
          ステータス
        </label>
        <select id="status" name="status" defaultValue={project?.status ?? "進行中"} className={inputClass}>
          <option value="進行中">進行中</option>
          <option value="完了">完了</option>
          <option value="中止">中止</option>
        </select>
        <p className="text-xs text-slate-400">「進行中」の案件だけが、案件獲得の登録で選べます。</p>
      </div>

      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "保存中..." : submitLabel}
        </button>
        <Link
          href="/projects"
          className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
