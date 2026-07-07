import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

// requireProfile/requireAdminはレイアウトと各ページの両方から呼ばれるため、
// React cache()でリクエスト単位にメモ化して重複呼び出しを1回にまとめる。
// getUser()（Supabaseへの実通信）ではなくgetSession()（ローカルのcookie検証のみ）
// を使うのは、proxy.ts（middleware）が同一リクエストで既にgetUser()による
// 正式なセッション検証・リダイレクトを済ませているため。
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  return profile;
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/dashboard");
  return profile;
}
