"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAcquisition } from "./actions";

export function DeleteAcquisitionButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("この案件獲得の登録を削除しますか？加算されていた実績件数も差し引かれます。")) return;
        startTransition(async () => {
          try {
            await deleteAcquisition(id);
            router.refresh();
          } catch (e) {
            alert(e instanceof Error ? `削除できませんでした: ${e.message}` : "削除できませんでした。");
          }
        });
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      削除
    </button>
  );
}
