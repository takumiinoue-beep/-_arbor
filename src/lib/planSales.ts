import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fiscalRange } from "@/lib/accounting";
import { expectedBilledByStaff, type ExpectedAssignment, type ExpectedProject } from "@/lib/projects";

// 計画の売上の自動値：その事業年度の案件設定の見込請求金額（件数×デフォルト単価×有効率）を、OP×月ごとに合計する
export async function loadExpectedSales(fy: number): Promise<Map<string, Map<string, number>>> {
  const { from, toExclusive } = fiscalRange(fy);
  const supabase = await createClient();
  const [{ data: assignments }, { data: projects }] = await Promise.all([
    supabase
      .from("project_assignments")
      .select("month, staff_id, project_id, target_quantity, effective_rate")
      .gte("month", from)
      .lt("month", toExclusive),
    supabase.from("projects").select("id, name, start_date, unit_price, price_rates(unit_price)"),
  ]);
  return expectedBilledByStaff(
    (assignments as ExpectedAssignment[]) ?? [],
    (projects as unknown as ExpectedProject[]) ?? []
  );
}
