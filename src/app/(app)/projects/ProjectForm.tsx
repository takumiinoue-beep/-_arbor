"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Profile, Project } from "@/types/database";

type Action = (
  prevState: { error: string } | null,
  formData: FormData
) => Promise<{ error: string } | null>;

export function ProjectForm({
  action,
  staffList,
  project,
  submitLabel,
}: {
  action: Action;
  staffList: Profile[];
  project?: Project;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-slate-700">
          案件名 <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={project?.name}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="staff_id" className="text-sm font-medium text-slate-700">
          担当者 <span className="text-red-500">*</span>
        </label>
        <select
          id="staff_id"
          name="staff_id"
          required
          defaultValue={project?.staff_id ?? ""}
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

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="start_date" className="text-sm font-medium text-slate-700">
            開始日 <span className="text-red-500">*</span>
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            defaultValue={project?.start_date}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="end_date" className="text-sm font-medium text-slate-700">
            終了日
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            defaultValue={project?.end_date ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="budget" className="text-sm font-medium text-slate-700">
            予算（目標売上・円） <span className="text-red-500">*</span>
          </label>
          <input
            id="budget"
            name="budget"
            type="number"
            min={0}
            required
            defaultValue={project?.budget ?? 0}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="actual" className="text-sm font-medium text-slate-700">
            実績（円）
          </label>
          <input
            id="actual"
            name="actual"
            type="number"
            min={0}
            defaultValue={project?.actual ?? 0}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="status" className="text-sm font-medium text-slate-700">
          ステータス
        </label>
        <select
          id="status"
          name="status"
          defaultValue={project?.status ?? "進行中"}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="進行中">進行中</option>
          <option value="完了">完了</option>
          <option value="中止">中止</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-slate-700">
          備考
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={project?.notes ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "保存中..." : submitLabel}
        </button>
        <Link
          href="/projects"
          className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
