"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/common/Modal";
import type { ProjectWithStaff } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import { createAcquisition } from "./actions";

function toToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function findMatchingRate(project: ProjectWithStaff | undefined, position: string, employeeCount: number | null) {
  if (!project?.price_rates || !position || employeeCount === null || Number.isNaN(employeeCount)) {
    return undefined;
  }
  return project.price_rates.find((r) => {
    if (r.position !== position) return false;
    return employeeCount >= r.employee_min && (r.employee_max === null || employeeCount <= r.employee_max);
  });
}

export function AcquisitionButton({ projects }: { projects: ProjectWithStaff[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAcquisition, null);
  const wasPending = useRef(false);
  const router = useRouter();

  const [acquiredDate, setAcquiredDate] = useState(toToday());
  const [projectId, setProjectId] = useState("");
  const [position, setPosition] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setOpen(false);
      setAcquiredDate(toToday());
      setProjectId("");
      setPosition("");
      setEmployeeCount("");
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state, router]);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name, "ja")),
    [projects]
  );
  const selectedProject = projects.find((p) => p.id === projectId);
  const hasRates = (selectedProject?.price_rates?.length ?? 0) > 0;
  const positionOptions = useMemo(
    () => Array.from(new Set(selectedProject?.price_rates?.map((r) => r.position) ?? [])),
    [selectedProject]
  );

  const matchedRate = hasRates
    ? findMatchingRate(selectedProject, position, employeeCount === "" ? null : Number(employeeCount))
    : undefined;
  const unitPrice = hasRates ? (matchedRate?.unit_price ?? null) : (selectedProject?.unit_price ?? null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        + 案件獲得を登録
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="案件獲得の登録">
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="unit_price" value={unitPrice ?? ""} />

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
              案件（商材） <span className="text-red-500">*</span>
            </label>
            <select
              name="project_id"
              required
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setPosition("");
                setEmployeeCount("");
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="" disabled>
                選択してください
              </option>
              {sortedProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {hasRates && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">役職</label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {positionOptions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">従業員数</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            単価：
            <span className="ml-1 font-semibold text-slate-900">
              {unitPrice !== null ? formatCurrency(unitPrice) : "未確定"}
            </span>
            {hasRates && unitPrice === null && projectId && (
              <p className="mt-1 text-xs text-red-600">
                この案件の料金表に該当する役職・従業員数の設定がありません。
              </p>
            )}
          </div>

          {state?.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending || !projectId || unitPrice === null}
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
