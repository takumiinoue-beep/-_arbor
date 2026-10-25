"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStaff } from "./actions";

export function DeleteStaffButton({ id, currentUserId }: { id: string; currentUserId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (id === currentUserId) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("この担当者を削除しますか？担当中の案件や案件獲得の記録がある場合は削除できません。")) return;
        startTransition(async () => {
          const result = await deleteStaff(id);
          if (result?.error) alert(`削除できませんでした: ${result.error}`);
          else router.refresh();
        });
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      削除
    </button>
  );
}
