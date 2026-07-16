"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";

type FormState = { error: string } | null;

export async function createAcquisition(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await requireProfile();

  const acquiredDate = String(formData.get("acquired_date") ?? "").trim();
  const projectId = String(formData.get("project_id") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const employeeCountRaw = String(formData.get("employee_count") ?? "").trim();
  const unitPrice = Number(formData.get("unit_price") ?? 0);

  if (!acquiredDate) return { error: "日付は必須です。" };
  if (!projectId) return { error: "案件（商材）を選択してください。" };
  if (Number.isNaN(unitPrice) || unitPrice <= 0) {
    return { error: "単価を決定できませんでした。役職・従業員数の選択を確認してください。" };
  }

  const employeeCount = employeeCountRaw === "" ? null : Number(employeeCountRaw);
  if (employeeCount !== null && (!Number.isInteger(employeeCount) || employeeCount < 0)) {
    return { error: "従業員数は0以上の整数で入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("acquisitions").insert({
    acquired_date: acquiredDate,
    project_id: projectId,
    position: position || null,
    employee_count: employeeCount,
    unit_price: unitPrice,
    amount: unitPrice,
    created_by: profile.id,
  });

  if (error) return { error: `登録に失敗しました: ${error.message}` };

  revalidatePath("/dashboard");
  return null;
}

export async function deleteAcquisition(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("acquisitions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}
