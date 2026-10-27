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
        if (!confirm("この案件を削除しますか？案件設定に入っている設定も一緒に削除され、取り消せません。")) return;
        startTransition(async () => {
          const result = await deleteProject(projectId);
          if (result?.error) {
            alert(result.error);
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
