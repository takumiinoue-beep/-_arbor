"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { updateActual } from "./actions";

export function ActualEditor({
  projectId,
  actual,
  actualQuantity,
  unitPrice,
}: {
  projectId: string;
  actual: number;
  actualQuantity: number;
  unitPrice: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(actualQuantity));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(String(actualQuantity));
          setEditing(true);
        }}
        className="rounded px-1 py-0.5 text-left hover:bg-slate-100"
        title="クリックして実績件数を更新"
      >
        {formatCurrency(actual)}
        <span className="ml-1 text-xs text-slate-400">({actualQuantity}件)</span>
      </button>
    );
  }

  const previewQuantity = Number(value);
  const previewValid = Number.isInteger(previewQuantity) && previewQuantity >= 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          step={1}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 rounded border border-slate-300 px-1.5 py-0.5 text-sm"
        />
        <span className="text-xs text-slate-400">件</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!previewValid) {
              setError("0以上の整数を入力してください");
              return;
            }
            setError(null);
            startTransition(async () => {
              try {
                await updateActual(projectId, previewQuantity);
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
      {previewValid && (
        <p className="text-xs text-slate-400">→ {formatCurrency(unitPrice * previewQuantity)}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
