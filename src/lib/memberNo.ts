import "server-only";
import type { createClient } from "@/lib/supabase/server";

// 今ある一番大きいメンバー番号の次の番号（誰も番号を持っていなければ1）
export async function nextMemberNo(supabase: Awaited<ReturnType<typeof createClient>>): Promise<number> {
  const { data: last } = await supabase
    .from("profiles")
    .select("member_no")
    .not("member_no", "is", null)
    .order("member_no", { ascending: false })
    .limit(1);
  return (last?.[0]?.member_no ?? 0) + 1;
}
