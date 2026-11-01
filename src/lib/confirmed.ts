import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
import type { ConfirmedData, ConfirmedOpRow, ConfirmedRow } from "@/lib/sales";

// ダッシュボードで入力した有効件数を全件取る（OPごとの入力と、以前の合計の入力）。
// テーブルがまだ無い（マイグレーション未実行）ときは、空として扱う。
export async function fetchConfirmedRows(): Promise<ConfirmedData> {
  const supabase = await createClient();
  const [totals, perOp] = await Promise.all([
    fetchAllRows<ConfirmedRow>((from, to) =>
      supabase
        .from("confirmed_totals")
        .select("month, project_name, unit_price, quantity")
        .order("id")
        .range(from, to)
        .overrideTypes<ConfirmedRow[], { merge: false }>()
    ).catch(() => [] as ConfirmedRow[]),
    fetchAllRows<ConfirmedOpRow>((from, to) =>
      supabase
        .from("confirmed_quantities")
        .select("month, staff_id, project_name, unit_price, quantity")
        .order("id")
        .range(from, to)
        .overrideTypes<ConfirmedOpRow[], { merge: false }>()
    ).catch(() => [] as ConfirmedOpRow[]),
  ]);
  return { totals, perOp };
}
