"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";
import type { ProjectStatus } from "@/types/database";

type FormState = { error: string } | null;

type PriceRateInput = {
  position: string;
  employee_min: number;
  employee_max: number | null;
  unit_price: number;
  quantity: number;
  actual_quantity: number;
  confirmed_quantity: number;
};

function parsePriceRateRows(raw: string): { ok: true; value: PriceRateInput[] } | { ok: false; error: string } {
  let rows: unknown;
  try {
    rows = JSON.parse(raw || "[]");
  } catch {
    return { ok: false, error: "料金表の形式が不正です。" };
  }
  if (!Array.isArray(rows)) return { ok: false, error: "料金表の形式が不正です。" };

  const parsed: PriceRateInput[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const position = String(r.position ?? "").trim();
    if (!position) continue; // 役職未入力の行はスキップ

    const employeeMin = Number(r.employee_min);
    if (!Number.isInteger(employeeMin) || employeeMin < 0)
      return { ok: false, error: `料金表「${position}」の従業員数（下限）は0以上の整数で入力してください。` };

    const employeeMaxRaw = String(r.employee_max ?? "").trim();
    const employeeMax = employeeMaxRaw === "" ? null : Number(employeeMaxRaw);
    if (employeeMax !== null && (!Number.isInteger(employeeMax) || employeeMax < employeeMin))
      return { ok: false, error: `料金表「${position}」の従業員数（上限）は下限以上の整数、または空欄にしてください。` };

    const unitPrice = Number(r.unit_price);
    if (Number.isNaN(unitPrice) || unitPrice < 0)
      return { ok: false, error: `料金表「${position}」の単価は0以上の数値で入力してください。` };

    const quantity = Number(r.quantity ?? 0);
    if (!Number.isInteger(quantity) || quantity < 0)
      return { ok: false, error: `料金表「${position}」の予算件数は0以上の整数で入力してください。` };

    const actualQuantity = Number(r.actual_quantity ?? 0);
    if (!Number.isInteger(actualQuantity) || actualQuantity < 0)
      return { ok: false, error: `料金表「${position}」の実績件数は0以上の整数で入力してください。` };

    const confirmedQuantity = Number(r.confirmed_quantity ?? 0);
    if (!Number.isInteger(confirmedQuantity) || confirmedQuantity < 0)
      return { ok: false, error: `料金表「${position}」の確定件数は0以上の整数で入力してください。` };

    parsed.push({
      position,
      employee_min: employeeMin,
      employee_max: employeeMax,
      unit_price: unitPrice,
      quantity,
      actual_quantity: actualQuantity,
      confirmed_quantity: confirmedQuantity,
    });
  }

  return { ok: true, value: parsed };
}

function parseProjectForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const staffId = String(formData.get("staff_id") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const unitPrice = Number(formData.get("unit_price") ?? 0);
  const quantity = Number(formData.get("quantity") ?? 0);
  const actualQuantity = Number(formData.get("actual_quantity") ?? 0);
  const confirmedQuantity = Number(formData.get("confirmed_quantity") ?? 0);
  const status = String(formData.get("status") ?? "進行中") as ProjectStatus;
  const notes = String(formData.get("notes") ?? "").trim();
  const clientPosition = String(formData.get("client_position") ?? "").trim();
  const clientEmployeeCountRaw = String(formData.get("client_employee_count") ?? "").trim();
  const priceRatesRaw = String(formData.get("price_rates") ?? "[]");

  if (!name) return { ok: false, error: "案件名は必須です。" } as const;
  if (!startDate) return { ok: false, error: "開始日は必須です。" } as const;
  if (!staffId) return { ok: false, error: "担当者を選択してください。" } as const;
  if (Number.isNaN(unitPrice) || unitPrice < 0)
    return { ok: false, error: "単価は0以上の数値で入力してください。" } as const;
  if (!Number.isInteger(quantity) || quantity < 0)
    return { ok: false, error: "件数は0以上の整数で入力してください。" } as const;
  if (!Number.isInteger(actualQuantity) || actualQuantity < 0)
    return { ok: false, error: "実績件数は0以上の整数で入力してください。" } as const;
  if (!Number.isInteger(confirmedQuantity) || confirmedQuantity < 0)
    return { ok: false, error: "確定件数は0以上の整数で入力してください。" } as const;

  const clientEmployeeCount = clientEmployeeCountRaw === "" ? null : Number(clientEmployeeCountRaw);
  if (clientEmployeeCount !== null && (!Number.isInteger(clientEmployeeCount) || clientEmployeeCount < 0))
    return { ok: false, error: "取引先企業の従業員数は0以上の整数で入力してください。" } as const;

  const priceRates = parsePriceRateRows(priceRatesRaw);
  if (!priceRates.ok) return { ok: false, error: priceRates.error } as const;

  return {
    ok: true,
    value: {
      name,
      staff_id: staffId,
      start_date: startDate,
      end_date: endDate || null,
      unit_price: unitPrice,
      quantity,
      actual_quantity: actualQuantity,
      confirmed_quantity: confirmedQuantity,
      status,
      notes: notes || null,
      client_position: clientPosition || null,
      client_employee_count: clientEmployeeCount,
    },
    priceRates: priceRates.value,
  } as const;
}

