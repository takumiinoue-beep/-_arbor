"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { PriceRate, Profile, Project } from "@/types/database";
import { formatCurrency, formatPercent } from "@/lib/format";

type Action = (
  prevState: { error: string } | null,
  formData: FormData
) => Promise<{ error: string } | null>;

type PriceRateRow = {
  position: string;
  employee_min: string;
  employee_max: string;
  unit_price: string;
  quantity: string;
  actual_quantity: string;
  confirmed_quantity: string;
};

const emptyRateRow: PriceRateRow = {
  position: "",
  employee_min: "0",
  employee_max: "",
  unit_price: "0",
  quantity: "0",
  actual_quantity: "0",
  confirmed_quantity: "0",
};

function findMatchingRow(rows: PriceRateRow[], position: string, employeeCount: number | null): PriceRateRow | undefined {
  if (!position || employeeCount === null || Number.isNaN(employeeCount)) return undefined;
  return rows.find((r) => {
    if (r.position !== position) return false;
    const min = Number(r.employee_min) || 0;
    const max = r.employee_max === "" ? null : Number(r.employee_max);
    return employeeCount >= min && (max === null || employeeCount <= max);
  });
}

export function ProjectForm({
  action,
  staffList,
  priceRates,
  project,
  existingNames,
  submitLabel,
}: {
  action: Action;
  staffList: Profile[];
  priceRates: PriceRate[];
  project?: Project;
  existingNames: string[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const isExistingName = !!project && existingNames.includes(project.name);
  const [nameMode, setNameMode] = useState<"select" | "new">(
    project && !isExistingName ? "new" : "select"
  );
  const [selectedName, setSelectedName] = useState(isExistingName ? project!.name : "");
  const [newName, setNewName] = useState(project && !isExistingName ? project.name : "");
  const [unitPrice, setUnitPrice] = useState(project ? String(project.unit_price) : "");
  const [quantity, setQuantity] = useState(project ? String(project.quantity) : "");
  const [actualQuantity, setActualQuantity] = useState(project ? String(project.actual_quantity) : "0");
  const [confirmedQuantity, setConfirmedQuantity] = useState(
    project ? String(project.confirmed_quantity) : "0"
  );
  const [clientPosition, setClientPosition] = useState(project?.client_position ?? "");
  const [clientEmployeeCount, setClientEmployeeCount] = useState(
    project?.client_employee_count != null ? String(project.client_employee_count) : ""
  );
  const [rateRows, setRateRows] = useState<PriceRateRow[]>(
    priceRates.length > 0
      ? priceRates.map((r) => ({
          position: r.position,
          employee_min: String(r.employee_min),
          employee_max: r.employee_max === null ? "" : String(r.employee_max),
          unit_price: String(r.unit_price),
          quantity: String(r.quantity),
          actual_quantity: String(r.actual_quantity),
          confirmed_quantity: String(r.confirmed_quantity),
        }))
      : []
  );

  const unitPriceNum = Number(unitPrice) || 0;
  const quantityNum = Number(quantity) || 0;
  const actualQuantityNum = Number(actualQuantity) || 0;
  const confirmedQuantityNum = Number(confirmedQuantity) || 0;

  const hasRateRows = rateRows.length > 0;
  const rateRowsTotalBudget = rateRows.reduce(
    (sum, r) => sum + (Number(r.unit_price) || 0) * (Number(r.quantity) || 0),
    0
  );
  const rateRowsTotalActual = rateRows.reduce(
    (sum, r) => sum + (Number(r.unit_price) || 0) * (Number(r.actual_quantity) || 0),
    0
  );
  const rateRowsTotalActualQty = rateRows.reduce((sum, r) => sum + (Number(r.actual_quantity) || 0), 0);
  const rateRowsTotalConfirmedQty = rateRows.reduce(
    (sum, r) => sum + (Number(r.confirmed_quantity) || 0),
    0
  );
  const totalBudget = hasRateRows ? rateRowsTotalBudget : unitPriceNum * quantityNum;
  const totalActual = hasRateRows ? rateRowsTotalActual : unitPriceNum * actualQuantityNum;
  const totalActualQty = hasRateRows ? rateRowsTotalActualQty : actualQuantityNum;
  const totalConfirmedQty = hasRateRows ? rateRowsTotalConfirmedQty : confirmedQuantityNum;

  const positionOptions = Array.from(new Set(rateRows.map((r) => r.position).filter(Boolean)));
  const matchedRow = findMatchingRow(
    rateRows,
    clientPosition,
    clientEmployeeCount === "" ? null : Number(clientEmployeeCount)
  );

  function applyMatch(position: string, employeeCountStr: string) {
    const match = findMatchingRow(rateRows, position, employeeCountStr === "" ? null : Number(employeeCountStr));
    if (match) setUnitPrice(match.unit_price);
  }

  function updateRateRow(idx: number, field: keyof PriceRateRow, value: string) {
    setRateRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function addRateRow() {
    setRateRows((prev) => [...prev, { ...emptyRateRow }]);
  }

  function removeRateRow(idx: number) {
    setRateRows((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="price_rates" value={JSON.stringify(rateRows)} />

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-slate-700">
          案件名 <span className="text-red-500">*</span>
        </label>
        <input type="hidden" name="name" value={nameMode === "select" ? selectedName : newName} />
        {nameMode === "select" ? (
          <select
            id="name"
            required
            value={selectedName}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                setNameMode("new");
                setSelectedName("");
              } else {
                setSelectedName(e.target.value);
              }
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="" disabled>
              選択してください
            </option>
            {existingNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="__new__">＋ 新規入力</option>
          </select>
        ) : (
          <div className="flex gap-2">
            <input
              id="name"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="新しい案件名"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            {existingNames.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setNameMode("select");
                  setNewName("");
                }}
                className="whitespace-nowrap rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                一覧から選ぶ
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="staff_id" className="text-sm font-medium text-slate-700">
          担当者 <span className="text-red-500">*</span>
        </label>
        <select
          id="staff_id"
          name="staff_id"
          required
          defaultValue={project?.staff_id ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="" disabled>
            選択してください
          </option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="start_date" className="text-sm font-medium text-slate-700">
            開始日 <span className="text-red-500">*</span>
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            defaultValue={project?.start_date}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="end_date" className="text-sm font-medium text-slate-700">
            終了日
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            defaultValue={project?.end_date ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">この案件の料金表（役職×従業員数 → 単価）</label>
        <p className="mb-2 text-xs text-slate-400">
          この案件専用の単価設定です。他の案件には適用されません。行を登録しておくと、下の「取引先担当者の役職」「取引先企業の従業員数」を入力したときに単価が自動入力されます。予算件数・実績件数も行ごとに入力でき、案件全体の予算・実績はその合計になります。
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2 text-left font-medium text-slate-600">役職</th>
                <th className="px-2 py-2 text-left font-medium text-slate-600">従業員数(下限)</th>
                <th className="px-2 py-2 text-left font-medium text-slate-600">従業員数(上限・空欄可)</th>
                <th className="px-2 py-2 text-left font-medium text-slate-600">単価（円）</th>
                <th className="px-2 py-2 text-left font-medium text-slate-600">予算件数</th>
                <th className="px-2 py-2 text-left font-medium text-slate-600">実績件数</th>
                <th className="px-2 py-2 text-left font-medium text-slate-600">確定件数</th>
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
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.employee_min}
                      onChange={(e) => updateRateRow(idx, "employee_min", e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="number"
                      min={0}
                      value={row.unit_price}
                      onChange={(e) => updateRateRow(idx, "unit_price", e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.quantity}
                      onChange={(e) => updateRateRow(idx, "quantity", e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.actual_quantity}
                      onChange={(e) => updateRateRow(idx, "actual_quantity", e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.confirmed_quantity}
                      onChange={(e) => updateRateRow(idx, "confirmed_quantity", e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="p-1">
                    <button
                      type="button"
                      onClick={() => removeRateRow(idx)}
                      className="text-slate-300 transition-colors hover:text-red-500"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-3 py-2">
            <button type="button" onClick={addRateRow} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
              ＋ 料金設定を追加
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="client_position" className="text-sm font-medium text-slate-700">
            取引先担当者の役職
          </label>
          <input
            id="client_position"
            name="client_position"
            list="client-position-options"
            value={clientPosition}
            onChange={(e) => {
              setClientPosition(e.target.value);
              applyMatch(e.target.value, clientEmployeeCount);
            }}
            placeholder="例：部長"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <datalist id="client-position-options">
            {positionOptions.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="client_employee_count" className="text-sm font-medium text-slate-700">
            取引先企業の従業員数
          </label>
          <input
            id="client_employee_count"
            name="client_employee_count"
            type="number"
            min={0}
            step={1}
            value={clientEmployeeCount}
            onChange={(e) => {
              setClientEmployeeCount(e.target.value);
              applyMatch(clientPosition, e.target.value);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {(clientPosition || clientEmployeeCount) && (
        <p className="-mt-2 text-xs text-slate-400">
          {matchedRow
            ? `この案件の料金表に一致：${formatCurrency(Number(matchedRow.unit_price) || 0)}（単価欄に自動入力済み。手動で上書きできます）`
            : "この案件の料金表に該当する設定がありません。単価は手動で入力してください。"}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="unit_price" className="text-sm font-medium text-slate-700">
            単価（円） <span className="text-red-500">*</span>
          </label>
          <input
            id="unit_price"
            name="unit_price"
            type="number"
            min={0}
            required
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="quantity" className="text-sm font-medium text-slate-700">
            件数 {!hasRateRows && <span className="text-red-500">*</span>}
          </label>
          {hasRateRows ? (
            <>
              <input type="hidden" name="quantity" value={quantity} />
              <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400">
                料金表の行ごとに入力してください
              </p>
            </>
          ) : (
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={0}
              step={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          )}
        </div>
      </div>

      <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        予算（目標売上・自動計算）
        {hasRateRows && <span className="ml-1 text-xs text-slate-400">（料金表の予算件数の合計から算出）</span>}
        ：
        <span className="ml-1 font-semibold text-slate-900">{formatCurrency(totalBudget)}</span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="actual_quantity" className="text-sm font-medium text-slate-700">
          実績件数
        </label>
        {hasRateRows ? (
          <>
            <input type="hidden" name="actual_quantity" value={actualQuantity} />
            <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400">
              料金表の行ごとに入力してください
            </p>
          </>
        ) : (
          <input
            id="actual_quantity"
            name="actual_quantity"
            type="number"
            min={0}
            step={1}
            value={actualQuantity}
            onChange={(e) => setActualQuantity(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        )}
      </div>

      <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        実績（自動計算）
        {hasRateRows && <span className="ml-1 text-xs text-slate-400">（料金表の実績件数の合計から算出）</span>}
        ：
        <span className="ml-1 font-semibold text-slate-900">{formatCurrency(totalActual)}</span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="confirmed_quantity" className="text-sm font-medium text-slate-700">
          確定件数
        </label>
        {hasRateRows ? (
          <>
            <input type="hidden" name="confirmed_quantity" value={confirmedQuantity} />
            <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400">
              料金表の行ごとに入力してください
            </p>
          </>
        ) : (
          <input
            id="confirmed_quantity"
            name="confirmed_quantity"
            type="number"
            min={0}
            step={1}
            value={confirmedQuantity}
            onChange={(e) => setConfirmedQuantity(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        )}
      </div>

      <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        有効率（確定件数 ÷ 実績件数・自動計算）
        {hasRateRows && <span className="ml-1 text-xs text-slate-400">（料金表の件数の合計から算出）</span>}
        ：
        <span className="ml-1 font-semibold text-slate-900">
          {formatPercent(totalConfirmedQty, totalActualQty)}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="status" className="text-sm font-medium text-slate-700">
          ステータス
        </label>
        <select
          id="status"
          name="status"
          defaultValue={project?.status ?? "進行中"}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="進行中">進行中</option>
          <option value="完了">完了</option>
          <option value="中止">中止</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-slate-700">
          備考
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={project?.notes ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

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
