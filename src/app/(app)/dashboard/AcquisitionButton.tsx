"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/common/Modal";
import type { PriceRate, Profile, Project } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import { formatYearMonth } from "@/lib/period";
import { defaultUnitPrice, latestByName } from "@/lib/projects";
import { createAcquisition } from "./actions";

function toToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export type AcquisitionProject = Pick<Project, "id" | "name" | "start_date" | "status" | "unit_price" | "effective_rate"> & {
  price_rates?: Pick<PriceRate, "id" | "position" | "employee_min" | "employee_max" | "unit_price">[];
};

type Row = {
  projectName: string;
  targetMonth: string; // 計上月（空なら日付の月）。来月のアポなどは行ごとに来月を選ぶ
  position: string;
  employeeCount: string;
  quantity: string;
};

// OPごとのまとまり。複数のOPの獲得をまとめて1回で登録できる
type Block = { id: number; staffId: string; rows: Row[] };

let blockSeq = 0;
const makeBlock = (staffId: string): Block => ({ id: ++blockSeq, staffId, rows: [{ ...emptyRow }] });

const emptyRow: Row = { projectName: "", targetMonth: "", position: "", employeeCount: "", quantity: "1" };

function findMatchingRate(project: AcquisitionProject | undefined, position: string, employeeCount: number | null) {
  if (!project?.price_rates || !position || employeeCount === null || Number.isNaN(employeeCount)) {
    return undefined;
  }
  return project.price_rates.find((r) => {
    if (r.position !== position) return false;
    return employeeCount >= r.employee_min && (r.employee_max === null || employeeCount <= r.employee_max);
  });
}

// 案件設定との連携の表示：そのOP・月・案件に設定した件数と、登録後の現在件数
function ProgressHint({
  info,
  quantity,
  month,
}: {
  info: { target: number; current: number } | undefined;
  quantity: number;
  month: string;
}) {
  if (!info) {
    return (
      <p className="text-xs text-amber-600">
        {formatYearMonth(month)}の案件設定にこのOPの設定はありません（登録すると案件設定に「件数0」で表示されます）。
      </p>
    );
  }
  const after = info.current + quantity;
  return (
    <p className="text-xs text-emerald-700">
      案件設定：{info.target}件中 {info.current}件 → 登録後 {after}件（残り{info.target - after}件）
    </p>
  );
}

