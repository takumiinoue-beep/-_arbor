"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFixedCost } from "./actions";

export function DeleteFixedCostButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("この固定費を削除しますか？")) return;
        startTransition(async () => {
          await deleteFixedCost(id);
          router.refresh();
        });
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      削除
    </button>
  );
}
