import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import { createFixedCost } from "./actions";
import { FixedCostForm } from "./FixedCostForm";
import { DeleteFixedCostButton } from "./DeleteFixedCostButton";

export default async function FixedCostsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: fixedCosts } = await supabase
    .from("fixed_costs")
    .select("*")
    .order("target_month", { ascending: false });

  const total = (fixedCosts ?? []).reduce((sum, f) => sum + f.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">固定費管理</h1>

      {profile.role === "admin" && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">固定費の登録</h2>
          <FixedCostForm action={createFixedCost} submitLabel="登録する" />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">品目名</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">金額</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">発生周期</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">対象年月</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">備考</th>
              {profile.role === "admin" && (
                <th className="px-3 py-2 text-left font-medium text-slate-500">操作</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(fixedCosts ?? []).map((f) => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{f.item_name}</td>
                <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(f.amount)}</td>
                <td className="px-3 py-2 text-slate-600">{f.period_type}</td>
                <td className="px-3 py-2 text-slate-600">{f.target_month.slice(0, 7)}</td>
                <td className="max-w-[200px] truncate px-3 py-2 text-slate-500" title={f.notes ?? ""}>
                  {f.notes ?? ""}
                </td>
                {profile.role === "admin" && (
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Link href={`/fixed-costs/${f.id}/edit`} className="text-xs text-slate-600 hover:underline">
                        編集
                      </Link>
                      <DeleteFixedCostButton id={f.id} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {(fixedCosts ?? []).length === 0 && (
              <tr>
                <td colSpan={profile.role === "admin" ? 6 : 5} className="px-3 py-6 text-center text-slate-400">
                  登録された固定費がありません
                </td>
              </tr>
            )}
          </tbody>
          {(fixedCosts ?? []).length > 0 && (
            <tfoot className="bg-slate-50 font-medium">
              <tr>
                <td className="px-3 py-2">合計</td>
                <td className="px-3 py-2 text-right">{formatCurrency(total)}</td>
                <td colSpan={profile.role === "admin" ? 4 : 3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
