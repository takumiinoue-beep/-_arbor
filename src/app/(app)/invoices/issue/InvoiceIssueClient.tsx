"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Table, { type TableColumn } from "@/components/common/Table";
import Modal from "@/components/common/Modal";
import type { Client, CompanyBankAccount, CompanySettings, InvoiceIssued } from "@/types/database";
import {
  saveInvoice,
  deleteInvoiceAction,
  updateInvoiceStatusAction,
  getInvoiceItemsAction,
} from "./actions";
import { InvoicePreview } from "./InvoicePreview";
import { buildInvoiceHTML } from "./invoiceHtml";
import {
  emptyForm,
  emptyItem,
  generateInvoiceNumber,
  toToday,
  formatAmount,
  computeTotals,
  type InvoiceForm,
  type InvoiceItemForm,
} from "./types";

type InvoiceRow = InvoiceIssued & { client_name: string | null };

type ProjectOption = {
  id: string;
  name: string;
  unit_price: number;
  actual_quantity: number;
  start_date: string;
};

function projectToItem(project: ProjectOption): InvoiceItemForm {
  return {
    description: project.name,
    quantity: String(project.actual_quantity),
    unit_price: String(project.unit_price),
    tax_rate: 0.1,
    amount: project.actual_quantity * project.unit_price,
  };
}

