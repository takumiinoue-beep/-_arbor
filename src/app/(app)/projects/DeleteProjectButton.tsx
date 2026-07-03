"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProject } from "./actions";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("この案件を削除しますか？この操作は取り消せません。")) return;
        startTransition(async () => {
          await deleteProject(projectId);
          router.refresh();
        });
      }}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      削除
    </button>
  );
}
