import { requireAdmin } from "@/lib/auth";
import { nextMemberNo } from "@/lib/memberNo";
import { createClient } from "@/lib/supabase/server";
import { createStaff } from "../actions";
import { StaffForm } from "../StaffForm";

export default async function NewStaffPage() {
  await requireAdmin();
  // メンバー番号には、あらかじめ次の番号（今の最後の番号＋1）を入れておく
  const defaultMemberNo = await nextMemberNo(await createClient());

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">担当者の新規登録</h1>
      <div className="max-w-md">
        <StaffForm action={createStaff} mode="create" defaultMemberNo={defaultMemberNo} />
      </div>
    </div>
  );
}
