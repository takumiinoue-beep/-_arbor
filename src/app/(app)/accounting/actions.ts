"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ACCOUNT_OPTIONS, fiscalMonths, fiscalRange } from "@/lib/accounting";
import type { MemberKind, PlSection } from "@/types/database";

export type ActionResult = { error: string } | null;

const MEMBER_KIND_VALUES: MemberKind[] = ["labor_existing", "labor_new", "outsource", "executive", "salary"];
const SECTION_VALUES: PlSection[] = ["sales", "labor", "outsource", "sga"];

function revalidateAccounting() {
  revalidatePath("/accounting/pl");
  revalidatePath("/accounting/plan");
  revalidatePath("/accounting/members");
  revalidatePath("/accounting/expenses");
  revalidatePath("/accounting/vendor-invoices");
}

// <input type="month"> の "YYYY-MM" を date 型用の "YYYY-MM-01" にする
function monthToDate(value: string): string | null {
  return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : null;
}

function parseAmount(raw: FormDataEntryValue | null, label: string): { ok: true; value: number } | { ok: false; error: string } {
  const text = String(raw ?? "").trim();
  if (text === "") return { ok: false, error: `${label}を入力してください。` };
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    return { ok: false, error: `${label}は0以上の整数で入力してください。` };
  }
  return { ok: true, value };
}

// ---------- 経費 ----------

export async function createExpense(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const profile = await requireAdmin();

  const month = monthToDate(String(formData.get("expense_month") ?? ""));
  const account = String(formData.get("account") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseAmount(formData.get("amount"), "金額");

  if (!month) return { error: "対象月を入力してください。" };
  if (!ACCOUNT_OPTIONS.includes(account)) return { error: "勘定科目を選択してください。" };
  if (!amount.ok) return { error: amount.error };

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    expense_month: month,
    account,
    amount: amount.value,
    description: description || null,
    created_by: profile.id,
  });
  if (error) return { error: `登録に失敗しました: ${error.message}` };

  revalidateAccounting();
  return null;
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAccounting();
  return null;
}

// ---------- 取引先からの請求 ----------

