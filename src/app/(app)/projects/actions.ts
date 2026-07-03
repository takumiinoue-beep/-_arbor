"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";
import type { ProjectStatus } from "@/types/database";

type FormState = { error: string } | null;

function parseProjectForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const staffId = String(formData.get("staff_id") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const budget = Number(formData.get("budget") ?? 0);
  const actual = Number(formData.get("actual") ?? 0);
  const status = String(formData.get("status") ?? "進行中") as ProjectStatus;
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { ok: false, error: "案件名は必須です。" } as const;
  if (!startDate) return { ok: false, error: "開始日は必須です。" } as const;
  if (!staffId) return { ok: false, error: "担当者を選択してください。" } as const;
  if (Number.isNaN(budget) || budget < 0)
    return { ok: false, error: "予算は0以上の数値で入力してください。" } as const;

  return {
    ok: true,
    value: {
      name,
      staff_id: staffId,
      start_date: startDate,
      end_date: endDate || null,
      budget,
      actual: Number.isNaN(actual) ? 0 : actual,
      status,
      notes: notes || null,
    },
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
  const { error } = await supabase.from("projects").insert(parsed.value);

  if (error) return { error: `登録に失敗しました: ${error.message}` };

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

export async function updateActual(projectId: string, newActual: number) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_project_actual", {
    p_project_id: projectId,
    p_new_actual: newActual,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/staff-summary");
  revalidatePath("/charts");
}
