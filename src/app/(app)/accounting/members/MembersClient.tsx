"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/common/Modal";
import { MEMBER_KINDS, formatShortYen, formatYen, memberKindLabel } from "@/lib/accounting";
import type { Member, Profile } from "@/types/database";
import { deleteMember, saveMember } from "../actions";

type Staff = Pick<Profile, "id" | "name">;

function describeIncentive(m: Member): string {
  const tiers = m.incentive_tiers ?? [];
  if (tiers.length === 0) return "-";
  const shown = tiers
    .slice(0, 3)
    .map((t) => `${formatShortYen(Number(t.threshold))}→${formatShortYen(Number(t.amount))}`)
    .join(" / ");
  return tiers.length > 3 ? `${shown} ほか${tiers.length - 3}段階` : shown;
}

type TierRow = { threshold: string; amount: string };

function MemberForm({
  member,
  staffList,
  defaultMonth,
  onDone,
}: {
  member: Member | null;
  staffList: Staff[];
  defaultMonth: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveMember, null);
  const wasPending = useRef(false);
  const router = useRouter();
  const [tiers, setTiers] = useState<TierRow[]>(
    (member?.incentive_tiers ?? []).map((t) => ({ threshold: String(t.threshold), amount: String(t.amount) }))
  );

  function updateTier(idx: number, patch: Partial<TierRow>) {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      onDone();
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state, onDone, router]);

  const field = "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
  const label = "text-sm font-medium text-slate-700";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {member && <input type="hidden" name="id" value={member.id} />}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className={label}>
            名前 <span className="text-red-500">*</span>
          </label>
          <input name="name" required defaultValue={member?.name} className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>
            区分 <span className="text-red-500">*</span>
          </label>
          <select name="kind" required defaultValue={member?.kind ?? "outsource"} className={field}>
            {MEMBER_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className={label}>月額人件費・報酬（円）</label>
          <input name="monthly_cost" type="number" min={0} step={1} defaultValue={member?.monthly_cost ?? 0} className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>月額法定福利費（円）</label>
          <input
            name="monthly_social_insurance"
            type="number"
            min={0}
            step={1}
            defaultValue={member?.monthly_social_insurance ?? 0}
            className={field}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className={label}>
            開始月 <span className="text-red-500">*</span>
          </label>
          <input
            name="start_month"
            type="month"
            required
            defaultValue={member?.start_month.slice(0, 7) ?? defaultMonth}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>終了月（空欄＝継続中）</label>
          <input name="end_month" type="month" defaultValue={member?.end_month?.slice(0, 7) ?? ""} className={field} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <input type="hidden" name="incentive_tiers" value={JSON.stringify(tiers)} />
        <p className="mb-1 text-sm font-semibold text-slate-700">インセンティブ（任意）</p>
        <p className="mb-2 text-xs text-slate-500">
          月の売上が「◯円以上」になったとき支給する金額を、段階ごとに設定します。金額は不規則でも構いません。
          売上が複数の段階に届いたときは、届いた中で一番高い段階の金額になります。
        </p>

        {tiers.length > 0 && (
          <div className="mb-2 flex flex-col gap-2">
            {tiers.map((t, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={t.threshold}
                  onChange={(e) => updateTier(idx, { threshold: e.target.value })}
                  placeholder="売上（円）例：800000"
                  className={`${field} w-48`}
                />
                <span className="w-12 text-xs text-slate-500">
                  {Number(t.threshold) > 0 ? formatShortYen(Number(t.threshold)) : ""}
                </span>
                <span className="text-xs text-slate-500">以上 →</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={t.amount}
                  onChange={(e) => updateTier(idx, { amount: e.target.value })}
                  placeholder="金額（円）例：50000"
                  className={`${field} w-44`}
                />
                <span className="w-14 text-xs text-slate-500">
                  {t.amount !== "" && Number(t.amount) >= 0 ? formatShortYen(Number(t.amount)) : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setTiers((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-xs text-red-500 hover:underline"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setTiers((prev) => [...prev, { threshold: "", amount: "" }])}
          className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          ＋ 段階を追加
        </button>

        <div className="mt-3 flex flex-col gap-1">
          <label className={label}>売上の対象となるログインアカウント（OP）</label>
          <select name="profile_id" defaultValue={member?.profile_id ?? ""} className={field}>
            <option value="">紐づけない（インセンティブは計算されません）</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            紐づけたOPの月間売上（請求金額）で判定し、原価（外注費）の「インセンティブ」に計上します。
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className={label}>備考</label>
        <input name="notes" defaultValue={member?.notes ?? ""} className={field} />
      </div>

      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "保存中..." : "保存する"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

export function MembersClient({
  members,
  staffList,
  todayISO,
}: {
  members: Member[];
  staffList: Staff[];
  todayISO: string;
}) {
  const [editing, setEditing] = useState<Member | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const staffName = new Map(staffList.map((s) => [s.id, s.name]));

  function handleDelete(m: Member) {
    if (!confirm(`「${m.name}」を削除しますか？過去のPLからもこのメンバーの人件費が消えます。`)) return;
    startTransition(async () => {
      const result = await deleteMember(m.id);
      if (result?.error) alert(`削除できませんでした: ${result.error}`);
      else router.refresh();
    });
  }

  const period = (m: Member) =>
    `${m.start_month.slice(0, 7)} 〜 ${m.end_month ? m.end_month.slice(0, 7) : "継続中"}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          ここで登録した人件費は、月次PLの「原価（労務費・外注費・インセンティブ）」「役員報酬」「給料手当」「法定福利費」に自動で反映されます。
        </p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + メンバーを登録
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">名前</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">区分</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">月額人件費</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">月額法定福利費</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">期間</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">インセンティブ</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">OP</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">{m.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{memberKindLabel(m.kind)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700">{formatYen(Number(m.monthly_cost))}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700">
                  {formatYen(Number(m.monthly_social_insurance))}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{period(m)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{describeIncentive(m)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                  {m.profile_id ? (staffName.get(m.profile_id) ?? "-") : "-"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setEditing(m)} className="text-xs text-slate-600 hover:underline">
                      編集
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDelete(m)}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                  メンバーが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "メンバーの登録" : "メンバーの編集"}
        size="lg"
      >
        {editing !== null && (
          <MemberForm
            key={editing === "new" ? "new" : editing.id}
            member={editing === "new" ? null : editing}
            staffList={staffList}
            defaultMonth={todayISO.slice(0, 7)}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
