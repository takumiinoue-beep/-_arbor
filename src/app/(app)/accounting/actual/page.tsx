import { planKey, resolvePlan, SGA_ACCOUNTS } from "@/lib/accounting";
import type { Member, PlSection } from "@/types/database";
import { FiscalYearNav } from "../FiscalYearNav";
import { resolveFiscalYear } from "../fy";
import { loadAccounting } from "../loadAccounting";
import { PlanEditor, type EditorRow } from "../plan/PlanEditor";

export default async function ActualPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const fy = resolveFiscalYear((await searchParams).fy);
  const { months, registered, staffList, actualEntries, autoActual } = await loadAccounting(fy);

  const { input, autoMap } = resolvePlan(actualEntries, months, autoActual, "結果入力で手入力した金額");

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
    sales: staffList.map((s) => s.name),
    labor: ["直雇用（既存）", "直雇用（新人）"],
    outsource: (registered.members as Pick<Member, "name" | "kind">[]).filter((m) => m.kind === "outsource").map((m) => m.name),
    sga: [] as string[],
  };

  return (
    <div className="flex flex-col gap-4">
      <FiscalYearNav basePath="/accounting/actual" fy={fy} />
      <PlanEditor
        key={fy}
        mode="actual"
        fy={fy}
        months={months}
        initialRows={[...toRows("sales"), ...toRows("labor"), ...toRows("outsource"), ...sgaRows]}
        suggestions={suggestions}
      />
    </div>
  );
}
