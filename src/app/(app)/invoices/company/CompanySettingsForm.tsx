"use client";

import { useActionState } from "react";
import type { CompanySettings } from "@/types/database";
import { saveCompanySettings } from "./actions";

export function CompanySettingsForm({ settings }: { settings: CompanySettings | null }) {
  const [state, formAction, pending] = useActionState(saveCompanySettings, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {settings?.id && <input type="hidden" name="id" value={settings.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">会社名</label>
          <input
            name="company_name"
            defaultValue={settings?.company_name ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">代表者名</label>
          <input
            name="representative"
            defaultValue={settings?.representative ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">住所</label>
        <input
          name="address"
          defaultValue={settings?.address ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">適格請求書発行事業者登録番号</label>
        <input
          name="invoice_number"
          defaultValue={settings?.invoice_number ?? ""}
          placeholder="T1234567890123"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "保存中..." : "保存する"}
        </button>
      </div>
    </form>
  );
}
