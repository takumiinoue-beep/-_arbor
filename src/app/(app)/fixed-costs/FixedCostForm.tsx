"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FixedCost } from "@/types/database";

type Action = (
  prevState: { error: string } | null,
  formData: FormData
) => Promise<{ error: string } | null>;

export function FixedCostForm({
  action,
  fixedCost,
  submitLabel,
  showCancel,
}: {
  action: Action;
  fixedCost?: FixedCost;
  submitLabel: string;
  showCancel?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">品目名</label>
        <input
          name="item_name"
          required
          defaultValue={fixedCost?.item_name}
          placeholder="例：オフィス家賃"
          className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">金額（円）</label>
        <input
          name="amount"
          type="number"
          min={1}
          required
          defaultValue={fixedCost?.amount}
          className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">発生周期</label>
        <select
          name="period_type"
          defaultValue={fixedCost?.period_type ?? "毎月"}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="毎月">毎月</option>
          <option value="毎年">毎年</option>
          <option value="単発">単発</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">対象年月</label>
        <input
          name="target_month"
          type="month"
          required
          defaultValue={fixedCost?.target_month?.slice(0, 7)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">備考</label>
        <input
          name="notes"
          defaultValue={fixedCost?.notes ?? ""}
          className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
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
          href="/fixed-costs"
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
