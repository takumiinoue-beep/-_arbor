"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
import { needsMonthlyCopy } from "@/lib/projectMonths";
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
      sort_order: parsed.length,
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

// 来月計上として先に登録した獲得（来月のアポなど）を、この案件につなげる。
// 案件の登録・更新自体は成功しているので、失敗しても案件の保存は止めない。
async function linkMonthAcquisitions(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string) {
  const { error } = await supabase.rpc("link_acquisitions_to_project", { p_project_id: projectId });
  if (error) console.error("link_acquisitions_to_project failed:", error.message);
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

  await linkMonthAcquisitions(supabase, data.id);

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

  await linkMonthAcquisitions(supabase, id);

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

// ---------- 案件の引き継ぎ（毎月の案件を作る） ----------

export type CarryOverCandidate = {
  id: string;
  name: string;
  staffName: string | null;
  startMonth: string; // 引き継ぎ元の開始月 "YYYY-MM"
  appointmentQty: number; // 引き継ぎ先の月に計上する獲得（来月商談など）の件数
};

// 指定した月に引き継げる案件（案件名ごとに一番新しい案件で、進行中・まだその月の案件が無いもの）。
// その月に計上する獲得（先に登録された商談）の件数も合わせて返す。
export async function listCarryOverCandidates(
  month: string
): Promise<{ error: string } | { candidates: CarryOverCandidate[] }> {
  await requireAdmin();
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "月の形式が不正です。" };

  const supabase = await createClient();

  const monthStart = `${month}-01`;
  const next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1));
  const nextStart = next.toISOString().slice(0, 10);

  const [{ data: projects, error: projectError }, explicit, implicit] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, start_date, end_date, status, staff:profiles!projects_staff_id_fkey(name)")
      .order("start_date", { ascending: false }),
    fetchAllRows<{ project_id: string; quantity: number }>((a, b) =>
      supabase.from("acquisitions").select("project_id, quantity").eq("target_month", monthStart).order("id").range(a, b)
    ),
    fetchAllRows<{ project_id: string; quantity: number }>((a, b) =>
      supabase
        .from("acquisitions")
        .select("project_id, quantity")
        .is("target_month", null)
        .gte("acquired_date", monthStart)
        .lt("acquired_date", nextStart)
        .order("id")
        .range(a, b)
    ),
  ]);
  if (projectError) return { error: projectError.message };

  type P = {
    id: string;
    name: string;
    start_date: string;
    end_date: string | null;
    status: ProjectStatus;
    staff: { name: string } | null;
  };
  const all = (projects ?? []) as unknown as P[];
  const nameById = new Map(all.map((p) => [p.id, p.name]));

  const qtyByName = new Map<string, number>();
  for (const a of [...explicit, ...implicit]) {
    const name = nameById.get(a.project_id);
    if (name) qtyByName.set(name, (qtyByName.get(name) ?? 0) + a.quantity);
  }

  // 案件名ごとに一番新しい案件（開始日の降順で並んでいる）
  const latestByName = new Map<string, P>();
  for (const p of all) if (!latestByName.has(p.name)) latestByName.set(p.name, p);

  const candidates = Array.from(latestByName.values())
    .filter((p) => needsMonthlyCopy(p, month))
    .map((p) => ({
      id: p.id,
      name: p.name,
      staffName: p.staff?.name ?? null,
      startMonth: p.start_date.slice(0, 7),
      appointmentQty: qtyByName.get(p.name) ?? 0,
    }))
    .sort((a, b) => b.appointmentQty - a.appointmentQty || a.name.localeCompare(b.name, "ja"));

  return { candidates };
}

// 選んだ案件を、指定した月（"YYYY-MM"）の案件として引き継ぐ。
// その月に計上する獲得（来月商談など）は、新しい案件へ付け替わる。
export async function carryOverProjects(
  month: string,
  projectIds: string[]
): Promise<{ error: string } | { created: number }> {
  await requireAdmin();
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "月の形式が不正です。" };
  if (projectIds.length === 0) return { error: "引き継ぐ案件を選択してください。" };

  const supabase = await createClient();
  let created = 0;
  for (const id of projectIds) {
    const { error } = await supabase.rpc("carry_over_project", { p_source_id: id, p_month: `${month}-01` });
    if (error) {
      revalidatePath("/projects");
      revalidatePath("/dashboard");
      return {
        error: `引き継ぎに失敗しました（${created}件は作成済み）: ${error.message}`,
      };
    }
    created += 1;
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { created };
}
