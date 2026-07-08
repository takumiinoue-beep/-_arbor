"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { PriceRate } from "@/types/database";

type Action = (
  prevState: { error: string } | null,
  formData: FormData
) => Promise<{ error: string } | null>;

export function PriceRateForm({
  action,
  priceRate,
  submitLabel,
  showCancel,
}: {
  action: Action;
  priceRate?: PriceRate;
  submitLabel: string;
  showCancel?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">役職</label>
        <input
          name="position"
          required
          defaultValue={priceRate?.position}
          placeholder="例：部長"
          className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">従業員数（下限）</label>
        <input
          name="employee_min"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={priceRate?.employee_min ?? 0}
          className="w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">従業員数（上限・空欄で上限なし）</label>
        <input
          name="employee_max"
          type="number"
          min={0}
          step={1}
          defaultValue={priceRate?.employee_max ?? ""}
          className="w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">単価（円）</label>
        <input
          name="unit_price"
          type="number"
          min={0}
          required
          defaultValue={priceRate?.unit_price ?? 0}
          className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "保存中..." : submitLabel}
      </button>
      {showCancel && (
        <Link
          href="/price-rates"
          className="rounded-md border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          キャンセル
        </Link>
      )}

      {state?.error && (
        <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}
