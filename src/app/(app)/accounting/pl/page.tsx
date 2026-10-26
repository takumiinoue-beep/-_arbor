import { buildAutoPlan, planSalesByStaff, resolveWithSalesTax } from "@/lib/accounting";
import { FiscalYearNav } from "../FiscalYearNav";
import { resolveFiscalYear } from "../fy";
import { loadAccounting } from "../loadAccounting";
import { PlClient } from "./PlClient";

export default async function PlPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const fy = resolveFiscalYear((await searchParams).fy);
  const { months, registered, staffIdByName, planEntries, actualEntries, autoActual } = await loadAccounting(fy);

  // 計画：登録内容（メンバー・経費・取引先請求）から自動計算し、計画入力の手入力で上書き
  const autoPlan = buildAutoPlan({
    ...registered,
    salesByStaff: planSalesByStaff(planEntries, months, staffIdByName),
  });
  const plan = resolveWithSalesTax(planEntries, months, autoPlan).input;

  // 結果：登録内容から自動計算し、結果入力の手入力で上書き
  const actual = resolveWithSalesTax(actualEntries, months, autoActual, "結果入力で手入力した金額").input;

  return (
    <div className="flex flex-col gap-4">
      <FiscalYearNav basePath="/accounting/pl" fy={fy} />
      <PlClient months={months} plan={plan} actual={actual} />
    </div>
  );
}
