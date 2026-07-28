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
  const rateId = String(formData.get("rate_id") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const employeeCountRaw = String(formData.get("employee_count") ?? "").trim();
  const unitPrice = Number(formData.get("unit_price") ?? 0);
  const quantity = Number(formData.get("quantity") ?? 1);

  if (!acquiredDate) return { error: "日付は必須です。" };
  if (!projectId) return { error: "案件（商材）を選択してください。" };
  if (Number.isNaN(unitPrice) || unitPrice <= 0) {
    return { error: "単価を決定できませんでした。役職・従業員数の選択を確認してください。" };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { error: "件数は1以上の整数で入力してください。" };
  }

  const employeeCount = employeeCountRaw === "" ? null : Number(employeeCountRaw);
  if (employeeCount !== null && (!Number.isInteger(employeeCount) || employeeCount < 0)) {
    return { error: "従業員数は0以上の整数で入力してください。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_acquisition", {
    p_acquired_date: acquiredDate,
    p_project_id: projectId,
    p_rate_id: rateId || null,
    p_position: position || null,
    p_employee_count: employeeCount,
    p_unit_price: unitPrice,
    p_quantity: quantity,
    p_created_by: profile.id,
  });

  if (error) return { error: `登録に失敗しました: ${error.message}` };

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  return null;
}

export async function deleteAcquisition(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_acquisition", { p_id: id });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/projects");
}
