import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateStaff } from "../../actions";
import { StaffForm } from "../../StaffForm";

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (!profile) notFound();

  const boundAction = updateStaff.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">担当者の編集</h1>
      <div className="max-w-md">
        <StaffForm action={boundAction} profile={profile} mode="edit" />
      </div>
    </div>
  );
}
