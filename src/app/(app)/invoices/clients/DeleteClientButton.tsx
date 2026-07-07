"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClientRecord } from "./actions";

export function DeleteClientButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("この取引先を削除しますか？")) return;
        startTransition(async () => {
          try {
            await deleteClientRecord(id);
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
