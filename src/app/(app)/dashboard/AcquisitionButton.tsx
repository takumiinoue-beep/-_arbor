"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/common/Modal";
import type { PriceRate, Profile, Project } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import { formatYearMonth } from "@/lib/period";
import { createAcquisition } from "./actions";

function toToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export type AcquisitionProject = Pick<Project, "id" | "name" | "start_date" | "end_date" | "unit_price"> & {
  price_rates?: Pick<PriceRate, "id" | "position" | "employee_min" | "employee_max" | "unit_price">[];
};

type Row = {
  projectName: string;
  versionId: string; // 同じ案件名が複数ある場合に、期間を手動で選んだときのID（空なら計上月から自動で選ぶ）
  position: string;
  employeeCount: string;
  quantity: string;
};

const emptyRow: Row = { projectName: "", versionId: "", position: "", employeeCount: "", quantity: "1" };

function findMatchingRate(project: AcquisitionProject | undefined, position: string, employeeCount: number | null) {
  if (!project?.price_rates || !position || employeeCount === null || Number.isNaN(employeeCount)) {
    return undefined;
  }
  return project.price_rates.find((r) => {
    if (r.position !== position) return false;
    return employeeCount >= r.employee_min && (r.employee_max === null || employeeCount <= r.employee_max);
  });
}

const ym = (date: string) => date.slice(0, 7);

// 同じ案件名の中から、計上月に当てはまる期間の案件を選ぶ
// （期間内のもの → 無ければ計上月以前で最も新しいもの → 無ければ一番早いもの）
function pickVersion(versions: AcquisitionProject[], targetMonth: string): AcquisitionProject | undefined {
  const byStartDesc = [...versions].sort((a, b) => b.start_date.localeCompare(a.start_date));
  return (
    byStartDesc.find((p) => ym(p.start_date) <= targetMonth && (!p.end_date || ym(p.end_date) >= targetMonth)) ??
    byStartDesc.find((p) => ym(p.start_date) <= targetMonth) ??
    byStartDesc[byStartDesc.length - 1]
  );
}

function versionLabel(p: AcquisitionProject): string {
  const start = formatYearMonth(ym(p.start_date));
  return p.end_date && ym(p.end_date) !== ym(p.start_date) ? `${start}〜${formatYearMonth(ym(p.end_date))}` : start;
}

