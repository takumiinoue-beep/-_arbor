"use client";

import { useActionState } from "react";
import { createBankAccount } from "./actions";

export function BankAccountForm() {
  const [state, formAction, pending] = useActionState(createBankAccount, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">銀行名</label>
        <input
          name="bank_name"
          required
          className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">支店名</label>
        <input name="bank_branch" className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">口座種別</label>
        <input
          name="account_type"
          placeholder="普通"
          className="w-24 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">口座番号</label>
        <input
          name="account_number"
          className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">口座名義</label>
        <input
          name="account_holder"
          className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "保存中..." : "登録する"}
      </button>

      {state?.error && (
        <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}
