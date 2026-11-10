"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/common/Modal";
import { formatCurrency } from "@/lib/format";
import { applyRepricing, previewRepricing, type RepriceSummaryRow } from "./actions";

// 案件一覧の単価を、登録済みの案件獲得に反映する（管理者）。
// 何がどう変わるかを月ごとに確認して、反映する月を選ぶ
export function RepriceModal({
  currentMonth,
  monthText,
  onClose,
}: {
  currentMonth: string;
  monthText: (m: string) => string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<RepriceSummaryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set([currentMonth]));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    previewRepricing().then((result) => {
      if (cancelled) return;
      if ("error" in result) setError(result.error);
      else setRows(result.rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const byMonth = useMemo(() => {
    const map = new Map<string, RepriceSummaryRow[]>();
    for (const r of rows ?? []) map.set(r.month, [...(map.get(r.month) ?? []), r]);
    return Array.from(map);
  }, [rows]);

  const chosen = (rows ?? []).filter((r) => selected.has(r.month));
  const chosenCount = chosen.reduce((sum, r) => sum + r.count, 0);
  const delta = chosen.reduce((sum, r) => sum + r.newAmount - r.oldAmount, 0);

  function toggle(month: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  function apply() {
    const months = Array.from(selected).filter((m) => byMonth.some(([month]) => month === m));
    if (
      !confirm(
        `${months.map(monthText).join("・")}の獲得${chosenCount}件の単価を、案件一覧のいまの単価に直します（金額は${
          delta >= 0 ? "+" : "-"
        }${formatCurrency(Math.abs(delta))}）。\n元の単価には戻せません。よろしいですか？`
      )
    )
      return;
    startTransition(async () => {
      const result = await applyRepricing(months);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal isOpen onClose={onClose} title="案件一覧の単価を反映" size="2xl">
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-xs text-slate-500">
          登録済みの案件獲得は、登録したときの単価のままです。案件一覧で単価を変えたあと、ここで選んだ月の獲得を、
          いまの単価（料金表に当てはまる行があればその単価、無ければデフォルトの単価）に直します。
          金額は「単価×件数」で計算し直し、入力済みの有効件数は新しい単価の行に付け替えます。
        </p>

        {rows === null && !error && <p className="py-6 text-center text-slate-400">確認しています...</p>}
        {rows !== null && rows.length === 0 && (
          <p className="py-6 text-center text-slate-500">すべての獲得が、案件一覧のいまの単価になっています。</p>
        )}

        {rows !== null && rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">案件名</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">変わる登録</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">件数</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">いまの獲得金額（税込）</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">反映後（税込）</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">差額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byMonth.map(([month, list]) => (
                  <Fragment key={month}>
                    <tr className="bg-slate-700">
                      <td colSpan={6} className="px-3 py-1.5 font-bold text-white">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected.has(month)}
                            onChange={() => toggle(month)}
                            className="h-4 w-4"
                          />
                          {monthText(month)}
                          <span className="text-xs font-normal text-slate-300">（反映する）</span>
                        </label>
                      </td>
                    </tr>
                    {list.map((r) => (
                      <tr key={`${month}|${r.projectName}`}>
                        <td className="py-1.5 pr-3 pl-6 text-slate-700">{r.projectName}</td>
                        <td className="px-3 py-1.5 text-right text-slate-700">{r.count}件</td>
                        <td className="px-3 py-1.5 text-right text-slate-700">{r.quantity}件</td>
                        <td className="px-3 py-1.5 text-right text-slate-700">{formatCurrency(r.oldAmount)}</td>
                        <td className="px-3 py-1.5 text-right text-slate-900">{formatCurrency(r.newAmount)}</td>
                        <td
                          className={`px-3 py-1.5 text-right ${r.newAmount - r.oldAmount < 0 ? "text-red-600" : "text-slate-700"}`}
                        >
                          {r.newAmount - r.oldAmount >= 0 ? "+" : "-"}
                          {formatCurrency(Math.abs(r.newAmount - r.oldAmount))}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-red-600">{error}</p>}

        {rows !== null && rows.length > 0 && (
          <p className="text-xs text-amber-700">
            過去の月も選べますが、その月の会計の売上・請求書の金額も変わります。反映すると、元の単価には戻せません。
          </p>
        )}

        <div className="flex gap-3">
          {rows !== null && rows.length > 0 && (
            <button
              type="button"
              onClick={apply}
              disabled={pending || chosenCount === 0}
              className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {pending ? "反映しています..." : `選んだ月の${chosenCount}件を反映する`}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-4 py-2 text-slate-600 hover:bg-slate-100"
          >
            閉じる
          </button>
        </div>
      </div>
    </Modal>
  );
}
