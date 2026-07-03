"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Profile } from "@/types/database";

type Action = (
  prevState: { error: string } | null,
  formData: FormData
) => Promise<{ error: string } | null>;

export function StaffForm({
  action,
  profile,
  mode,
}: {
  action: Action;
  profile?: Profile;
  mode: "create" | "edit";
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "create" && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">
            メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            name="email"
            type="email"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">
          担当者名 <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          required
          defaultValue={profile?.name}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">所属・役職</label>
        <input
          name="position"
          defaultValue={profile?.position ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">権限</label>
        <select
          name="role"
          defaultValue={profile?.role ?? "staff"}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="staff">担当者</option>
          <option value="admin">管理者</option>
        </select>
      </div>

      {mode === "create" && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">
            初期パスワード（8文字以上） <span className="text-red-500">*</span>
          </label>
          <input
            name="password"
            type="text"
            required
            minLength={8}
            placeholder="本人へ共有してください"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "保存中..." : mode === "create" ? "登録する" : "更新する"}
        </button>
        <Link
          href="/staff"
          className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
