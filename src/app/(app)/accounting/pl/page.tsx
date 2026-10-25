import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
import { monthlyBilledByStaff, type OpConfirmedRecord, type SalesAcquisition } from "@/lib/sales";
import {
  buildActualInput,
  buildAutoPlan,
  fiscalMonths,
  fiscalRange,
  planSalesByStaff,
  resolvePlan,
} from "@/lib/accounting";
import type { Expense, Member, PlPlanEntry, VendorInvoice } from "@/types/database";
import { FiscalYearNav } from "../FiscalYearNav";
import { resolveFiscalYear } from "../fy";
import { PlClient } from "./PlClient";

export default async function PlPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const fy = resolveFiscalYear((await searchParams).fy);
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
    { data: staff },
    { data: opConfirmed },
    { data: projects },
    { data: rates },
  ] = await Promise.all([
    requireAdmin(),
    fetchAllRows<SalesAcquisition>((a, b) =>
      supabase
        .from("acquisitions")
        .select("acquired_date, quantity, unit_price, staff_id, project_id, rate_id")
        .order("acquired_date")
        .order("id")
        .range(a, b)
    ),
    supabase.from("members").select("*"),
    supabase.from("expenses").select("*").gte("expense_month", from).lt("expense_month", toExclusive),
    supabase
      .from("vendor_invoices")
      .select("*, client:clients(name)")
      .gte("invoice_date", from)
      .lt("invoice_date", toExclusive),
    supabase.from("pl_plan_entries").select("*").gte("plan_month", from).lt("plan_month", toExclusive),
    supabase.from("profiles").select("id, name"),
    supabase.from("op_confirmed_quantities").select("project_id, rate_id, staff_id, confirmed_quantity"),
    supabase.from("projects").select("id, confirmed_quantity"),
    supabase.from("price_rates").select("id, project_id, confirmed_quantity"),
  ]);

  const sharedConfirmed = new Map<string, number>();
  for (const p of projects ?? []) sharedConfirmed.set(`${p.id}:`, p.confirmed_quantity);
  for (const r of rates ?? []) sharedConfirmed.set(`${r.project_id}:${r.id}`, r.confirmed_quantity);

  const salesByStaff = monthlyBilledByStaff({
    acquisitions,
    opConfirmed: (opConfirmed as OpConfirmedRecord[]) ?? [],
    sharedConfirmed,
  });
  const staffNames = new Map((staff ?? []).map((s) => [s.id as string, s.name as string]));

  const registered = {
    months,
    members: (members as Member[]) ?? [],
    expenses: (expenses as Expense[]) ?? [],
    vendorInvoices: (vendorInvoices as (VendorInvoice & { client: { name: string } | null })[]) ?? [],
    staffNames,
  };
  const actual = buildActualInput({ ...registered, salesByStaff });

  // 計画：登録内容（メンバー・経費・取引先請求）から自動計算し、計画入力の手入力で上書き
  const planEntryList = (planEntries as PlPlanEntry[]) ?? [];
  const staffIdByName = new Map((staff ?? []).map((s) => [s.name as string, s.id as string]));
  const autoPlan = buildAutoPlan({
    ...registered,
    salesByStaff: planSalesByStaff(planEntryList, months, staffIdByName),
  });
  const plan = resolvePlan(planEntryList, months, autoPlan).input;

  return (
    <div className="flex flex-col gap-4">
      <FiscalYearNav basePath="/accounting/pl" fy={fy} />
      <PlClient months={months} plan={plan} actual={actual} />
    </div>
  );
}
