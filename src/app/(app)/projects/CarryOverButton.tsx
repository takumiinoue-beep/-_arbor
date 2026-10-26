"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/common/Modal";
import { formatYearMonth } from "@/lib/period";
import { carryOverProjects, listCarryOverCandidates, type CarryOverCandidate } from "./actions";

// 来月（指定した月）の案件を、前の月の案件から引き継いで作る。
// 来月商談を獲得している案件は最初から選択済み。商談の無い案件は、必要なものだけ選んで引き継ぐ。
export function CarryOverButton({ defaultMonth }: { defaultMonth: string }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(defaultMonth);
  const [candidates, setCandidates] = useState<CarryOverCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function load(targetMonth: string) {
    setMessage(null);
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      setCandidates(null);
      return;
    }
    setLoading(true);
    const result = await listCarryOverCandidates(targetMonth);
    setLoading(false);
    if ("error" in result) {
      setCandidates(null);
      setMessage(result.error);
      return;
    }
    setCandidates(result.candidates);
    // 来月商談を獲得している案件は最初から選択しておく
    setSelected(new Set(result.candidates.filter((c) => c.appointmentQty > 0).map((c) => c.id)));
  }

  function openDialog() {
    setOpen(true);
    void load(month);
  }

  function changeMonth(value: string) {
    setMonth(value);
    void load(value);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const result = await carryOverProjects(month, Array.from(selected));
      if ("error" in result) {
        setMessage(result.error);
        void load(month);
        router.refresh();
        return;
      }
      setOpen(false);
      alert(`${result.created}件の案件を${formatYearMonth(month)}の案件として作成しました。`);
      router.refresh();
    });
  }

  const withAppointment = candidates?.filter((c) => c.appointmentQty > 0) ?? [];

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        来月の案件へ引き継ぐ
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="案件の引き継ぎ" size="lg">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">引き継ぎ先の月</label>
            <input
              type="month"
              value={month}
              onChange={(e) => changeMonth(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          <p className="text-xs text-slate-500">
            進行中の案件を、{formatYearMonth(month)}の案件として作成します（料金表はそのまま、実績件数・確定件数は0から）。
            {formatYearMonth(month)}に計上する獲得（来月商談など）は、新しい案件に付け替わります。
            商談を獲得している案件は最初から選択済みです。商談の無い案件は、引き継ぐものだけ選んでください。
          </p>

          {loading && <p className="py-4 text-center text-sm text-slate-400">読み込み中...</p>}

          {!loading && candidates && candidates.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">
              引き継げる案件がありません（すべて作成済みか、進行中の案件がありません）。
            </p>
          )}

          {!loading && candidates && candidates.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setSelected(new Set(withAppointment.map((c) => c.id)))}
                  className="text-emerald-700 hover:underline"
                >
                  商談ありだけ選ぶ
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set(candidates.map((c) => c.id)))}
                  className="text-slate-600 hover:underline"
                >
                  すべて選ぶ
                </button>
                <button type="button" onClick={() => setSelected(new Set())} className="text-slate-600 hover:underline">
                  選択を解除
                </button>
                <span className="ml-auto text-slate-400">
                  {selected.size} / {candidates.length}件を選択中
                </span>
              </div>

              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
                {candidates.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                        className="h-4 w-4"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{c.name}</span>
                        <span className="block text-xs text-slate-400">
                          {c.staffName ?? "担当者なし"}・{formatYearMonth(c.startMonth)}の案件から
                        </span>
                      </span>
                      {c.appointmentQty > 0 ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          商談 {c.appointmentQty}件
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          商談なし
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}

          {message && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{message}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || selected.size === 0}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {pending ? "作成中..." : `選択した${selected.size}件を引き継ぐ`}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              閉じる
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
