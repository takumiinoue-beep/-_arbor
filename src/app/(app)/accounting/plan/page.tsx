import { createClient } from "@/lib/supabase/server";
import {
  buildAutoPlan,
  expenseOverlapFilter,
  fiscalMonths,
  fiscalRange,
  planKey,
  planSalesByStaff,
  resolveWithSalesTax,
  SGA_ACCOUNTS,
} from "@/lib/accounting";
import type { Expense, Member, PlPlanEntry, PlSection, VendorInvoice } from "@/types/database";
import { FiscalYearNav } from "../FiscalYearNav";
import { resolveFiscalYear } from "../fy";
import { PlanEditor, type EditorRow } from "./PlanEditor";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const fy = resolveFiscalYear((await searchParams).fy);
  const months = fiscalMonths(fy);
  const { from, toExclusive } = fiscalRange(fy);
  const supabase = await createClient();

  const [{ data: planEntries }, { data: members }, { data: expenses }, { data: vendorInvoices }, { data: staff }] =
    await Promise.all([
      supabase.from("pl_plan_entries").select("*").gte("plan_month", from).lt("plan_month", toExclusive),
      supabase.from("members").select("*"),
      supabase.from("expenses").select("*").lt("expense_month", toExclusive).or(expenseOverlapFilter(from)),
      supabase
        .from("vendor_invoices")
        .select("*, client:clients(name)")
        .gte("invoice_date", from)
        .lt("invoice_date", toExclusive),
      supabase.from("profiles").select("id, name").order("name"),
    ]);

  const entries = (planEntries as PlPlanEntry[]) ?? [];
  const staffIdByName = new Map((staff ?? []).map((s) => [s.name as string, s.id as string]));

  // 登録内容（メンバー・経費・取引先請求）から計画の自動値を作り、手入力の上書きと合成する
  const auto = buildAutoPlan({
    months,
    members: (members as Member[]) ?? [],
    expenses: (expenses as Expense[]) ?? [],
    vendorInvoices: (vendorInvoices as (VendorInvoice & { client: { name: string } | null })[]) ?? [],
    salesByStaff: planSalesByStaff(entries, months, staffIdByName),
    staffNames: new Map((staff ?? []).map((s) => [s.id as string, s.name as string])),
  });
  const { input, autoMap } = resolveWithSalesTax(entries, months, auto);

  const toRow = (section: PlSection, label: string, values: number[], fixed: boolean): EditorRow => {
    const a = autoMap.get(planKey(section, label));
    return {
      section,
      label,
      values: values.map(String),
      auto: a ? a.map(String) : null,
      fixed: fixed || !!a,
    };
  };

  const toRows = (section: PlSection): EditorRow[] =>
    input[section].map((l) => toRow(section, l.label, l.values, false));

  // 販管費は科目を固定で全て並べる
  const sgaRows: EditorRow[] = SGA_ACCOUNTS.map((account) =>
    toRow("sga", account, input.sga.find((l) => l.label === account)?.values ?? Array(12).fill(0), true)
  );
  for (const l of input.sga) {
    if (!(SGA_ACCOUNTS as readonly string[]).includes(l.label)) sgaRows.push(toRow("sga", l.label, l.values, false));
  }

  const suggestions = {
    sales: (staff ?? []).map((s) => s.name as string),
    labor: ["直雇用（既存）", "直雇用（新人）"],
    outsource: ((members as Pick<Member, "name" | "kind">[]) ?? [])
      .filter((m) => m.kind === "outsource")
      .map((m) => m.name),
    sga: [] as string[],
  };

  return (
    <div className="flex flex-col gap-4">
      <FiscalYearNav basePath="/accounting/plan" fy={fy} />
      <PlanEditor
        key={fy}
        fy={fy}
        months={months}
        initialRows={[...toRows("sales"), ...toRows("labor"), ...toRows("outsource"), ...sgaRows]}
        suggestions={suggestions}
      />
    </div>
  );
}
