"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import type { PriceRate, Project, ProjectStatus } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import { latestByName } from "@/lib/projects";
import { DeleteProjectButton } from "./DeleteProjectButton";

type ProjectRow = Project & { price_rates: PriceRate[] };

function rateRangeLabel(rate: PriceRate) {
  return rate.employee_max === null
    ? `${rate.employee_min}人以上`
    : `${rate.employee_min}〜${rate.employee_max}人`;
}

// 進行中を上、完了を下に表示する（中止はその間）
const STATUS_ORDER: Record<ProjectStatus, number> = { 進行中: 0, 中止: 1, 完了: 2 };

export function ProjectsClient({ projects, isAdmin }: { projects: ProjectRow[]; isAdmin: boolean }) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 案件名ごとに1行（以前は月ごとに同じ名前の案件を作っていたため、一番新しいものを表示する）
  const rows = useMemo(
    () =>
      Array.from(latestByName(projects).values())
        .filter((p) => {
          if (keyword && !p.name.toLowerCase().includes(keyword.toLowerCase())) return false;
          if (status && p.status !== status) return false;
          return true;
        })
        .sort(
          (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, "ja")
        ),
    [projects, keyword, status]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">キーワード</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="案件名"
              className="w-48 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">ステータス</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus | "")}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">すべて</option>
              <option value="進行中">進行中</option>
              <option value="完了">完了</option>
              <option value="中止">中止</option>
            </select>
          </div>
        </div>

        {isAdmin && (
          <Link
            href="/projects/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            + 案件を登録
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full whitespace-nowrap divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">案件名</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">デフォルト単価</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">有効率</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">ステータス</th>
              {isAdmin && <th className="px-3 py-2 text-left font-medium text-slate-500">操作</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => {
              const rates = [...p.price_rates].sort((a, b) => a.sort_order - b.sort_order);
              return (
                <Fragment key={p.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {rates.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(p.id)}
                          className="flex items-center gap-1.5 text-left hover:text-slate-900"
                          aria-label={expanded.has(p.id) ? "料金表を閉じる" : "料金表を開く"}
                        >
                          <span className="inline-block w-3 text-xs text-slate-400">
                            {expanded.has(p.id) ? "▼" : "▶"}
                          </span>
                          {p.name}
                          <span className="text-xs font-normal text-slate-400">料金表 {rates.length}件</span>
                        </button>
                      ) : (
                        <span className="pl-4">{p.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(Number(p.unit_price))}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{Number(p.effective_rate)}%</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          p.status === "完了"
                            ? "bg-emerald-100 text-emerald-700"
                            : p.status === "中止"
                              ? "bg-slate-200 text-slate-600"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2">
                        <div className="flex gap-3">
                          <Link href={`/projects/${p.id}/edit`} className="text-xs text-slate-600 hover:underline">
                            編集
                          </Link>
                          <DeleteProjectButton projectId={p.id} />
                        </div>
                      </td>
                    )}
                  </tr>
                  {expanded.has(p.id) &&
                    rates.map((r) => (
                      <tr key={r.id} className="bg-slate-50/60 text-xs">
                        <td className="px-3 py-1.5 pl-9 text-slate-500">
                          └ {r.position}（{rateRangeLabel(r)}）
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-600">{formatCurrency(Number(r.unit_price))}</td>
                        <td colSpan={isAdmin ? 3 : 2} />
                      </tr>
                    ))}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-3 py-6 text-center text-slate-400">
                  該当する案件がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="-mt-2 text-xs text-slate-400">
        ここでは案件の登録だけを行います。何件やるかは「案件設定」で、獲得の登録は「ダッシュボード」で行います。
      </p>
    </div>
  );
}
