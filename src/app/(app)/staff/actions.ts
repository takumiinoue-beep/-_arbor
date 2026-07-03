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

  revalidatePath("/staff");
  redirect("/staff");
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

  revalidatePath("/staff");
  revalidatePath("/projects");
  redirect("/staff");
}

export async function deleteStaff(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);

  revalidatePath("/staff");
  revalidatePath("/projects");
}
