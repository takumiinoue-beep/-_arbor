"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ProjectStatus } from "@/types/database";

type FormState = { error: string } | null;

type PriceRateInput = {
  id: string | null;
  position: string;
  employee_min: number;
  employee_max: number | null;
  unit_price: number;
  sort_order: number;
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

    const id = String(r.id ?? "").trim();
    parsed.push({
      id: id || null,
      position,
      employee_min: employeeMin,
      employee_max: employeeMax,
      unit_price: unitPrice,
      sort_order: parsed.length,
    });
  }

  return { ok: true, value: parsed };
}

function parseProjectForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const unitPrice = Number(formData.get("unit_price") ?? 0);
  const effectiveRate = Number(formData.get("effective_rate") ?? 100);
  const status = String(formData.get("status") ?? "進行中") as ProjectStatus;
  const priceRatesRaw = String(formData.get("price_rates") ?? "[]");

  if (!name) return { ok: false, error: "案件名は必須です。" } as const;
  if (Number.isNaN(unitPrice) || unitPrice < 0)
    return { ok: false, error: "デフォルトの単価は0以上の数値で入力してください。" } as const;
  if (Number.isNaN(effectiveRate) || effectiveRate < 0 || effectiveRate > 100)
    return { ok: false, error: "有効率は0〜100で入力してください。" } as const;
  if (!["進行中", "完了", "中止"].includes(status)) return { ok: false, error: "ステータスが不正です。" } as const;

  const priceRates = parsePriceRateRows(priceRatesRaw);
  if (!priceRates.ok) return { ok: false, error: priceRates.error } as const;

  return {
    ok: true,
    value: { name, unit_price: unitPrice, effective_rate: effectiveRate, status },
    priceRates: priceRates.value,
  } as const;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// 料金表を保存する。既存の行はIDで更新し（獲得の登録とのつながりを保つため）、
// フォームから消した行だけを削除、新しい行は追加する。
async function savePriceRates(
  supabase: SupabaseClient,
  projectId: string,
  rates: PriceRateInput[]
): Promise<string | null> {
  const { data: existing, error: loadError } = await supabase
    .from("price_rates")
    .select("id")
    .eq("project_id", projectId);
  if (loadError) return loadError.message;

  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const keptIds = new Set(rates.filter((r) => r.id && existingIds.has(r.id)).map((r) => r.id as string));

  const removeIds = Array.from(existingIds).filter((id) => !keptIds.has(id));
  if (removeIds.length > 0) {
    const { error } = await supabase.from("price_rates").delete().in("id", removeIds);
    if (error) return error.message;
  }

  for (const r of rates) {
    const fields = {
      position: r.position,
      employee_min: r.employee_min,
      employee_max: r.employee_max,
      unit_price: r.unit_price,
      sort_order: r.sort_order,
    };
    if (r.id && existingIds.has(r.id)) {
      const { error } = await supabase.from("price_rates").update(fields).eq("id", r.id);
      if (error) return error.message;
    } else {
      const { error } = await supabase
        .from("price_rates")
        .insert({ ...fields, project_id: projectId, quantity: 0, actual_quantity: 0, confirmed_quantity: 0 });
      if (error) return error.message;
    }
  }
  return null;
}

export async function createProject(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseProjectForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();

  const { data: dup } = await supabase.from("projects").select("id").eq("name", parsed.value.name).limit(1);
  if (dup && dup.length > 0) return { error: "同じ名前の案件がすでに登録されています。" };

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...parsed.value, quantity: 0, start_date: new Date().toISOString().slice(0, 10) })
    .select("id")
    .single();
  if (error) return { error: `登録に失敗しました: ${error.message}` };

  const rateError = await savePriceRates(supabase, data.id, parsed.priceRates);
  if (rateError) return { error: `料金表の登録に失敗しました: ${rateError}` };

  revalidatePath("/projects");
  revalidatePath("/project-settings");
  revalidatePath("/dashboard");
  redirect("/projects");
}

export async function updateProject(id: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseProjectForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data: current } = await supabase.from("projects").select("name").eq("id", id).single();
  if (!current) return { error: "案件が見つかりません。" };

  // 案件名を変えるときは、同じ名前の過去の案件（以前は月ごとに作っていたもの）も一緒に変える
  if (current.name !== parsed.value.name) {
    const { data: dup } = await supabase.from("projects").select("id").eq("name", parsed.value.name).limit(1);
    if (dup && dup.length > 0) return { error: "同じ名前の案件がすでに登録されています。" };
    const { error: renameError } = await supabase
      .from("projects")
      .update({ name: parsed.value.name })
      .eq("name", current.name);
    if (renameError) return { error: `案件名の変更に失敗しました: ${renameError.message}` };
  }

  const { error } = await supabase.from("projects").update(parsed.value).eq("id", id);
  if (error) return { error: `更新に失敗しました: ${error.message}` };

  const rateError = await savePriceRates(supabase, id, parsed.priceRates);
  if (rateError) return { error: `料金表の更新に失敗しました: ${rateError}` };

  revalidatePath("/projects");
  revalidatePath("/project-settings");
  revalidatePath("/dashboard");
  redirect("/projects");
}

// 獲得の登録がある案件は、削除すると登録した獲得も一緒に消えてしまうため削除できない
// （使わなくなった案件はステータスを「完了」「中止」にする）。
export async function deleteProject(id: string): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: target } = await supabase.from("projects").select("name").eq("id", id).single();
  if (!target) return { error: "案件が見つかりません。" };

  const { data: versions, error: versionError } = await supabase
    .from("projects")
    .select("id")
    .eq("name", target.name);
  if (versionError) return { error: versionError.message };
  const ids = (versions ?? []).map((v) => v.id as string);

  const { count, error: countError } = await supabase
    .from("acquisitions")
    .select("id", { count: "exact", head: true })
    .in("project_id", ids);
  if (countError) return { error: countError.message };
  if ((count ?? 0) > 0) {
    return {
      error: `「${target.name}」は獲得の登録が${count}件あるため削除できません。使わない場合はステータスを「完了」か「中止」にしてください。`,
    };
  }

  const { error } = await supabase.from("projects").delete().in("id", ids);
  if (error) return { error: `削除に失敗しました: ${error.message}` };

  revalidatePath("/projects");
  revalidatePath("/project-settings");
  revalidatePath("/dashboard");
  return null;
}
