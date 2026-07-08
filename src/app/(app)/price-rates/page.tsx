import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import { createPriceRate } from "./actions";
import { PriceRateForm } from "./PriceRateForm";
import { DeletePriceRateButton } from "./DeletePriceRateButton";

export default async function PriceRatesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: priceRates } = await supabase
    .from("price_rates")
    .select("*")
    .order("position")
    .order("employee_min");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">料金表</h1>
      <p className="-mt-4 text-xs text-slate-400">
        取引先担当者の役職と取引先企業の従業員数の組み合わせで単価を決めるための料金マトリクスです。案件登録時にここから単価が自動反映されます。
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">料金設定の登録</h2>
        <PriceRateForm action={createPriceRate} submitLabel="登録する" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">役職</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">従業員数</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">単価</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(priceRates ?? []).map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{r.position}</td>
                <td className="px-3 py-2 text-slate-600">
                  {r.employee_min}人 〜 {r.employee_max ? `${r.employee_max}人` : "上限なし"}
                </td>
                <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(r.unit_price)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <Link href={`/price-rates/${r.id}/edit`} className="text-xs text-slate-600 hover:underline">
                      編集
                    </Link>
                    <DeletePriceRateButton id={r.id} />
                  </div>
                </td>
              </tr>
            ))}
            {(priceRates ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  料金設定が登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
