"use client";

import { Fragment, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { defaultUnitPrice, latestByName } from "@/lib/projects";
import { acquisitionMonth } from "@/lib/sales";
import type { ProjectAssignment } from "@/types/database";
import { saveProjectAssignments } from "./actions";

export type SettingsProject = {
  id: string;
  name: string;
  start_date: string;
  status: string;
  unit_price: number;
  effective_rate: number;
  price_rates: { unit_price: number }[] | null;
};

export type SettingsAcquisition = {
  acquired_date: string;
  target_month: string | null;
  project_id: string;
  staff_id: string;
  quantity: number;
  amount: number;
};

type Row = { key: number; staffId: string; projectId: string; target: string; rate: string; memo: string };

// メンバーごとの色（スプレッドシートの色分け）
const STAFF_COLORS = [
  "bg-rose-200",
  "bg-sky-200",
  "bg-emerald-200",
  "bg-violet-200",
  "bg-amber-200",
  "bg-orange-200",
  "bg-cyan-200",
  "bg-lime-200",
];

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));
const pct = (v: number) => `${(Math.round(v * 100) / 100).toFixed(2)}%`;

let rowSeq = 0;
const newRow = (staffId: string, projectId = "", target = "0", rate = "100", memo = ""): Row => ({
  key: ++rowSeq,
  staffId,
  projectId,
  target,
  rate,
  memo,
});

