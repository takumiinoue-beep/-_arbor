"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBankAccount } from "./actions";

export function DeleteBankAccountButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("この銀行口座を削除しますか？")) return;
        startTransition(async () => {
          const result = await deleteBankAccount(id);
          if (result?.error) {
            alert(`削除できませんでした: ${result.error}`);
            return;
          }
          router.refresh();
        });
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      削除
    </button>
  );
}
