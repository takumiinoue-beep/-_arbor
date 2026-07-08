"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { PriceRate, Profile, Project } from "@/types/database";
import { formatCurrency } from "@/lib/format";

type Action = (
  prevState: { error: string } | null,
  formData: FormData
) => Promise<{ error: string } | null>;

function findPriceRate(
  priceRates: PriceRate[],
  position: string,
  employeeCount: number | null
): PriceRate | undefined {
  if (!position || employeeCount === null || Number.isNaN(employeeCount)) return undefined;
  return priceRates.find(
    (r) =>
      r.position === position &&
      employeeCount >= r.employee_min &&
      (r.employee_max === null || employeeCount <= r.employee_max)
  );
}

export function ProjectForm({
  action,
  staffList,
  priceRates,
  project,
  submitLabel,
}: {
  action: Action;
  staffList: Profile[];
  priceRates: PriceRate[];
  project?: Project;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [unitPrice, setUnitPrice] = useState(project ? String(project.unit_price) : "");
  const [quantity, setQuantity] = useState(project ? String(project.quantity) : "");
  const [actualQuantity, setActualQuantity] = useState(project ? String(project.actual_quantity) : "0");
  const [clientPosition, setClientPosition] = useState(project?.client_position ?? "");
  const [clientEmployeeCount, setClientEmployeeCount] = useState(
    project?.client_employee_count != null ? String(project.client_employee_count) : ""
  );

  const unitPriceNum = Number(unitPrice) || 0;
  const quantityNum = Number(quantity) || 0;
  const actualQuantityNum = Number(actualQuantity) || 0;

  const positionOptions = Array.from(new Set(priceRates.map((r) => r.position)));
  const matchedRate = findPriceRate(
    priceRates,
    clientPosition,
    clientEmployeeCount === "" ? null : Number(clientEmployeeCount)
  );

  function applyMatch(position: string, employeeCountStr: string) {
    const match = findPriceRate(priceRates, position, employeeCountStr === "" ? null : Number(employeeCountStr));
    if (match) setUnitPrice(String(match.unit_price));
  }

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-slate-700">
          案件名 <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={project?.name}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
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
          {matchedRate
            ? `料金表に一致：${formatCurrency(matchedRate.unit_price)}（単価欄に自動入力済み。手動で上書きできます）`
            : "該当する料金表がありません。単価は手動で入力してください。"}
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
            件数 <span className="text-red-500">*</span>
          </label>
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
        </div>
      </div>

      <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        予算（目標売上・自動計算）：
        <span className="ml-1 font-semibold text-slate-900">
          {formatCurrency(unitPriceNum * quantityNum)}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="actual_quantity" className="text-sm font-medium text-slate-700">
          実績件数
        </label>
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
      </div>

      <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        実績（自動計算）：
        <span className="ml-1 font-semibold text-slate-900">
          {formatCurrency(unitPriceNum * actualQuantityNum)}
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
