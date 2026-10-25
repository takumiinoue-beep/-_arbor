"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_OPTIONS, COGS_OUTSOURCE_ACCOUNT, formatYen } from "@/lib/accounting";
import type { Client, VendorInvoice } from "@/types/database";
import { createVendorInvoice, deleteVendorInvoice, setVendorInvoiceStatus } from "../actions";

type InvoiceRow = VendorInvoice & { client: { name: string } | null };

export function VendorInvoicesClient({
  invoices,
  clients,
  defaultDate,
}: {
  invoices: InvoiceRow[];
  clients: Pick<Client, "id" | "name" | "type">[];
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState(createVendorInvoice, null);
  const [working, startTransition] = useTransition();
  const wasPending = useRef(false);
  const router = useRouter();

  const [clientId, setClientId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [subtotal, setSubtotal] = useState("");
  const [tax, setTax] = useState("");
  const [taxTouched, setTaxTouched] = useState(false);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setClientId("");
      setVendorName("");
      setSubtotal("");
      setTax("");
      setTaxTouched(false);
      setDescription("");
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state, router]);

  function changeSubtotal(value: string) {
    setSubtotal(value);
    if (!taxTouched) setTax(value === "" ? "" : String(Math.floor(Number(value) * 0.1)));
  }

  function run(action: () => Promise<{ error: string } | null>) {
    startTransition(async () => {
      const result = await action();
      if (result?.error) alert(`失敗しました: ${result.error}`);
      else router.refresh();
    });
  }

  const nameOf = (i: InvoiceRow) => i.client?.name ?? i.vendor_name ?? "-";
  const unpaidTotal = invoices
    .filter((i) => i.status === "unpaid")
    .reduce((sum, i) => sum + Number(i.subtotal) + Number(i.tax), 0);

  const field = "rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none";
  const label = "text-xs font-medium text-slate-500";

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className={label}>取引先</label>
          <select name="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)} className={field}>
            <option value="">-- 取引先を選択 --</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {!clientId && (
          <div className="flex flex-col gap-1">
            <label className={label}>取引先名（直接入力）</label>
            <input name="vendor_name" value={vendorName} onChange={(e) => setVendorName(e.target.value)} className={`${field} w-44`} />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className={label}>請求日</label>
          <input name="invoice_date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>税抜金額（円）</label>
          <input
            name="subtotal"
            type="number"
            min={0}
            step={1}
            required
            value={subtotal}
            onChange={(e) => changeSubtotal(e.target.value)}
            className={`${field} w-32`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>消費税（円）</label>
          <input
            name="tax"
            type="number"
            min={0}
            step={1}
            value={tax}
            onChange={(e) => {
              setTax(e.target.value);
              setTaxTouched(true);
            }}
            className={`${field} w-28`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>勘定科目</label>
          <select name="account" defaultValue={COGS_OUTSOURCE_ACCOUNT} className={field}>
            {ACCOUNT_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>内容</label>
          <input name="description" value={description} onChange={(e) => setDescription(e.target.value)} className={`${field} w-44`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>支払</label>
          <select name="status" defaultValue="unpaid" className={field}>
            <option value="unpaid">未払い</option>
            <option value="paid">支払済</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "登録中..." : "登録する"}
        </button>
        {state?.error && <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      </form>

      <p className="text-xs text-slate-500">
        PLには税抜金額が、請求日の月の「勘定科目」に計上されます。未払い合計（税込）：
        <span className="ml-1 font-semibold text-slate-800">{formatYen(unpaidTotal)}</span>
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">請求日</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">取引先</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">勘定科目</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">税抜</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">消費税</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">税込</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">内容</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">支払</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((i) => (
              <tr key={i.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{i.invoice_date}</td>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">{nameOf(i)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{i.account}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700">{formatYen(Number(i.subtotal))}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-500">{formatYen(Number(i.tax))}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700">
                  {formatYen(Number(i.subtotal) + Number(i.tax))}
                </td>
                <td className="px-3 py-2 text-slate-500">{i.description ?? ""}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => run(() => setVendorInvoiceStatus(i.id, i.status === "paid" ? "unpaid" : "paid"))}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                      i.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                    title="クリックで切り替え"
                  >
                    {i.status === "paid" ? `支払済${i.paid_date ? `（${i.paid_date}）` : ""}` : "未払い"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => {
                      if (confirm(`${nameOf(i)}の請求（${formatYen(Number(i.subtotal))}）を削除しますか？`)) {
                        run(() => deleteVendorInvoice(i.id));
                      }
                    }}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                  この事業年度の取引先請求はありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