export function AcquisitionButton({
  projects,
  staffList,
  currentUserId,
  progress,
}: {
  projects: AcquisitionProject[];
  staffList: Pick<Profile, "id" | "name">[];
  currentUserId: string;
  // 案件設定の件数と現在件数。キーは「月|OPのID|案件名」
  progress: Map<string, { target: number; current: number }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAcquisition, null);
  const wasPending = useRef(false);
  const router = useRouter();

  const [acquiredDate, setAcquiredDate] = useState(toToday());
  const [blocks, setBlocks] = useState<Block[]>(() => [makeBlock(currentUserId)]);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setOpen(false);
      setAcquiredDate(toToday());
      setBlocks([makeBlock(currentUserId)]);
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state, router, currentUserId]);

  // 案件名ごとに1つの案件（過去に月ごとに作った同名の案件は、一番新しいものを使う）。選べるのは進行中の案件だけ
  const projectByName = useMemo(() => latestByName(projects), [projects]);
  const projectNames = useMemo(
    () =>
      Array.from(projectByName.values())
        .filter((p) => p.status === "進行中")
        .map((p) => p.name)
        .sort((a, b) => a.localeCompare(b, "ja")),
    [projectByName]
  );

  function updateBlock(blockId: number, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...patch } : b)));
  }

  function updateRow(blockId: number, idx: number, field: keyof Row, value: string) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const rows = [...b.rows];
        rows[idx] = { ...rows[idx], [field]: value };
        if (field === "projectName") {
          rows[idx].position = "";
          rows[idx].employeeCount = "";
        }
        return { ...b, rows };
      })
    );
  }

  function addRow(blockId: number) {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, rows: [...b.rows, { ...emptyRow }] } : b)));
  }

  function removeRow(blockId: number, idx: number) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId && b.rows.length > 1 ? { ...b, rows: b.rows.filter((_, i) => i !== idx) } : b
      )
    );
  }

  function addBlock() {
    setBlocks((prev) => [...prev, makeBlock("")]);
  }

  function removeBlock(blockId: number) {
    setBlocks((prev) => (prev.length > 1 ? prev.filter((b) => b.id !== blockId) : prev));
  }

  const dateMonth = acquiredDate.slice(0, 7);

  function resolveRow(row: Row) {
    const month = row.targetMonth || dateMonth;
    const project = projectByName.get(row.projectName);
    const hasRates = (project?.price_rates?.length ?? 0) > 0;
    const positionOptions = Array.from(new Set(project?.price_rates?.map((r) => r.position) ?? []));
    const employeeCountNum = row.employeeCount === "" ? null : Number(row.employeeCount);
    const matchedRate = hasRates ? findMatchingRate(project, row.position, employeeCountNum) : undefined;
    // 料金表に当てはまる行があればその単価、無ければデフォルトの単価
    const fallbackPrice = project ? defaultUnitPrice(project) : 0;
    const unitPrice = matchedRate ? Number(matchedRate.unit_price) : fallbackPrice > 0 ? fallbackPrice : null;
    const quantityNum = Number(row.quantity) || 0;
    const quantityValid = Number.isInteger(quantityNum) && quantityNum >= 1;
    return { month, project, hasRates, positionOptions, matchedRate, unitPrice, quantityNum, quantityValid };
  }

  const resolvedBlocks = blocks.map((b) => ({ block: b, rows: b.rows.map(resolveRow) }));
  const allValid = resolvedBlocks.every(
    ({ block, rows }) =>
      !!block.staffId &&
      block.rows.every((r) => r.projectName) &&
      rows.every((r) => r.unitPrice !== null && r.quantityValid && /^\d{4}-\d{2}$/.test(r.month))
  );
  const totalAmount = resolvedBlocks.reduce(
    (sum, { rows }) =>
      sum + rows.reduce((s, r) => s + (r.unitPrice !== null && r.quantityValid ? r.unitPrice * r.quantityNum : 0), 0),
    0
  );

  const rowsPayload = resolvedBlocks.flatMap(({ block, rows }) =>
    block.rows.map((row, idx) => {
      const resolved = rows[idx];
      return {
        staff_id: block.staffId,
        target_month: resolved.month,
        project_id: resolved.project?.id ?? "",
        rate_id: resolved.matchedRate?.id ?? "",
        position: resolved.hasRates ? row.position : "",
        employee_count: resolved.hasRates ? row.employeeCount : "",
        unit_price: resolved.unitPrice ?? "",
        quantity: row.quantity,
      };
    })
  );

  const inputClass =
    "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

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
              className={inputClass}
            />
          </div>

          {resolvedBlocks.map(({ block, rows: resolvedRows }) => (
            <div key={block.id} className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-slate-50/60 p-3">
              <div className="flex items-center gap-2">
                <label className="shrink-0 text-sm font-medium text-slate-700">
                  OP <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={block.staffId}
                  onChange={(e) => updateBlock(block.id, { staffId: e.target.value })}
                  className={`${inputClass} flex-1`}
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
                {blocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBlock(block.id)}
                    className="shrink-0 text-xs text-red-500 hover:underline"
                  >
                    このOPを削除
                  </button>
                )}
              </div>

              {block.rows.map((row, idx) => {
                const resolved = resolvedRows[idx];
                return (
                  <div key={idx} className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex items-start gap-2">
                      <select
                        required
                        value={row.projectName}
                        onChange={(e) => updateRow(block.id, idx, "projectName", e.target.value)}
                        className={`${inputClass} min-w-0 flex-1`}
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
                      <input
                        type="number"
                        min={1}
                        step={1}
                        required
                        aria-label="件数"
                        value={row.quantity}
                        onChange={(e) => updateRow(block.id, idx, "quantity", e.target.value)}
                        className={`${inputClass} w-20`}
                      />
                      {block.rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(block.id, idx)}
                          className="px-2 py-2 text-slate-300 transition-colors hover:text-red-500"
                          aria-label="この案件を削除"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <label className="font-medium text-slate-600">計上月</label>
                      <input
                        type="month"
                        required
                        value={resolved.month}
                        onChange={(e) => updateRow(block.id, idx, "targetMonth", e.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
                      />
                    </div>

                    {resolved.hasRates && (
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={row.position}
                          onChange={(e) => updateRow(block.id, idx, "position", e.target.value)}
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
                          onChange={(e) => updateRow(block.id, idx, "employeeCount", e.target.value)}
                          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                        />
                      </div>
                    )}

                    <p className="text-xs text-slate-400">
                      単価：
                      <span className="font-semibold text-slate-700">
                        {resolved.unitPrice !== null ? formatCurrency(resolved.unitPrice) : "未確定"}
                      </span>
                      {resolved.unitPrice !== null && resolved.hasRates && (
                        <span className="ml-1">
                          {resolved.matchedRate ? "（料金表）" : "（デフォルト単価。役職・従業員数が料金表に当てはまりません）"}
                        </span>
                      )}
                      {resolved.unitPrice === null && row.projectName && (
                        <span className="ml-2 text-red-600">単価が決まりません。案件一覧でデフォルトの単価を設定してください。</span>
                      )}
                    </p>
                    {resolved.project && block.staffId && (
                      <ProgressHint
                        info={progress.get(`${resolved.month}|${block.staffId}|${resolved.project.name}`)}
                        quantity={resolved.quantityValid ? resolved.quantityNum : 0}
                        month={resolved.month}
                      />
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => addRow(block.id)}
                className="self-start text-sm font-medium text-emerald-700 hover:text-emerald-800"
              >
                ＋ 案件を追加
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addBlock}
            className="self-start rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            ＋ 別のOPを追加（まとめて登録）
          </button>

          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            合計金額：
            <span className="ml-1 font-semibold text-slate-900">{formatCurrency(totalAmount)}</span>
            <span className="ml-1 text-xs text-slate-400">
              ※ 登録した件数は、案件設定の現在件数に反映されます。
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
