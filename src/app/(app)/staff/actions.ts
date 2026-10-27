"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import type { Role } from "@/types/database";

type FormState = { error: string } | null;

// フォームのメンバー番号（空欄は null）
function parseMemberNo(formData: FormData): { ok: true; value: number | null } | { ok: false; error: string } {
  const raw = String(formData.get("member_no") ?? "").trim();
  if (raw === "") return { ok: true, value: null };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return { ok: false, error: "メンバー番号は1以上の整数で入力してください。" };
  return { ok: true, value: n };
}

export async function createStaff(_prevState: FormState, formData: FormData) {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const role = String(formData.get("role") ?? "staff") as Role;

  const memberNo = parseMemberNo(formData);
  if (!memberNo.ok) return { error: memberNo.error };

  if (!email || !name) return { error: "メールアドレスと担当者名は必須です。" };
  if (password.length < 8) return { error: "初期パスワードは8文字以上で設定してください。" };

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, position: position || null, role },
  });

  if (error) return { error: `登録に失敗しました: ${error.message}` };

  // メンバー番号：未入力なら今ある一番大きい番号の次にする
  let no = memberNo.value;
  if (no === null) {
    const { data: last } = await admin
      .from("profiles")
      .select("member_no")
      .not("member_no", "is", null)
      .order("member_no", { ascending: false })
      .limit(1);
    no = (last?.[0]?.member_no ?? 0) + 1;
  }
  const { error: noError } = await admin.from("profiles").update({ member_no: no }).eq("id", created.user.id);
  if (noError) return { error: `担当者は登録しましたが、メンバー番号の設定に失敗しました: ${noError.message}` };

  revalidatePath("/invoices/company");
  redirect("/invoices/company");
}

export async function updateStaff(id: string, _prevState: FormState, formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const role = String(formData.get("role") ?? "staff") as Role;

  if (!name) return { error: "担当者名は必須です。" };
  const memberNo = parseMemberNo(formData);
  if (!memberNo.ok) return { error: memberNo.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ name, position: position || null, role, member_no: memberNo.value })
    .eq("id", id);

  if (error) return { error: `更新に失敗しました: ${error.message}` };

  revalidatePath("/invoices/company");
  revalidatePath("/project-settings");
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