export async function createProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseProjectForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").insert(parsed.value).select().single();

  if (error) return { error: `登録に失敗しました: ${error.message}` };

  if (parsed.priceRates.length > 0) {
    const { error: rateError } = await supabase
      .from("price_rates")
      .insert(parsed.priceRates.map((r) => ({ ...r, project_id: data.id })));
    if (rateError) return { error: `料金表の登録に失敗しました: ${rateError.message}` };
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect("/projects");
}

export async function updateProject(
  id: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseProjectForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(parsed.value).eq("id", id);

  if (error) return { error: `更新に失敗しました: ${error.message}` };

  const { error: deleteRateError } = await supabase.from("price_rates").delete().eq("project_id", id);
  if (deleteRateError) return { error: `料金表の更新に失敗しました: ${deleteRateError.message}` };

  if (parsed.priceRates.length > 0) {
    const { error: rateError } = await supabase
      .from("price_rates")
      .insert(parsed.priceRates.map((r) => ({ ...r, project_id: id })));
    if (rateError) return { error: `料金表の更新に失敗しました: ${rateError.message}` };
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect("/projects");
}

export async function deleteProject(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

const PROJECT_STATUSES: ProjectStatus[] = ["進行中", "完了", "中止"];

export async function updateStatus(projectId: string, newStatus: ProjectStatus) {
  await requireAdmin();

  if (!PROJECT_STATUSES.includes(newStatus)) {
    throw new Error("ステータスの値が不正です。");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status: newStatus })
    .eq("id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function updateQuantity(projectId: string, newQuantity: number) {
  await requireAdmin();

  if (!Number.isInteger(newQuantity) || newQuantity < 0) {
    throw new Error("件数は0以上の整数で入力してください。");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ quantity: newQuantity })
    .eq("id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function updateActual(projectId: string, newQuantity: number) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_project_actual", {
    p_project_id: projectId,
    p_new_quantity: newQuantity,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function updateRateQuantity(rateId: string, newQuantity: number) {
  await requireAdmin();

  if (!Number.isInteger(newQuantity) || newQuantity < 0) {
    throw new Error("件数は0以上の整数で入力してください。");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("price_rates")
    .update({ quantity: newQuantity })
    .eq("id", rateId);

  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function updateRateActual(rateId: string, newQuantity: number) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_price_rate_actual", {
    p_rate_id: rateId,
    p_new_quantity: newQuantity,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function updateConfirmedQuantity(projectId: string, newQuantity: number) {
  await requireAdmin();

  if (!Number.isInteger(newQuantity) || newQuantity < 0) {
    throw new Error("件数は0以上の整数で入力してください。");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ confirmed_quantity: newQuantity })
    .eq("id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function updateRateConfirmedQuantity(rateId: string, newQuantity: number) {
  await requireAdmin();

  if (!Number.isInteger(newQuantity) || newQuantity < 0) {
    throw new Error("件数は0以上の整数で入力してください。");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("price_rates")
    .update({ confirmed_quantity: newQuantity })
    .eq("id", rateId);

  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath("/dashboard");
}