export function InvoiceIssueClient({
  clients,
  companyBankAccounts,
  company,
  invoices,
  projects,
}: {
  clients: Client[];
  companyBankAccounts: CompanyBankAccount[];
  company: CompanySettings | null;
  invoices: InvoiceRow[];
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState<InvoiceForm>({ ...emptyForm(), invoice_number: generateInvoiceNumber() });
  const [items, setItems] = useState<InvoiceItemForm[]>([{ ...emptyItem }]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [statusModal, setStatusModal] = useState<InvoiceRow | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  const billableProjects = useMemo(() => projects.filter((p) => p.actual_quantity > 0), [projects]);

  const projectMonths = useMemo(() => {
    const set = new Set(billableProjects.map((p) => p.start_date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [billableProjects]);

  function updateItem(idx: number, field: keyof InvoiceItemForm, val: string | number) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val } as InvoiceItemForm;
      next[idx].amount = (parseFloat(String(next[idx].quantity)) || 0) * (parseFloat(String(next[idx].unit_price)) || 0);
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }

  function appendItems(newItems: InvoiceItemForm[]) {
    if (newItems.length === 0) return;
    setItems((prev) => {
      const isBlank = prev.length === 1 && !prev[0].description && !prev[0].amount;
      return isBlank ? newItems : [...prev, ...newItems];
    });
  }

  function addItemFromProject() {
    const project = billableProjects.find((p) => p.id === selectedProjectId);
    if (!project) return;
    appendItems([projectToItem(project)]);
    setSelectedProjectId("");
  }

  function addItemsFromMonth() {
    if (!selectedMonth) return;
    const monthProjects = billableProjects.filter((p) => p.start_date.slice(0, 7) === selectedMonth);
    appendItems(monthProjects.map(projectToItem));
    setSelectedMonth("");
  }

  function removeItem(idx: number) {
    if (items.length > 1) setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const { subtotal, tax10, tax8, total } = computeTotals(items);

  function handleSave() {
    if (!form.date || !form.invoice_number) {
      setError("請求書番号と日付は必須です");
      return;
    }
    if (items.some((it) => !it.description)) {
      setError("明細の説明は必須です");
      return;
    }
    setError("");

    startTransition(async () => {
      try {
        await saveInvoice({
          id: editId ?? undefined,
          invoice_number: form.invoice_number,
          date: form.date,
          due_date: form.due_date || null,
          subject: form.subject || "",
          client_id: form.client_id ? Number(form.client_id) : null,
          client_name: form.client_name,
          company_bank_account_id: form.company_bank_account_id ? Number(form.company_bank_account_id) : null,
          notes: form.notes,
          subtotal,
          tax_8: tax8,
          tax_10: tax10,
          total,
          items: items.map((it) => ({
            description: it.description,
            quantity: parseFloat(String(it.quantity)) || 0,
            unit_price: parseFloat(String(it.unit_price)) || 0,
            tax_rate: it.tax_rate,
            amount: it.amount,
          })),
        });
        setForm({ ...emptyForm(), invoice_number: generateInvoiceNumber() });
        setItems([{ ...emptyItem }]);
        setEditId(null);
        setSuccess("保存しました");
        setTimeout(() => setSuccess(""), 3000);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  function handleEdit(row: InvoiceRow) {
    startTransition(async () => {
      try {
        const invoiceItems = await getInvoiceItemsAction(row.id);
        setForm({
          invoice_number: row.invoice_number ?? "",
          date: row.date ?? "",
          due_date: row.due_date ?? "",
          subject: row.subject ?? "",
          client_id: row.client_id ? String(row.client_id) : "",
          client_name: row.client_name ?? "",
          company_bank_account_id: row.company_bank_account_id ? String(row.company_bank_account_id) : "",
          notes: row.notes ?? "",
        });
        setItems(
          invoiceItems.length > 0
            ? invoiceItems.map((it) => ({
                description: it.description ?? "",
                quantity: String(it.quantity ?? 0),
                unit_price: String(it.unit_price ?? 0),
                tax_rate: it.tax_rate ?? 0.1,
                amount: it.amount ?? 0,
              }))
            : [{ ...emptyItem }]
        );
        setEditId(row.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        setError("編集データの取得に失敗しました");
      }
    });
  }

  function handleDeleteInvoice(row: InvoiceRow) {
    if (!confirm(`請求書「${row.invoice_number}」を削除しますか？`)) return;
    startTransition(async () => {
      try {
        await deleteInvoiceAction(row.id);
        router.refresh();
      } catch {
        setError("削除に失敗しました");
      }
    });
  }

  function handleStatusUpdate(invoice: InvoiceRow, newStatus: "paid" | "unpaid") {
    startTransition(async () => {
      try {
        await updateInvoiceStatusAction(invoice.id, newStatus, newStatus === "paid" ? toToday() : null);
        setStatusModal(null);
        router.refresh();
      } catch {
        setError("ステータスの更新に失敗しました");
      }
    });
  }

  function handlePrint() {
    try {
      const html = buildInvoiceHTML(form, items, clients, companyBankAccounts, company);
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    } catch (e) {
      setError("PDF生成に失敗しました: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function handleCancel() {
    setForm({ ...emptyForm(), invoice_number: generateInvoiceNumber() });
    setItems([{ ...emptyItem }]);
    setEditId(null);
    setError("");
  }

  const invoiceColumns: TableColumn<InvoiceRow>[] = [
    { key: "invoice_number", label: "請求書番号", className: "w-36" },
    { key: "date", label: "請求日", className: "w-24" },
    { key: "client_name", label: "請求先", render: (v) => (v as string) || "-" },
    { key: "subject", label: "件名", render: (v) => (v as string) || "-" },
    {
      key: "total",
      label: "合計金額",
      className: "text-right",
      render: (v) => <span className="font-medium">{formatAmount(v as number)}</span>,
    },
    {
      key: "status",
      label: "ステータス",
      render: (v, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setStatusModal(row);
          }}
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            v === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {v === "paid" ? "入金済" : "未入金"}
        </button>
      ),
    },
    {
      key: "actions",
      label: "",
      className: "w-28 text-right",
      render: (_, row) => (
        <span className="flex justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(row);
            }}
            className="text-xs font-medium text-emerald-700 hover:text-indigo-800"
          >
            編集
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteInvoice(row);
            }}
            className="text-xs font-medium text-red-500 hover:text-red-700"
          >
            削除
          </button>
        </span>
      ),
    },
  ];

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
  const labelClass = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">請求書発行</h1>

      <div className="flex flex-col items-start gap-6 md:flex-row">
        {/* ── 左: フォーム ── */}
        <div className="min-w-0 flex-1 space-y-5 rounded-lg border border-slate-200 bg-white p-6">
          {editId && (
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <span>編集中（{form.invoice_number}）</span>
              <button onClick={handleCancel} className="text-xs underline">
                キャンセル
              </button>
            </div>
          )}
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className={labelClass}>
                請求書番号 <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>
                請求日 <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>支払期限</label>
              <input
                className={inputClass}
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>件名</label>
            <input
              className={inputClass}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="例: 2026年7月分 システム開発費"
            />
          </div>

          <div>
            <label className={labelClass}>請求先</label>
            <select
              className={inputClass}
              value={form.client_id}
              onChange={(e) => {
                const c = clients.find((c) => c.id === Number(e.target.value));
                setForm({ ...form, client_id: e.target.value, client_name: c?.name || "" });
              }}
            >
              <option value="">-- 取引先を選択 --</option>
              {clients
                .filter((c) => ["customer", "other"].includes(c.type))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {!form.client_id && (
              <input
                className={`${inputClass} mt-1`}
                placeholder="直接入力"
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              />
            )}
          </div>

          <div>
            <label className={labelClass}>振込先（自社口座）</label>
            {companyBankAccounts.length === 0 ? (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-600">
                「自社情報」から自社銀行口座を登録してください
              </div>
            ) : (
              <select
                className={inputClass}
                value={form.company_bank_account_id}
                onChange={(e) => setForm({ ...form, company_bank_account_id: e.target.value })}
              >
                <option value="">-- 振込先を選択 --</option>
                {companyBankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name}　{b.bank_branch}支店　{b.account_type}　{b.account_number}　{b.account_holder}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className={labelClass}>明細</label>

            {billableProjects.length > 0 && (
              <div className="mb-2 flex flex-col gap-2">
                {projectMonths.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className={`${inputClass} w-auto flex-1`}
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                    >
                      <option value="">-- 月をまとめて追加 --</option>
                      {projectMonths.map((m) => {
                        const count = billableProjects.filter((p) => p.start_date.slice(0, 7) === m).length;
                        return (
                          <option key={m} value={m}>
                            {Number(m.slice(5, 7))}月（{count}件）
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={addItemsFromMonth}
                      disabled={!selectedMonth}
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      ＋ 一括追加
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={`${inputClass} w-auto flex-1`}
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                  >
                    <option value="">-- 案件から明細を追加 --</option>
                    {billableProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}（実績 {p.actual_quantity}件 × ¥{p.unit_price.toLocaleString("ja-JP")}）
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addItemFromProject}
                    disabled={!selectedProjectId}
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    ＋ 追加
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="text-sm" style={{ minWidth: 600 }}>
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">内容</th>
                    <th className="w-16 px-3 py-2 text-right font-medium text-slate-600">数量</th>
                    <th className="w-28 px-3 py-2 text-right font-medium text-slate-600">単価</th>
                    <th className="w-20 px-3 py-2 text-center font-medium text-slate-600">税率</th>
                    <th className="w-28 px-3 py-2 text-right font-medium text-slate-600">金額</th>
                    <th className="w-7"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        <input
                          className={`${inputClass} py-1.5`}
                          value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                          placeholder="サービス内容"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={`${inputClass} py-1.5 text-right`}
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={`${inputClass} py-1.5 text-right`}
                          type="number"
                          min={0}
                          step={1}
                          value={item.unit_price}
                          onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          className={`${inputClass} py-1.5 text-center`}
                          value={item.tax_rate}
                          onChange={(e) => updateItem(idx, "tax_rate", parseFloat(e.target.value))}
                        >
                          <option value={0.1}>10%</option>
                          <option value={0.08}>8%</option>
                          <option value={0}>0%</option>
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-sm font-medium">
                        ¥{Math.round(item.amount || 0).toLocaleString("ja-JP")}
                      </td>
                      <td className="px-1">
                        <button
                          onClick={() => removeItem(idx)}
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
                <button onClick={addItem} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
                  ＋ 明細を追加
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-56 space-y-1 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>小計</span>
                <span>{formatAmount(subtotal)}</span>
              </div>
              {tax10 > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>消費税（10%）</span>
                  <span>{formatAmount(tax10)}</span>
                </div>
              )}
              {tax8 > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>消費税（8%）</span>
                  <span>{formatAmount(tax8)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                <span>合計</span>
                <span>{formatAmount(total)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>備考</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="その他連絡事項など"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            {editId && (
              <button
                onClick={handleCancel}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                キャンセル
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              🖨️ PDF出力
            </button>
            <button
              onClick={handleSave}
              disabled={pending}
              className="rounded-md bg-slate-900 px-8 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {editId ? "更新する" : "発行する"}
            </button>
          </div>
        </div>

        {/* ── 右: プレビュー ── */}
        <div className="w-full shrink-0 md:sticky md:top-4 md:w-96">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">プレビュー</span>
            <span className="text-xs text-slate-400">リアルタイム表示</span>
          </div>
          <div className="invoice-preview-wrap" style={{ width: "100%", maxWidth: "384px" }}>
            <div style={{ width: "100%", paddingBottom: `${(842 / 595) * 100}%`, overflow: "hidden", position: "relative" }}>
              <div
                style={{ width: "595px", transformOrigin: "top left", transform: "scale(var(--preview-scale, 0.645))", position: "absolute", top: 0, left: 0 }}
                ref={(el) => {
                  if (el) {
                    const w = el.parentElement?.parentElement?.offsetWidth || 384;
                    el.style.setProperty("--preview-scale", String(w / 595));
                  }
                }}
              >
                <InvoicePreview form={form} items={items} clients={clients} companyBankAccounts={companyBankAccounts} company={company} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 発行済一覧 */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">発行済請求書一覧</h2>
        <Table columns={invoiceColumns} data={invoices} emptyMessage="請求書が発行されていません" />
      </div>

      <Modal isOpen={!!statusModal} onClose={() => setStatusModal(null)} title="入金ステータスを変更" size="sm">
        {statusModal && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <strong>{statusModal.invoice_number}</strong> のステータスを変更します
            </p>
            <p className="text-sm font-medium">合計: {formatAmount(statusModal.total)}</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleStatusUpdate(statusModal, "paid")}
                disabled={statusModal.status === "paid"}
                className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                入金済にする
              </button>
              <button
                onClick={() => handleStatusUpdate(statusModal, "unpaid")}
                disabled={statusModal.status === "unpaid"}
                className="flex-1 rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                未入金に戻す
              </button>
            </div>
            <button
              onClick={() => setStatusModal(null)}
              className="w-full rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              閉じる
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
