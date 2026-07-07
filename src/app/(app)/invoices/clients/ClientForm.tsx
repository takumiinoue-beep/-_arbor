"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Client } from "@/types/database";

type Action = (
  prevState: { error: string } | null,
  formData: FormData
) => Promise<{ error: string } | null>;

export function ClientForm({
  action,
  client,
  submitLabel,
  showCancel,
}: {
  action: Action;
  client?: Client;
  submitLabel: string;
  showCancel?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">取引先名</label>
        <input
          name="name"
          required
          defaultValue={client?.name}
          className="w-48 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">種別</label>
        <select
          name="type"
          defaultValue={client?.type ?? "customer"}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="customer">得意先</option>
          <option value="supplier">仕入先</option>
          <option value="other">その他</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">郵便番号</label>
        <input
          name="postal_code"
          defaultValue={client?.postal_code ?? ""}
          placeholder="123-4567"
          className="w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">住所</label>
        <input
          name="address"
          defaultValue={client?.address ?? ""}
          className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
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
          href="/invoices/clients"
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
