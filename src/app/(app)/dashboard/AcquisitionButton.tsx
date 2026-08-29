"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/common/Modal";
import type { Profile, ProjectWithStaff } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import { formatYearMonth } from "@/lib/period";
import { createAcquisition } from "./actions";

function toToday(): string {
  return new Date().toISOString().slice(0, 10);
}

type Row = {
  projectId: string;
  position: string;
  employeeCount: string;
  quantity: string;
};

const emptyRow: Row = { projectId: "", position: "", employeeCount: "", quantity: "1" };

function findMatchingRate(project: ProjectWithStaff | undefined, position: string, employeeCount: number | null) {
  if (!project?.price_rates || !position || employeeCount === null || Number.isNaN(employeeCount)) {
    return undefined;
  }
  return project.price_rates.find((r) => {
    if (r.position !== position) return false;
    return employeeCount >= r.employee_min && (r.employee_max === null || employeeCount <= r.employee_max);
  });
}

export function AcquisitionButton({
  projects,
  staffList,
  currentUserId,
}: {
  projects: ProjectWithStaff[];
  staffList: Profile[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAcquisition, null);
  const wasPending = useRef(false);
  const router = useRouter();

  const [acquiredDate, setAcquiredDate] = useState(toToday());
  const [staffId, setStaffId] = useState(currentUserId);
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setOpen(false);
      setAcquiredDate(toToday());
      setStaffId(currentUserId);
      setRows([{ ...emptyRow }]);
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state, router, currentUserId]);

  // 同じ案件名が期間ごとに複数存在するため、名前が同じ場合は開始日が新しい順に並べる
  const sortedProjects = useMemo(
    () =>
      [...projects].sort(
        (a, b) => a.name.localeCompare(b.name, "ja") || b.start_date.localeCompare(a.start_date)
      ),
    [projects]
  );

  function updateRow(idx: number, field: keyof Row, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "projectId") {
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
    const project = projects.find((p) => p.id === row.projectId);
    const hasRates = (project?.price_rates?.length ?? 0) > 0;
    const positionOptions = Array.from(new Set(project?.price_rates?.map((r) => r.position) ?? []));
    const employeeCountNum = row.employeeCount === "" ? null : Number(row.employeeCount);
    const matchedRate = hasRates ? findMatchingRate(project, row.position, employeeCountNum) : undefined;
    const unitPrice = hasRates ? (matchedRate?.unit_price ?? null) : (project?.unit_price ?? null);
    const quantityNum = Number(row.quantity) || 0;
    const quantityValid = Number.isInteger(quantityNum) && quantityNum >= 1;
    return { project, hasRates, positionOptions, matchedRate, unitPrice, quantityNum, quantityValid };
  }

  const resolvedRows = rows.map(resolveRow);
  const allValid =
    !!staffId &&
    rows.every((r) => r.projectId) &&
    resolvedRows.every((r) => r.unitPrice !== null && r.quantityValid);
  const totalAmount = resolvedRows.reduce(
    (sum, r) => sum + (r.unitPrice !== null && r.quantityValid ? r.unitPrice * r.quantityNum : 0),
    0
  );

  const rowsPayload = rows.map((row, idx) => {
    const resolved = resolvedRows[idx];
    return {
      project_id: row.projectId,
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
                      value={row.projectId}
                      onChange={(e) => updateRow(idx, "projectId", e.target.value)}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    >
                      <option value="" disabled>
                        選択してください
                      </option>
                      {sortedProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}（{formatYearMonth(p.start_date.slice(0, 7))}）
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
                    {resolved.hasRates && resolved.unitPrice === null && row.projectId && (
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