export function AcquisitionButton({
  projects,
  staffList,
  currentUserId,
}: {
  projects: AcquisitionProject[];
  staffList: Pick<Profile, "id" | "name">[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAcquisition, null);
  const wasPending = useRef(false);
  const router = useRouter();

  const [acquiredDate, setAcquiredDate] = useState(toToday());
  // 計上月：来月のアポなどは来月を選ぶと、来月のページに載る。触らなければ獲得日の月になる。
  const [targetMonthInput, setTargetMonthInput] = useState<string | null>(null);
  const targetMonth = targetMonthInput ?? acquiredDate.slice(0, 7);
  const [staffId, setStaffId] = useState(currentUserId);
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setOpen(false);
      setAcquiredDate(toToday());
      setTargetMonthInput(null);
      setStaffId(currentUserId);
      setRows([{ ...emptyRow }]);
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state, router, currentUserId]);

  // 案件は月ごとに作られていて同じ名前が複数あるため、まず案件名だけを選び、期間は計上月から自動で決める
  const versionsByName = useMemo(() => {
    const map = new Map<string, AcquisitionProject[]>();
    for (const p of projects) map.set(p.name, [...(map.get(p.name) ?? []), p]);
    return map;
  }, [projects]);
  const projectNames = useMemo(
    () => Array.from(versionsByName.keys()).sort((a, b) => a.localeCompare(b, "ja")),
    [versionsByName]
  );

  function updateRow(idx: number, field: keyof Row, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "projectName") next[idx].versionId = "";
      if (field === "projectName" || field === "versionId") {
        next[idx].position = "";
        next[idx].employeeCount = "";
      }
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, { ...emptyRow }]);
  }

  function removeRow(idx: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  function resolveRow(row: Row) {
    const versions = versionsByName.get(row.projectName) ?? [];
    const project =
      versions.find((p) => p.id === row.versionId) ?? (versions.length ? pickVersion(versions, targetMonth) : undefined);
    const hasRates = (project?.price_rates?.length ?? 0) > 0;
    const positionOptions = Array.from(new Set(project?.price_rates?.map((r) => r.position) ?? []));
    const employeeCountNum = row.employeeCount === "" ? null : Number(row.employeeCount);
    const matchedRate = hasRates ? findMatchingRate(project, row.position, employeeCountNum) : undefined;
    const unitPrice = hasRates ? (matchedRate?.unit_price ?? null) : (project?.unit_price ?? null);
    const quantityNum = Number(row.quantity) || 0;
    const quantityValid = Number.isInteger(quantityNum) && quantityNum >= 1;
    return { project, versions, hasRates, positionOptions, matchedRate, unitPrice, quantityNum, quantityValid };
  }

  const resolvedRows = rows.map(resolveRow);
  const allValid =
    !!staffId &&
    rows.every((r) => r.projectName) &&
    resolvedRows.every((r) => r.unitPrice !== null && r.quantityValid);
  const totalAmount = resolvedRows.reduce(
    (sum, r) => sum + (r.unitPrice !== null && r.quantityValid ? r.unitPrice * r.quantityNum : 0),
    0
  );

  const rowsPayload = rows.map((row, idx) => {
    const resolved = resolvedRows[idx];
    return {
      project_id: resolved.project?.id ?? "",
      rate_id: resolved.matchedRate?.id ?? "",
      position: resolved.hasRates ? row.position : "",
      employee_count: resolved.hasRates ? row.employeeCount : "",
      unit_price: resolved.unitPrice ?? "",
      quantity: row.quantity,
    };
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        + 案件獲得を登録
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="案件獲得の登録" size="lg">
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="rows" value={JSON.stringify(rowsPayload)} />

          <input type="hidden" name="target_month" value={targetMonth} />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                日付 <span className="text-red-500">*</span>
              </label>
              <input
                name="acquired_date"
                type="date"
                required
                value={acquiredDate}
                onChange={(e) => setAcquiredDate(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                計上月 <span className="text-xs font-normal text-slate-400">（来月のアポは来月を選択）</span>
              </label>
              <input
                type="month"
                required
                value={targetMonth}
                onChange={(e) => setTargetMonthInput(e.target.value || null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                OP <span className="text-red-500">*</span>
              </label>
              <select
                name="staff_id"
                required
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              >
                <option value="" disabled>
                  選択してください
                </option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-slate-700">
              案件（商材） <span className="text-red-500">*</span>
            </label>
            {rows.map((row, idx) => {
              const resolved = resolvedRows[idx];
              return (
                <div key={idx} className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <select
                      required
                      value={row.projectName}
                      onChange={(e) => updateRow(idx, "projectName", e.target.value)}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    >
                      <option value="" disabled>
                        案件名を選択
                      </option>
                      {projectNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-col gap-1">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        required
                        value={row.quantity}
                        onChange={(e) => updateRow(idx, "quantity", e.target.value)}
                        className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="px-2 py-2 text-slate-300 transition-colors hover:text-red-500"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {resolved.project && resolved.versions.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                        {versionLabel(resolved.project)}
                      </span>
                      {resolved.versions.length > 1 && (
                        <select
                          value={resolved.project.id}
                          onChange={(e) => updateRow(idx, "versionId", e.target.value)}
                          className="rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 focus:border-slate-500 focus:outline-none"
                          aria-label="案件の期間"
                        >
                          {[...resolved.versions]
                            .sort((a, b) => b.start_date.localeCompare(a.start_date))
                            .map((v) => (
                              <option key={v.id} value={v.id}>
                                {versionLabel(v)}
                              </option>
                            ))}
                        </select>
                      )}
                      <span className="text-slate-400">
                        {resolved.versions.length > 1 ? "計上月に合う期間を自動で選択しています" : ""}
                      </span>
                    </div>
                  )}

                  {resolved.hasRates && (
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={row.position}
                        onChange={(e) => updateRow(idx, "position", e.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                      >
                        <option value="" disabled>
                          役職を選択
                        </option>
                        {resolved.positionOptions.map((pos) => (
                          <option key={pos} value={pos}>
                            {pos}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="従業員数"
                        value={row.employeeCount}
                        onChange={(e) => updateRow(idx, "employeeCount", e.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                  )}

                  <p className="text-xs text-slate-400">
                    単価：
                    <span className="font-semibold text-slate-700">
                      {resolved.unitPrice !== null ? formatCurrency(resolved.unitPrice) : "未確定"}
                    </span>
                    {resolved.hasRates && resolved.unitPrice === null && row.projectName && (
                      <span className="ml-2 text-red-600">役職・従業員数に該当する料金表がありません。</span>
                    )}
                  </p>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addRow}
              className="self-start text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              ＋ 案件を追加
            </button>
          </div>

          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            合計金額：
            <span className="ml-1 font-semibold text-slate-900">{formatCurrency(totalAmount)}</span>
            <span className="ml-1 text-xs text-slate-400">
              ※ 登録すると各案件の実績件数にもそれぞれの件数が加算されます。
            </span>
          </div>

          {state?.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending || !allValid}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {pending ? "登録中..." : "登録する"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              キャンセル
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
