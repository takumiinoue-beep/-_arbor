import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
import { confirmedLines, monthlyBilledByStaff, type SalesAcquisition } from "@/lib/sales";
import { fetchConfirmedRows } from "@/lib/confirmed";
import { buildActualInput, expenseOverlapFilter, fiscalMonths, fiscalRange } from "@/lib/accounting";
import type { Expense, Member, PlActualEntry, PlPlanEntry, VendorInvoice } from "@/types/database";

// 月次PL・結果入力で共通に使う、事業年度分のデータ取得と「結果の自動値」の計算
export async function loadAccounting(fy: number) {
  const months = fiscalMonths(fy);
  const { from, toExclusive } = fiscalRange(fy);
  const supabase = await createClient();

  const [
    ,
    acquisitions,
    { data: members },
    { data: expenses },
    { data: vendorInvoices },
    { data: planEntries },
    { data: actualEntries },
    { data: staff },
    { data: projects },
    confirmed,
  ] = await Promise.all([
    requireAdmin(),
    fetchAllRows<SalesAcquisition>((a, b) =>
      supabase
        .from("acquisitions")
        .select("acquired_date, target_month, quantity, unit_price, staff_id, project_id")
        .order("acquired_date")
        .order("id")
        .range(a, b)
    ),
    supabase.from("members").select("*"),
    supabase.from("expenses").select("*").lt("expense_month", toExclusive).or(expenseOverlapFilter(from)),
    supabase
      .from("vendor_invoices")
      .select("*, client:clients(name)")
      .gte("invoice_date", from)
      .lt("invoice_date", toExclusive),
    supabase.from("pl_plan_entries").select("*").gte("plan_month", from).lt("plan_month", toExclusive),
    supabase.from("pl_actual_entries").select("*").gte("plan_month", from).lt("plan_month", toExclusive),
    supabase.from("profiles").select("id, name").order("name"),
    supabase.from("projects").select("id, name"),
    fetchConfirmedRows(),
  ]);

  // 売上＝確定金額（ダッシュボードで入力した単価ごとの有効件数 × 単価）
  const salesByStaff = monthlyBilledByStaff(
    confirmedLines({
      acquisitions,
      nameById: new Map((projects ?? []).map((p) => [p.id as string, p.name as string])),
      confirmed,
    })
  );
  const staffList = (staff ?? []) as { id: string; name: string }[];

  const registered = {
    months,
    members: (members as Member[]) ?? [],
    expenses: (expenses as Expense[]) ?? [],
    vendorInvoices: (vendorInvoices as (VendorInvoice & { client: { name: string } | null })[]) ?? [],
    staffNames: new Map(staffList.map((s) => [s.id, s.name])),
  };

  return {
    months,
    registered,
    staffList,
    staffIdByName: new Map(staffList.map((s) => [s.name, s.id])),
    planEntries: (planEntries as PlPlanEntry[]) ?? [],
    actualEntries: (actualEntries as PlActualEntry[]) ?? [],
    // 登録内容から自動計算した結果（手入力の上書き前）
    autoActual: buildActualInput({ ...registered, salesByStaff }),
  };
}
