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
  const { error } = await supabase.rpc("create_acquisitions_batch", {
    p_acquired_date: acquiredDate,
    p_staff_id: null,
    p_created_by: profile.id,
    p_rows: parsed.value,
    p_target_month: null,
  });

  if (error) return { error: `登録に失敗しました: ${error.message}` };

  revalidatePath("/dashboard");
  revalidatePath("/project-settings");
  return null;
}

// 単価ごとの有効件数を保存する（管理者のみ）。month は "YYYY-MM"
export async function setConfirmedQuantity(input: {
  month: string;
  staffId: string;
  projectName: string;
  unitPrice: number;
  quantity: number;
}): Promise<{ error: string } | null> {
  await requireAdmin();

  if (!/^\d{4}-\d{2}$/.test(input.month)) return { error: "月の形式が不正です。" };
  if (!Number.isFinite(input.quantity) || input.quantity < 0) return { error: "有効件数は0以上で入力してください。" };

  const supabase = await createClient();
  const { error } = await supabase.from("confirmed_quantities").upsert(
    {
      month: `${input.month}-01`,
      staff_id: input.staffId,
      project_name: input.projectName,
      unit_price: input.unitPrice,
      quantity: Math.round(input.quantity * 100) / 100,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "month,staff_id,project_name,unit_price" }
  );
  if (error) {
    return {
      error: error.message.includes("confirmed_quantities")
        ? "保存できませんでした。マイグレーション 0028 を実行してください。"
        : `保存できませんでした: ${error.message}`,
    };
  }

  revalidatePath("/dashboard");
  return null;
}

export async function deleteAcquisition(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_acquisition", { p_id: id });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/project-settings");
}
