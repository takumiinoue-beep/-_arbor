"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatYearMonth } from "@/lib/period";
import { carryOverProjects } from "../dashboard/actions";

// 進行中の案件を、まとめて指定した月（初期値は来月）の案件として作成する
export function CarryOverButton({ defaultMonth }: { defaultMonth: string }) {
  const [month, setMonth] = useState(defaultMonth);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    if (
      !confirm(
        `進行中の案件を${formatYearMonth(month)}の案件として作成します。\n` +
          "料金表はそのまま引き継ぎ、実績件数・確定件数は0から始まります。\n" +
          `すでに${formatYearMonth(month)}の案件がある案件は作成しません。\n` +
          `先に登録済みの${formatYearMonth(month)}計上の獲得（アポなど）は、新しい案件に付け替わります。`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await carryOverProjects(month);
      if ("error" in result) {
        alert(result.error);
        return;
      }
      alert(
        result.created > 0
          ? `${result.created}件の案件を作成しました。`
          : "作成する案件はありませんでした（すべて作成済みか、進行中の案件がありません）。"
      );
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        aria-label="引き継ぎ先の月"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || !month}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
      >
        {pending ? "作成中..." : "進行中の案件を引き継ぐ"}
      </button>
    </div>
  );
}
