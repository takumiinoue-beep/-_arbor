"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { updateActual } from "./actions";

export function ActualEditor({ projectId, actual }: { projectId: string; actual: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(actual));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(String(actual));
          setEditing(true);
        }}
        className="rounded px-1 py-0.5 text-left hover:bg-slate-100"
        title="クリックして実績を更新"
      >
        {formatCurrency(actual)}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="number"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 rounded border border-slate-300 px-1.5 py-0.5 text-sm"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const newActual = Number(value);
            if (Number.isNaN(newActual) || newActual < 0) {
              setError("正しい金額を入力してください");
              return;
            }
            setError(null);
            startTransition(async () => {
              try {
                await updateActual(projectId, newActual);
                setEditing(false);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "更新に失敗しました");
              }
            });
          }}
          className="rounded bg-slate-900 px-2 py-0.5 text-xs text-white hover:bg-slate-700 disabled:opacity-50"
        >
          保存
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
        >
          取消
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
