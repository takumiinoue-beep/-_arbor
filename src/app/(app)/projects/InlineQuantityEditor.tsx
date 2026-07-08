"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";

export function InlineQuantityEditor({
  projectId,
  quantity,
  unitPrice,
  onSave,
}: {
  projectId: string;
  quantity: number;
  unitPrice?: number;
  onSave: (projectId: string, newQuantity: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(quantity));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const previewQuantity = Number(value);
  const previewValid = value.trim() !== "" && Number.isInteger(previewQuantity) && previewQuantity >= 0;

  const commit = () => {
    if (!previewValid) {
      setError("0以上の整数を入力してください");
      setValue(String(quantity));
      return;
    }
    if (previewQuantity === quantity) return;

    setError(null);
    startTransition(async () => {
      try {
        await onSave(projectId, previewQuantity);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "更新に失敗しました");
        setValue(String(quantity));
      }
    });
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          step={1}
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-sm disabled:opacity-50"
        />
        <span className="text-xs text-slate-400">
          件
          {unitPrice !== undefined &&
            ` → ${formatCurrency(unitPrice * (previewValid ? previewQuantity : quantity))}`}
        </span>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
