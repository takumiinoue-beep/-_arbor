"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_OPTIONS, expensePeriodLabel, formatYen, isExpenseActive } from "@/lib/accounting";
import type { Expense } from "@/types/database";
import { createExpense, deleteExpense } from "../actions";

type PeriodType = "single" | "range" | "ongoing";

export function ExpensesClient({
  expenses,
  months,
  defaultMonth,
}: {
  expenses: Expense[];
  months: string[];
  defaultMonth: string;
}) {
  const [state, formAction, pending] = useActionState(createExpense, null);
  const [deleting, startTransition] = useTransition();
  const wasPending = useRef(false);
  const router = useRouter();
  const [month, setMonth] = useState(defaultMonth);
  const [periodType, setPeriodType] = useState<PeriodType>("single");
  const [endMonth, setEndMonth] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setAmount("");
      setDescription("");
      setEndMonth("");
      setPeriodType("single");
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state, router]);

  function handleDelete(e: Expense) {
    if (!confirm(`${expensePeriodLabel(e)}「${e.account}」${formatYen(Number(e.amount))}を削除しますか？`)) return;
    startTransition(async () => {
      const result = await deleteExpense(e.id);
      if (result?.error) alert(`削除できませんでした: ${result.error}`);
      else router.refresh();
    });
  }

  // 事業年度内で計上される月数と合計
  const monthsInYear = (e: Expense) => months.filter((m) => isExpenseActive(e, m)).length;
  const total = expenses.reduce((sum, e) => sum + Number(e.amount) * monthsInYear(e), 0);

  const field = "rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none";
  const label = "text-xs font-medium text-slate-500";

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className={label}>期間</label>
          <select
            name="period_type"
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as PeriodType)}
            className={field}
          >
            <option value="single">単月のみ</option>
            <option value="range">期間を指定（毎月）</option>
            <option value="ongoing">継続（終了未定・毎月）</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>{periodType === "single" ? "対象月" : "開始月"}</label>
          <input name="expense_month" type="month" required value={month} onChange={(e) => setMonth(e.target.value)} className={field} />
        </div>
        {periodType === "range" && (
          <div className="flex flex-col gap-1">
            <label className={label}>終了月</label>
            <input
              name="end_month"
              type="month"
              required
              min={month}
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              className={field}
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className={label}>勘定科目</label>
          <select name="account" required defaultValue="" className={field}>
            <option value="" disabled>
              選択
            </option>
            {ACCOUNT_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>{periodType === "single" ? "金額（円）" : "月額（円）"}</label>
          <input
            name="amount"
            type="number"
            min={0}
            step={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${field} w-36`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>内容</label>
          <input name="description" value={description} onChange={(e) => setDescription(e.target.value)} className={`${field} w-56`} />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "登録中..." : "登録する"}
        </button>
        {state?.error && <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      </form>

      <p className="text-xs text-slate-500">
        期間を指定した経費は、開始月〜終了月の毎月に同じ月額がPLの計画・結果へ反映されます。「継続」は削除するまで毎月計上されます。
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">期間</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">勘定科目</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">金額（月額）</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">この年度の計上</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">内容</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.map((e) => {
              const n = monthsInYear(e);
              return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{expensePeriodLabel(e)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">{e.account}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700">{formatYen(Number(e.amount))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700">
                    {formatYen(Number(e.amount) * n)}
                    <span className="ml-1 text-xs text-slate-400">（{n}か月）</span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{e.description ?? ""}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => handleDelete(e)}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              );
            })}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  この事業年度の経費はありません
                </td>
              </tr>
            )}
          </tbody>
          {expenses.length > 0 && (
            <tfoot className="bg-slate-50 font-medium">
              <tr>
                <td className="px-3 py-2" colSpan={3}>
                  この年度の合計（{expenses.length}件）
                </td>
                <td className="px-3 py-2 text-right">{formatYen(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
