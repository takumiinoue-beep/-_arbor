import { createClient } from "@/lib/supabase/server";
import { fiscalMonths, fiscalRange, planEntriesToInput, SGA_ACCOUNTS } from "@/lib/accounting";
import type { Member, PlPlanEntry, PlSection } from "@/types/database";
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

  const [{ data: planEntries }, { data: members }, { data: staff }] = await Promise.all([
    supabase.from("pl_plan_entries").select("*").gte("plan_month", from).lt("plan_month", toExclusive),
    supabase.from("members").select("name, kind"),
    supabase.from("profiles").select("name").order("name"),
  ]);

  const input = planEntriesToInput((planEntries as PlPlanEntry[]) ?? [], months);

  const toRows = (section: PlSection): EditorRow[] =>
    input[section].map((l) => ({ section, label: l.label, values: l.values.map(String), fixed: false }));

  // 販管費は科目を固定で全て並べ、登録済みの値を入れる
  const sgaRows: EditorRow[] = SGA_ACCOUNTS.map((account) => {
    const found = input.sga.find((l) => l.label === account);
    return {
      section: "sga" as const,
      label: account,
      values: (found?.values ?? Array(12).fill(0)).map(String),
      fixed: true,
    };
  });
  for (const l of input.sga) {
    if (!(SGA_ACCOUNTS as readonly string[]).includes(l.label)) {
      sgaRows.push({ section: "sga", label: l.label, values: l.values.map(String), fixed: false });
    }
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
