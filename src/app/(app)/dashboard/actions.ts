"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { needsMonthlyCopy } from "@/lib/projectMonths";

type FormState = { error: string } | null;

type AcquisitionRowInput = {
  project_id: string;
  rate_id: string | null;
  position: string | null;
  employee_count: number | null;
  unit_price: number;
  quantity: number;
  staff_id: string;
  target_month: string | null; // "YYYY-MM-01"。獲得日と同じ月なら null
};

function parseAcquisitionRows(
  raw: string,
  acquiredDate: string
): { ok: true; value: AcquisitionRowInput[] } | { ok: false; error: string } {
  let rows: unknown;
  try {
    rows = JSON.parse(raw || "[]");
  } catch {
    return { ok: false, error: "案件の形式が不正です。" };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "案件を1件以上追加してください。" };
  }

  const parsed: AcquisitionRowInput[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const staffId = String(r.staff_id ?? "").trim();
    if (!staffId) return { ok: false, error: "OPを選択してください。" };

    const targetMonthRaw = String(r.target_month ?? "").trim();
    if (targetMonthRaw && !/^\d{4}-\d{2}$/.test(targetMonthRaw)) return { ok: false, error: "計上月の形式が不正です。" };
    // 獲得日と同じ月なら指定なし(null)として扱う
    const targetMonth =
      targetMonthRaw && targetMonthRaw !== acquiredDate.slice(0, 7) ? `${targetMonthRaw}-01` : null;

    const projectId = String(r.project_id ?? "").trim();
    if (!projectId) return { ok: false, error: "案件（商材）を選択してください。" };

    const rateId = String(r.rate_id ?? "").trim();
    const position = String(r.position ?? "").trim();
    const employeeCountRaw = String(r.employee_count ?? "").trim();
    const employeeCount = employeeCountRaw === "" ? null : Number(employeeCountRaw);
    if (employeeCount !== null && (!Number.isInteger(employeeCount) || employeeCount < 0)) {
      return { ok: false, error: "従業員数は0以上の整数で入力してください。" };
    }

    const unitPrice = Number(r.unit_price);
    if (Number.isNaN(unitPrice) || unitPrice <= 0) {
      return { ok: false, error: "単価を決定できませんでした。役職・従業員数の選択を確認してください。" };
    }

    const quantity = Number(r.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { ok: false, error: "件数は1以上の整数で入力してください。" };
    }

    parsed.push({
      project_id: projectId,
      rate_id: rateId || null,
      position: position || null,
      employee_count: employeeCount,
      unit_price: unitPrice,
      quantity,
      staff_id: staffId,
      target_month: targetMonth,
    });
  }

  if (parsed.length === 0) return { ok: false, error: "案件を1件以上追加してください。" };

  return { ok: true, value: parsed };
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// 計上月の案件がまだ無い（前の月の案件しか無い）行は、前の月の案件を引き継いで今月分を自動で作り、そちらに付け替える。
// 料金表のある案件は、同じ役職・同じ従業員数の区分の行へ移す。
async function moveRowsToMonthlyProjects(
  supabase: SupabaseClient,
  rows: AcquisitionRowInput[],
  acquiredDate: string
): Promise<string | null> {
  const ids = Array.from(new Set(rows.map((r) => r.project_id)));
  const { data: sources } = await supabase
    .from("projects")
    .select("id, start_date, end_date, status")
    .in("id", ids);
  const sourceById = new Map((sources ?? []).map((p) => [p.id as string, p]));

  const carried = new Map<string, string>(); // "元の案件ID:YYYY-MM" -> 新しい案件ID
  const rateMaps = new Map<string, { old: RateLite[]; next: RateLite[] }>();

  for (const row of rows) {
    const source = sourceById.get(row.project_id);
    const month = (row.target_month ?? `${acquiredDate.slice(0, 7)}-01`).slice(0, 7);
    if (!source || !needsMonthlyCopy(source, month)) continue;

    const key = `${source.id}:${month}`;
    let newId = carried.get(key);
    if (!newId) {
      const { data, error } = await supabase.rpc("carry_over_project", {
        p_source_id: source.id,
        p_month: `${month}-01`,
      });
      if (error) return `${month}の案件の自動作成に失敗しました: ${error.message}`;
      newId = data as string;
      carried.set(key, newId);
    }

    if (row.rate_id) {
      let maps = rateMaps.get(key);
      if (!maps) {
        const [{ data: oldRates }, { data: nextRates }] = await Promise.all([
          supabase.from("price_rates").select("id, position, employee_min, employee_max").eq("project_id", source.id),
          supabase.from("price_rates").select("id, position, employee_min, employee_max").eq("project_id", newId),
        ]);
        maps = { old: (oldRates as RateLite[]) ?? [], next: (nextRates as RateLite[]) ?? [] };
        rateMaps.set(key, maps);
      }
      const oldRate = maps.old.find((r) => r.id === row.rate_id);
      const sameBand = (r: RateLite) =>
        !!oldRate && r.position === oldRate.position && r.employee_min === oldRate.employee_min && r.employee_max === oldRate.employee_max;
      const inRange = (r: RateLite) =>
        !!oldRate &&
        r.position === oldRate.position &&
        row.employee_count !== null &&
        row.employee_count >= r.employee_min &&
        (r.employee_max === null || row.employee_count <= r.employee_max);
      const next = maps.next.find(sameBand) ?? maps.next.find(inRange);
      if (!next) continue; // 対応する行が無ければ元の案件のまま登録する
      row.rate_id = next.id;
    }
    row.project_id = newId;
  }
  return null;
}

type RateLite = { id: string; position: string; employee_min: number; employee_max: number | null };

export async function createAcquisition(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await requireProfile();

  const acquiredDate = String(formData.get("acquired_date") ?? "").trim();
  const rowsRaw = String(formData.get("rows") ?? "[]");

  if (!acquiredDate) return { error: "日付は必須です。" };

  // OP・計上月は行ごとに指定する（複数のOPの獲得を1回でまとめて登録できる）
  const parsed = parseAcquisitionRows(rowsRaw, acquiredDate);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const moveError = await moveRowsToMonthlyProjects(supabase, parsed.value, acquiredDate);
  if (moveError) return { error: moveError };

  const { error } = await supabase.rpc("create_acquisitions_batch", {
    p_acquired_date: acquiredDate,
    p_staff_id: null,
    p_created_by: profile.id,
    p_rows: parsed.value,
    p_target_month: null,
  });

  if (error) return { error: `登録に失敗しました: ${error.message}` };

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  return null;
}

export async function updateOpConfirmedQuantity(
  projectId: string,
  rateId: string | null,
  staffId: string,
  newQuantity: number
) {
  await requireAdmin();

  if (!Number.isInteger(newQuantity) || newQuantity < 0) {
    throw new Error("件数は0以上の整数で入力してください。");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_op_confirmed_quantity", {
    p_project_id: projectId,
    p_rate_id: rateId,
    p_staff_id: staffId,
    p_quantity: newQuantity,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/projects");
}

export async function deleteAcquisition(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_acquisition", { p_id: id });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/projects");
}
