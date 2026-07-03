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
        if (!confirm("この担当者を削除しますか？担当中の案件がある場合は削除できません。")) return;
        startTransition(async () => {
          try {
            await deleteStaff(id);
            router.refresh();
          } catch (e) {
            alert(
              e instanceof Error
                ? `削除できませんでした: ${e.message}`
                : "削除できませんでした。担当中の案件を先に別の担当者へ変更してください。"
            );
          }
        });
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      削除
    </button>
  );
}
