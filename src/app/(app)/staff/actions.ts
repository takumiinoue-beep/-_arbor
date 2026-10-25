"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import type { Role } from "@/types/database";

type FormState = { error: string } | null;

export async function createStaff(_prevState: FormState, formData: FormData) {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const role = String(formData.get("role") ?? "staff") as Role;

  if (!email || !name) return { error: "メールアドレスと担当者名は必須です。" };
  if (password.length < 8) return { error: "初期パスワードは8文字以上で設定してください。" };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, position: position || null, role },
  });

  if (error) return { error: `登録に失敗しました: ${error.message}` };

  revalidatePath("/invoices/company");
  redirect("/invoices/company");
}

export async function updateStaff(id: string, _prevState: FormState, formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const role = String(formData.get("role") ?? "staff") as Role;

  if (!name) return { error: "担当者名は必須です。" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ name, position: position || null, role })
    .eq("id", id);

  if (error) return { error: `更新に失敗しました: ${error.message}` };

  revalidatePath("/invoices/company");
  revalidatePath("/projects");
  redirect("/invoices/company");
}

// 画面にメッセージを返すため、失敗は throw せず { error } で返す（本番では throw したメッセージが伏せられる）
export async function deleteStaff(id: string): Promise<{ error: string } | null> {
  await requireAdmin();

  // 売上データが失われないよう、案件の担当・案件獲得のOPになっている担当者は削除しない
  const supabase = await createClient();
  const [{ count: projectCount }, { count: acquisitionCount }] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("staff_id", id),
    supabase.from("acquisitions").select("id", { count: "exact", head: true }).eq("staff_id", id),
  ]);
  if (projectCount) {
    return { error: `この担当者は${projectCount}件の案件の担当になっています。先に案件の担当者を別の人へ変更してください。` };
  }
  if (acquisitionCount) {
    return { error: `この担当者(OP)の案件獲得の登録が${acquisitionCount}件あります。売上の記録が残っているため削除できません。` };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: `削除に失敗しました: ${error.message}` };

  revalidatePath("/invoices/company");
  revalidatePath("/projects");
  revalidatePath("/accounting/members");
  return null;
}
