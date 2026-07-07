"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

type FormState = { error: string } | null;

export async function saveCompanySettings(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const companyName = String(formData.get("company_name") ?? "").trim();
  const representative = String(formData.get("representative") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const invoiceNumber = String(formData.get("invoice_number") ?? "").trim();

  const value = {
    company_name: companyName || null,
    representative: representative || null,
    address: address || null,
    invoice_number: invoiceNumber || null,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("company_settings").update(value).eq("id", id)
    : await supabase.from("company_settings").insert(value);

  if (error) return { error: `保存に失敗しました: ${error.message}` };

  revalidatePath("/invoices/company");
  revalidatePath("/invoices/issue");
  return null;
}

function parseBankForm(formData: FormData) {
  const bankName = String(formData.get("bank_name") ?? "").trim();
  const bankBranch = String(formData.get("bank_branch") ?? "").trim();
  const accountType = String(formData.get("account_type") ?? "").trim();
  const accountNumber = String(formData.get("account_number") ?? "").trim();
  const accountHolder = String(formData.get("account_holder") ?? "").trim();

  if (!bankName) return { ok: false, error: "銀行名は必須です。" } as const;

  return {
    ok: true,
    value: {
      bank_name: bankName,
      bank_branch: bankBranch || null,
      account_type: accountType || null,
      account_number: accountNumber || null,
      account_holder: accountHolder || null,
    },
  } as const;
}

export async function createBankAccount(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseBankForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("company_bank_accounts").insert(parsed.value);
  if (error) return { error: `登録に失敗しました: ${error.message}` };

  revalidatePath("/invoices/company");
  revalidatePath("/invoices/issue");
  return null;
}

export async function deleteBankAccount(id: number) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("company_bank_accounts").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/invoices/company");
  revalidatePath("/invoices/issue");
}
