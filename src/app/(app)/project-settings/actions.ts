"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export type AssignmentRowInput = {
  staffId: string;
  projectId: string;
  target: number;
  rate: number;
  memo: string;
};

// 月の案件設定を丸ごと保存する（month は "YYYY-MM"）
export async function saveProjectAssignments(
  month: string,
  rows: AssignmentRowInput[]
): Promise<{ error: string } | null> {
  await requireAdmin();
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "月の形式が不正です。" };

  const seen = new Set<string>();
  const payload: Record<string, unknown>[] = [];
  for (const r of rows) {
    if (!r.projectId) continue; // 案件未選択の行は保存しない
    if (!r.staffId) return { error: "メンバーが選択されていない行があります。" };
    if (!Number.isInteger(r.target) || r.target < 0) return { error: "件数は0以上の整数で入力してください。" };
    if (!Number.isFinite(r.rate) || r.rate < 0 || r.rate > 100) return { error: "有効率は0〜100で入力してください。" };
    const key = `${r.staffId}:${r.projectId}`;
    if (seen.has(key)) return { error: "同じメンバーに同じ案件が重複しています。" };
    seen.add(key);
    payload.push({
      staff_id: r.staffId,
      project_id: r.projectId,
      target_quantity: r.target,
      effective_rate: r.rate,
      memo: r.memo.trim(),
      sort_order: payload.length,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_project_assignments", { p_month: `${month}-01`, p_rows: payload });
  if (error) return { error: `保存に失敗しました: ${error.message}` };

  revalidatePath("/project-settings");
  return null;
}
