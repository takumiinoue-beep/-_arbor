"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProjectStatus } from "@/types/database";
import { updateStatus } from "./actions";

const STATUS_STYLE: Record<ProjectStatus, string> = {
  完了: "bg-emerald-100 text-emerald-700",
  中止: "bg-slate-200 text-slate-600",
  進行中: "bg-blue-100 text-blue-700",
};

export function StatusEditor({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-0.5">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const newStatus = e.target.value as ProjectStatus;
          const prev = value;
          setValue(newStatus);
          setError(null);
          startTransition(async () => {
            try {
              await updateStatus(projectId, newStatus);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "更新に失敗しました");
              setValue(prev);
            }
          });
        }}
        className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${STATUS_STYLE[value]}`}
      >
        <option value="進行中">進行中</option>
        <option value="完了">完了</option>
        <option value="中止">中止</option>
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
