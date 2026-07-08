"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

type FormState = { error: string } | null;

function parsePriceRateForm(formData: FormData) {
  const position = String(formData.get("position") ?? "").trim();
  const employeeMin = Number(formData.get("employee_min") ?? 0);
  const employeeMaxRaw = String(formData.get("employee_max") ?? "").trim();
  const unitPrice = Number(formData.get("unit_price") ?? 0);

  if (!position) return { ok: false, error: "役職は必須です。" } as const;
  if (!Number.isInteger(employeeMin) || employeeMin < 0)
    return { ok: false, error: "従業員数（下限）は0以上の整数で入力してください。" } as const;

  const employeeMax = employeeMaxRaw === "" ? null : Number(employeeMaxRaw);
  if (employeeMax !== null && (!Number.isInteger(employeeMax) || employeeMax < employeeMin))
    return { ok: false, error: "従業員数（上限）は下限以上の整数、または空欄（上限なし）にしてください。" } as const;

  if (Number.isNaN(unitPrice) || unitPrice < 0)
    return { ok: false, error: "単価は0以上の数値で入力してください。" } as const;

  return {
    ok: true,
    value: {
      position,
      employee_min: employeeMin,
      employee_max: employeeMax,
      unit_price: unitPrice,
    },
  } as const;
}

export async function createPriceRate(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parsePriceRateForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("price_rates").insert(parsed.value);
  if (error) return { error: `登録に失敗しました: ${error.message}` };

  revalidatePath("/price-rates");
  revalidatePath("/projects/new");
  return null;
}

export async function updatePriceRate(
  id: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const parsed = parsePriceRateForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("price_rates").update(parsed.value).eq("id", id);
  if (error) return { error: `更新に失敗しました: ${error.message}` };

  revalidatePath("/price-rates");
  revalidatePath("/projects/new");
  redirect("/price-rates");
}

export async function deletePriceRate(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("price_rates").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/price-rates");
  revalidatePath("/projects/new");
}
