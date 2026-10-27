import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
import type { ConfirmedRow } from "@/lib/sales";

// ダッシュボードで入力した有効件数を全件取る。
// テーブルがまだ無い（マイグレーション未実行）ときは、空として扱う。
export async function fetchConfirmedRows(): Promise<ConfirmedRow[]> {
  const supabase = await createClient();
  return fetchAllRows<ConfirmedRow>((from, to) =>
    supabase
      .from("confirmed_quantities")
      .select("month, staff_id, project_name, unit_price, quantity")
      .order("id")
      .range(from, to)
      .overrideTypes<ConfirmedRow[], { merge: false }>()
  ).catch(() => []);
}
