"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";

type FormState = { error: string } | null;

type AcquisitionRowInput = {
  project_id: string;
  rate_id: string | null;
  position: string | null;
  employee_count: number | null;
  unit_price: number;
  quantity: number;
};

function parseAcquisitionRows(
  raw: string
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
    });
  }

  if (parsed.length === 0) return { ok: false, error: "案件を1件以上追加してください。" };

  return { ok: true, value: parsed };
}

export async function createAcquisition(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await requireProfile();

  const acquiredDate = String(formData.get("acquired_date") ?? "").trim();
  const staffId = String(formData.get("staff_id") ?? "").trim();
  const rowsRaw = String(formData.get("rows") ?? "[]");

  if (!acquiredDate) return { error: "日付は必須です。" };
  if (!staffId) return { error: "OPを選択してください。" };

  const parsed = parseAcquisitionRows(rowsRaw);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_acquisitions_batch", {
    p_acquired_date: acquiredDate,
    p_staff_id: staffId,
    p_created_by: profile.id,
    p_rows: parsed.value,
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
