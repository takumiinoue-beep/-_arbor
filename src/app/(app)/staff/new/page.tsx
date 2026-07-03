import { requireAdmin } from "@/lib/auth";
import { createStaff } from "../actions";
import { StaffForm } from "../StaffForm";

export default async function NewStaffPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">担当者の新規登録</h1>
      <div className="max-w-md">
        <StaffForm action={createStaff} mode="create" />
      </div>
    </div>
  );
}