export async function createVendorInvoice(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const profile = await requireAdmin();

  const clientIdRaw = String(formData.get("client_id") ?? "").trim();
  const vendorName = String(formData.get("vendor_name") ?? "").trim();
  const invoiceDate = String(formData.get("invoice_date") ?? "").trim();
  const account = String(formData.get("account") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const subtotal = parseAmount(formData.get("subtotal"), "税抜金額");
  const tax = parseAmount(formData.get("tax") ?? "0", "消費税");
  const status = String(formData.get("status") ?? "unpaid") === "paid" ? "paid" : "unpaid";

  if (!clientIdRaw && !vendorName) return { error: "取引先を選択するか、取引先名を入力してください。" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) return { error: "請求日を入力してください。" };
  if (!ACCOUNT_OPTIONS.includes(account)) return { error: "勘定科目を選択してください。" };
  if (!subtotal.ok) return { error: subtotal.error };
  if (!tax.ok) return { error: tax.error };

  const supabase = await createClient();
  const { error } = await supabase.from("vendor_invoices").insert({
    client_id: clientIdRaw ? Number(clientIdRaw) : null,
    vendor_name: vendorName || null,
    invoice_date: invoiceDate,
    subtotal: subtotal.value,
    tax: tax.value,
    account,
    description: description || null,
    status,
    paid_date: status === "paid" ? invoiceDate : null,
    created_by: profile.id,
  });
  if (error) return { error: `登録に失敗しました: ${error.message}` };

  revalidateAccounting();
  return null;
}

export async function setVendorInvoiceStatus(id: string, status: "paid" | "unpaid"): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("vendor_invoices")
    .update({ status, paid_date: status === "paid" ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateAccounting();
  return null;
}

export async function deleteVendorInvoice(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("vendor_invoices").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAccounting();
  return null;
}

// ---------- メンバー ----------

export async function saveMember(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "") as MemberKind;
  const profileId = String(formData.get("profile_id") ?? "").trim();
  const startMonth = monthToDate(String(formData.get("start_month") ?? ""));
  const endMonthRaw = String(formData.get("end_month") ?? "").trim();
  const endMonth = endMonthRaw ? monthToDate(endMonthRaw) : null;
  const notes = String(formData.get("notes") ?? "").trim();
  const monthlyCost = parseAmount(formData.get("monthly_cost") ?? "0", "月額人件費");
  const social = parseAmount(formData.get("monthly_social_insurance") ?? "0", "月額法定福利費");
  const unitRaw = String(formData.get("incentive_sales_unit") ?? "").trim();
  const amountRaw = String(formData.get("incentive_amount") ?? "").trim();

  if (!name) return { error: "名前を入力してください。" };
  if (!MEMBER_KIND_VALUES.includes(kind)) return { error: "区分を選択してください。" };
  if (!startMonth) return { error: "開始月を入力してください。" };
  if (endMonthRaw && !endMonth) return { error: "終了月の形式が不正です。" };
  if (endMonth && endMonth < startMonth) return { error: "終了月は開始月以降にしてください。" };
  if (!monthlyCost.ok) return { error: monthlyCost.error };
  if (!social.ok) return { error: social.error };

  let incentiveUnit: number | null = null;
  let incentiveAmount: number | null = null;
  if (unitRaw || amountRaw) {
    const unit = parseAmount(unitRaw, "インセンティブの売上単位");
    const amount = parseAmount(amountRaw, "インセンティブ額");
    if (!unit.ok) return { error: unit.error };
    if (!amount.ok) return { error: amount.error };
    if (unit.value <= 0) return { error: "インセンティブの売上単位は1円以上で入力してください。" };
    incentiveUnit = unit.value;
    incentiveAmount = amount.value;
  }

  const value = {
    name,
    kind,
    profile_id: profileId || null,
    monthly_cost: monthlyCost.value,
    monthly_social_insurance: social.value,
    incentive_sales_unit: incentiveUnit,
    incentive_amount: incentiveAmount,
    start_month: startMonth,
    end_month: endMonth,
    notes: notes || null,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("members").update(value).eq("id", id)
    : await supabase.from("members").insert(value);
  if (error) return { error: `保存に失敗しました: ${error.message}` };

  revalidateAccounting();
  return null;
}

export async function deleteMember(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateAccounting();
  return null;
}

// ---------- 計画 ----------

export type PlanRowInput = { section: PlSection; label: string; values: number[] };

export async function savePlan(fy: number, rows: PlanRowInput[]): Promise<ActionResult> {
  await requireAdmin();

  if (!Number.isInteger(fy)) return { error: "事業年度が不正です。" };
  const months = fiscalMonths(fy);
  const { from, toExclusive } = fiscalRange(fy);

  const entries: { plan_month: string; section: PlSection; line_label: string; amount: number; sort_order: number }[] = [];
  const seen = new Set<string>();
  let order = 0;
  for (const row of rows) {
    const label = row.label.trim();
    if (!label) continue;
    if (!SECTION_VALUES.includes(row.section)) return { error: "区分が不正です。" };
    const dupKey = `${row.section}\u0000${label}`;
    if (seen.has(dupKey)) return { error: `「${label}」が同じ区分に重複しています。` };
    seen.add(dupKey);
    if (row.values.length !== 12 || row.values.some((v) => !Number.isFinite(v))) {
      return { error: `「${label}」の金額が不正です。` };
    }
    order += 1;
    row.values.forEach((value, i) => {
      entries.push({
        plan_month: `${months[i]}-01`,
        section: row.section,
        line_label: label,
        amount: Math.round(value),
        sort_order: order,
      });
    });
  }

  // 保存範囲の末日（排他的終端の1日前）
  const last = new Date(Date.parse(`${toExclusive}T00:00:00Z`) - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_pl_plan", { p_from: from, p_to: last, p_rows: entries });
  if (error) return { error: `保存に失敗しました: ${error.message}` };

  revalidateAccounting();
  return null;
}
