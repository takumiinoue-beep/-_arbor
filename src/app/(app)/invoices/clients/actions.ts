"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ClientType } from "@/types/database";

type FormState = { error: string } | null;

function parseClientForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "customer") as ClientType;
  const address = String(formData.get("address") ?? "").trim();
  const postalCode = String(formData.get("postal_code") ?? "").trim();

  if (!name) return { ok: false, error: "取引先名は必須です。" } as const;

  return {
    ok: true,
    value: {
      name,
      type,
      address: address || null,
      postal_code: postalCode || null,
    },
  } as const;
}

export async function createClientRecord(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseClientForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert(parsed.value);
  if (error) return { error: `登録に失敗しました: ${error.message}` };

  revalidatePath("/invoices/clients");
  revalidatePath("/invoices/issue");
  return null;
}

export async function updateClientRecord(
  id: number,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseClientForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(parsed.value).eq("id", id);
  if (error) return { error: `更新に失敗しました: ${error.message}` };

  revalidatePath("/invoices/clients");
  revalidatePath("/invoices/issue");
  redirect("/invoices/clients");
}

export async function deleteClientRecord(id: number) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/invoices/clients");
  revalidatePath("/invoices/issue");
}
