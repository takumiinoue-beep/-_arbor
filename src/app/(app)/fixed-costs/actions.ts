"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { PeriodType } from "@/types/database";

type FormState = { error: string } | null;

function parseFixedCostForm(formData: FormData) {
  const itemName = String(formData.get("item_name") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const periodType = String(formData.get("period_type") ?? "毎月") as PeriodType;
  const targetMonthInput = String(formData.get("target_month") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!itemName) return { ok: false, error: "品目名は必須です。" } as const;
  if (Number.isNaN(amount) || amount <= 0)
    return { ok: false, error: "金額は1以上の数値で入力してください。" } as const;
  if (!targetMonthInput) return { ok: false, error: "対象年月は必須です。" } as const;

  // <input type="month"> は yyyy-MM 形式のため、date 型カラム用に日を補完する
  const targetMonth = /^\d{4}-\d{2}$/.test(targetMonthInput)
    ? `${targetMonthInput}-01`
    : targetMonthInput;

  return {
    ok: true,
    value: {
      item_name: itemName,
      amount,
      period_type: periodType,
      target_month: targetMonth,
      notes: notes || null,
    },
  } as const;
}

export async function createFixedCost(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseFixedCostForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("fixed_costs").insert(parsed.value);
  if (error) return { error: `登録に失敗しました: ${error.message}` };

  revalidatePath("/fixed-costs");
  revalidatePath("/dashboard");
  return null;
}

export async function updateFixedCost(
  id: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseFixedCostForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("fixed_costs").update(parsed.value).eq("id", id);
  if (error) return { error: `更新に失敗しました: ${error.message}` };

  revalidatePath("/fixed-costs");
  revalidatePath("/dashboard");
  redirect("/fixed-costs");
}

export async function deleteFixedCost(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("fixed_costs").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/fixed-costs");
  revalidatePath("/dashboard");
}
