"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

type FormState = { error: string; success?: boolean } | null;

export async function updateOwnProfile(_prevState: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();

  const name = String(formData.get("name") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();

  if (!name) return { error: "名前は必須です。" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ name, position: position || null })
    .eq("id", profile.id);

  if (error) return { error: `更新に失敗しました: ${error.message}` };

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { error: "", success: true };
}