export function ProjectSettingsClient({
  projects,
  staffList,
  assignments,
  acquisitions,
  isAdmin,
  todayISO,
}: {
  projects: SettingsProject[];
  staffList: { id: string; name: string }[];
  assignments: ProjectAssignment[];
  acquisitions: SettingsAcquisition[];
  isAdmin: boolean;
  todayISO: string;
}) {
  const currentMonthKey = todayISO.slice(0, 7);
  const nextMonthKey = new Date(Date.UTC(Number(todayISO.slice(0, 4)), Number(todayISO.slice(5, 7)), 1))
    .toISOString()
    .slice(0, 7);

  const [month, setMonth] = useState(currentMonthKey);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  // 案件は案件名ごとに1つ（過去に月ごとに作った同名の案件は、一番新しいものを使う）
  const masterByName = useMemo(() => latestByName(projects), [projects]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // 月ごとの行（保存前の編集内容も月ごとに保持）。
  // 案件設定が無いのに獲得が登録されているメンバー×案件は、件数0の行として自動で並べる（現在件数を見えるようにするため）
  const initialByMonth = useMemo(() => {
    const map = new Map<string, Row[]>();
    const seen = new Set<string>();
    for (const a of assignments) {
      const m = a.month.slice(0, 7);
      const name = projectById.get(a.project_id)?.name;
      if (name) seen.add(`${m}|${a.staff_id}|${name}`);
      map.set(m, [
        ...(map.get(m) ?? []),
        newRow(a.staff_id, a.project_id, String(a.target_quantity), String(Number(a.effective_rate)), a.memo ?? ""),
      ]);
    }
    for (const a of acquisitions) {
      const m = acquisitionMonth(a);
      const name = projectById.get(a.project_id)?.name;
      const master = name ? masterByName.get(name) : undefined;
      if (!name || !master) continue;
      const key = `${m}|${a.staff_id}|${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      map.set(m, [...(map.get(m) ?? []), newRow(a.staff_id, master.id, "0", String(Number(master.effective_rate)))]);
    }
    return map;
  }, [assignments, acquisitions, projectById, masterByName]);
  const [rowsByMonth, setRowsByMonth] = useState<Map<string, Row[]>>(initialByMonth);
  const rows = useMemo(() => rowsByMonth.get(month) ?? [], [rowsByMonth, month]);

  function setRows(updater: (prev: Row[]) => Row[]) {
    setRowsByMonth((prev) => {
      const next = new Map(prev);
      next.set(month, updater(prev.get(month) ?? []));
      return next;
    });
    setDirty(true);
    setMessage(null);
  }

  const monthTabs = useMemo(() => {
    const set = new Set<string>([currentMonthKey, nextMonthKey]);
    for (const a of assignments) set.add(a.month.slice(0, 7));
    for (const m of rowsByMonth.keys()) set.add(m);
    return Array.from(set).sort();
  }, [assignments, rowsByMonth, currentMonthKey, nextMonthKey]);
  const spansMultipleYears = new Set(monthTabs.map((m) => m.slice(0, 4))).size > 1;
  const monthText = (m: string) =>
    spansMultipleYears ? `${m.slice(0, 4)}年${Number(m.slice(5, 7))}月` : `${Number(m.slice(5, 7))}月`;

  function changeMonth(next: string) {
    if (dirty && !confirm("保存していない変更があります。月を切り替えますか？（変更はこの画面を開いている間は残ります）")) return;
    setMonth(next);
    setMessage(null);
  }

  // 選べる案件：進行中の案件（すでに設定に入っている案件は、完了していても選択肢に残す）
  const staffName = useMemo(() => new Map(staffList.map((s) => [s.id, s.name])), [staffList]);
  const projectNames = useMemo(() => {
    const names = new Set<string>();
    for (const [name, p] of masterByName) if (p.status === "進行中") names.add(name);
    for (const r of rows) {
      const name = projectById.get(r.projectId)?.name;
      if (name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "ja"));
  }, [masterByName, rows, projectById]);

  // その月の現在件数・獲得金額：メンバー × 案件名
  const acquired = useMemo(() => {
    const map = new Map<string, { qty: number; amount: number }>();
    for (const a of acquisitions) {
      if (acquisitionMonth(a) !== month) continue;
      const name = projectById.get(a.project_id)?.name;
      if (!name) continue;
      const key = `${a.staff_id}|${name}`;
      const cur = map.get(key) ?? { qty: 0, amount: 0 };
      cur.qty += a.quantity;
      cur.amount += Number(a.amount);
      map.set(key, cur);
    }
    return map;
  }, [acquisitions, month, projectById]);

  // 行ごとの計算
  const computed = rows.map((r) => {
    const project = projectById.get(r.projectId);
    const target = num(r.target);
    const rate = num(r.rate);
    const unit = project ? defaultUnitPrice(masterByName.get(project.name) ?? project) : 0;
    const got = project ? (acquired.get(`${r.staffId}|${project.name}`) ?? { qty: 0, amount: 0 }) : { qty: 0, amount: 0 };
    return {
      project,
      target,
      current: got.qty,
      remaining: target - got.qty,
      progress: target > 0 ? (got.qty / target) * 100 : null,
      unit,
      expected: Math.round(target * unit * (rate / 100)),
      billed: Math.round(got.amount * (rate / 100)),
    };
  });

  // メンバーのまとまり（最初に出てきた順）
  const staffOrder = Array.from(new Set(rows.map((r) => r.staffId)));
  const colorOf = (staffId: string) => STAFF_COLORS[staffOrder.indexOf(staffId) % STAFF_COLORS.length];

  const memberSummary = staffOrder.map((staffId) => {
    const idxs = rows.map((r, i) => (r.staffId === staffId && r.projectId ? i : -1)).filter((i) => i >= 0);
    return {
      staffId,
      count: idxs.length,
      target: idxs.reduce((s, i) => s + computed[i].target, 0),
      expected: idxs.reduce((s, i) => s + computed[i].expected, 0),
      billed: idxs.reduce((s, i) => s + computed[i].billed, 0),
    };
  });

  const projectSummary = (() => {
    const map = new Map<string, { name: string; target: number; current: number; expected: number }>();
    rows.forEach((r, i) => {
      const c = computed[i];
      if (!c.project) return;
      const cur = map.get(c.project.name) ?? { name: c.project.name, target: 0, current: 0, expected: 0 };
      cur.target += c.target;
      cur.current += c.current;
      cur.expected += c.expected;
      map.set(c.project.name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.expected - a.expected || a.name.localeCompare(b.name, "ja"));
  })();
  const grand = {
    target: memberSummary.reduce((s, m) => s + m.target, 0),
    expected: memberSummary.reduce((s, m) => s + m.expected, 0),
    billed: memberSummary.reduce((s, m) => s + m.billed, 0),
    count: memberSummary.reduce((s, m) => s + m.count, 0),
  };

  // 編集
  const update = (key: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // 案件を選ぶと、案件一覧のデフォルトの有効率が入る（このあと行ごとに変えられる）
  function selectProject(key: number, name: string) {
    const master = masterByName.get(name);
    update(key, master ? { projectId: master.id, rate: String(Number(master.effective_rate)) } : { projectId: "" });
  }

  const addRowFor = (staffId: string) => setRows((prev) => {
    // そのメンバーの最後の行の下に追加する
    const last = prev.map((r) => r.staffId).lastIndexOf(staffId);
    const next = [...prev];
    next.splice(last + 1, 0, newRow(staffId));
    return next;
  });

  const removeRow = (key: number) => setRows((prev) => prev.filter((r) => r.key !== key));

  const addStaffRef = useRef<HTMLSelectElement>(null);
  function addStaff(staffId: string) {
    if (!staffId) return;
    setRows((prev) => [...prev, newRow(staffId)]);
    if (addStaffRef.current) addStaffRef.current.value = "";
  }
  const availableStaff = staffList.filter((s) => !staffOrder.includes(s.id));

  function handleSave() {
    startTransition(async () => {
      const result = await saveProjectAssignments(
        month,
        rows.map((r) => ({
          staffId: r.staffId,
          // 過去に月ごとに作った同名の案件は、現在の案件にそろえて保存する
          projectId: masterByName.get(projectById.get(r.projectId)?.name ?? "")?.id ?? r.projectId,
          target: num(r.target),
          rate: num(r.rate),
          memo: r.memo,
        }))
      );
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setDirty(false);
      setMessage({ type: "ok", text: "保存しました" });
      router.refresh();
    });
  }

  const th = "whitespace-nowrap bg-teal-800 px-3 py-2 text-center text-xs font-semibold text-white";
  const inputCls =
    "w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-right text-sm focus:border-slate-500 focus:outline-none";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {monthTabs.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => changeMonth(m)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap ${
              month === m
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {monthText(m)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          案件一覧に登録した案件と、登録したメンバーを選んで、{monthText(month)}にやる件数を設定します。
          有効率は案件一覧の値が入り、行ごとに変えられます。現在件数は、ダッシュボードの案件獲得の登録から自動で入ります。
          見込請求金額＝件数×単価（案件一覧のデフォルトの単価）×有効率、請求金額＝獲得金額×有効率です。
        </p>
        {isAdmin && (
          <div className="flex items-center gap-3">
            {message && (
              <span className={`text-sm ${message.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
                {message.text}
              </span>
            )}
            {dirty && !message && <span className="text-xs text-amber-600">未保存の変更があります</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {pending ? "保存中..." : "保存する"}
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr>
              <th className={th}>担当者</th>
              <th className={`${th} min-w-52`}>案件名</th>
              <th className={th}>件数</th>
              <th className={th}>現在件数</th>
              <th className={th}>残件数</th>
              <th className={th}>進捗率</th>
              <th className={th}>単価</th>
              <th className={th}>有効率</th>
              <th className={th}>見込請求金額</th>
              <th className={th}>請求金額</th>
              <th className={`${th} min-w-40`}>メモ</th>
              {isAdmin && <th className={`${th} w-10`} />}
            </tr>
          </thead>
          <tbody>
            {staffOrder.map((staffId) => (
              <Fragment key={staffId}>
                {rows.map((r, i) => {
                  if (r.staffId !== staffId) return null;
                  const c = computed[i];
                  return (
                    <tr key={r.key} className="border-t border-slate-200">
                      <td className={`px-3 py-1.5 text-center font-medium text-slate-800 ${colorOf(staffId)}`}>
                        {staffName.get(staffId) ?? "不明"}
                      </td>
                      <td className="border-l border-slate-200 px-1.5 py-1">
                        {isAdmin ? (
                          <select
                            value={c.project?.name ?? ""}
                            onChange={(e) => selectProject(r.key, e.target.value)}
                            className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-sm focus:border-slate-500 focus:outline-none"
                          >
                            <option value="">（案件を選択）</option>
                            {projectNames.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="px-1.5">{c.project?.name ?? ""}</span>
                        )}
                      </td>
                      <td className="border-l border-slate-200 px-1.5 py-1 text-right">
                        {isAdmin ? (
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={r.target}
                            onChange={(e) => update(r.key, { target: e.target.value })}
                            className={`${inputCls} w-20`}
                          />
                        ) : (
                          `${c.target}件`
                        )}
                      </td>
                      <td className="border-l border-slate-200 px-3 py-1.5 text-right">{c.project ? `${c.current}件` : ""}</td>
                      <td
                        className={`border-l border-slate-200 px-3 py-1.5 text-right ${
                          c.project && c.target > 0 && c.remaining < 0 ? "text-red-600" : ""
                        }`}
                      >
                        {c.project ? (c.target > 0 ? `${c.remaining}件` : "-") : ""}
                      </td>
                      <td className="border-l border-slate-200 px-3 py-1.5 text-right">
                        {c.project ? (c.progress === null ? "-" : pct(c.progress)) : ""}
                      </td>
                      <td className="border-l border-slate-200 px-3 py-1.5 text-right">
                        {c.project ? formatCurrency(c.unit) : ""}
                      </td>
                      <td className="border-l border-slate-200 px-1.5 py-1 text-right">
                        {isAdmin ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={r.rate}
                              onChange={(e) => update(r.key, { rate: e.target.value })}
                              className={`${inputCls} w-16`}
                            />
                            <span className="text-xs text-slate-500">%</span>
                          </div>
                        ) : (
                          `${num(r.rate)}%`
                        )}
                      </td>
                      <td className="border-l border-slate-200 px-3 py-1.5 text-right">
                        {c.project ? formatCurrency(c.expected) : ""}
                      </td>
                      <td className="border-l border-slate-200 px-3 py-1.5 text-right">
                        {c.project ? formatCurrency(c.billed) : ""}
                      </td>
                      <td className="border-l border-slate-200 px-1.5 py-1">
                        {isAdmin ? (
                          <input
                            value={r.memo}
                            onChange={(e) => update(r.key, { memo: e.target.value })}
                            className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-sm focus:border-slate-500 focus:outline-none"
                          />
                        ) : (
                          <span className="px-1.5 text-slate-600">{r.memo}</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="border-l border-slate-200 px-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(r.key)}
                            className="text-slate-300 hover:text-red-500"
                            aria-label="この行を削除"
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {isAdmin && (
                  <tr className="border-t border-slate-200">
                    <td className={`${colorOf(staffId)}`} />
                    <td colSpan={11} className="px-3 py-1">
                      <button
                        type="button"
                        onClick={() => addRowFor(staffId)}
                        className="text-xs font-medium text-emerald-700 hover:underline"
                      >
                        ＋ {staffName.get(staffId)}の案件を追加
                      </button>
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={isAdmin ? 12 : 11} className="h-1 bg-slate-100" />
                </tr>
              </Fragment>
            ))}
            {staffOrder.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 12 : 11} className="px-3 py-8 text-center text-slate-400">
                  {monthText(month)}の案件設定はまだありません。
                  {isAdmin ? "下のボタンからメンバーを追加してください。" : ""}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2">
          <select
            ref={addStaffRef}
            defaultValue=""
            onChange={(e) => addStaff(e.target.value)}
            disabled={availableStaff.length === 0}
            className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 focus:outline-none"
          >
            <option value="">＋ メンバーを追加</option>
            {availableStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
          <div className="bg-teal-800 px-3 py-1.5 text-center text-sm font-semibold text-white">担当者別サマリー</div>
          <table className="w-full text-sm">
            <thead className="bg-sky-100 text-xs text-slate-700">
              <tr>
                <th className="px-3 py-1.5 text-left">担当者</th>
                <th className="px-3 py-1.5 text-right">案件数</th>
                <th className="px-3 py-1.5 text-right">合計件数</th>
                <th className="px-3 py-1.5 text-right">見込請求額</th>
                <th className="px-3 py-1.5 text-right">請求額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {memberSummary.map((m) => (
                <tr key={m.staffId}>
                  <td className="px-3 py-1.5">{staffName.get(m.staffId) ?? "不明"}</td>
                  <td className="px-3 py-1.5 text-right">{m.count}</td>
                  <td className="px-3 py-1.5 text-right">{m.target}件</td>
                  <td className="px-3 py-1.5 text-right">{formatCurrency(m.expected)}</td>
                  <td className="px-3 py-1.5 text-right">{formatCurrency(m.billed)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-sky-200 font-bold text-slate-900">
              <tr>
                <td className="px-3 py-1.5">合計</td>
                <td className="px-3 py-1.5 text-right">{grand.count}</td>
                <td className="px-3 py-1.5 text-right">{grand.target}件</td>
                <td className="px-3 py-1.5 text-right">{formatCurrency(grand.expected)}</td>
                <td className="px-3 py-1.5 text-right">{formatCurrency(grand.billed)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
          <div className="bg-slate-900 px-3 py-1.5 text-center text-sm font-semibold text-white">案件別サマリー</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-xs text-white">
              <tr>
                <th className="px-3 py-1.5 text-center">No</th>
                <th className="px-3 py-1.5 text-left">案件名</th>
                <th className="px-3 py-1.5 text-right">目標件数</th>
                <th className="px-3 py-1.5 text-right">現在件数</th>
                <th className="px-3 py-1.5 text-right">残件数</th>
                <th className="px-3 py-1.5 text-right">見込み請求</th>
                <th className="px-3 py-1.5 text-right">割合</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projectSummary.map((p, i) => (
                <tr key={p.name}>
                  <td className="px-3 py-1.5 text-center text-slate-500">{i + 1}</td>
                  <td className="px-3 py-1.5">{p.name}</td>
                  <td className="px-3 py-1.5 text-right">{p.target}件</td>
                  <td className="px-3 py-1.5 text-right">{p.current}件</td>
                  <td className="px-3 py-1.5 text-right">{p.target - p.current}件</td>
                  <td className="px-3 py-1.5 text-right">{formatCurrency(p.expected)}</td>
                  <td className="px-3 py-1.5 text-right">
                    {grand.expected > 0 ? pct((p.expected / grand.expected) * 100) : "-"}
                  </td>
                </tr>
              ))}
              {projectSummary.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-slate-400">
                    案件が設定されていません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
