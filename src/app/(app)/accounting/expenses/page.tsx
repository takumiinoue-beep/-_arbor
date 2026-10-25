import { createClient } from "@/lib/supabase/server";
import { expenseOverlapFilter, fiscalMonths, fiscalRange } from "@/lib/accounting";
import type { Expense } from "@/types/database";
import { FiscalYearNav } from "../FiscalYearNav";
import { resolveFiscalYear } from "../fy";
import { ExpensesClient } from "./ExpensesClient";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const fy = resolveFiscalYear((await searchParams).fy);
  const { from, toExclusive } = fiscalRange(fy);
  const supabase = await createClient();

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .lt("expense_month", toExclusive)
    .or(expenseOverlapFilter(from))
    .order("expense_month", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <FiscalYearNav basePath="/accounting/expenses" fy={fy} />
      <ExpensesClient
        key={fy}
        months={fiscalMonths(fy)}
        expenses={(expenses as Expense[]) ?? []}
        defaultMonth={new Date().toISOString().slice(0, 7)}
      />
    </div>
  );
}
