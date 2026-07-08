import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ProjectWithStaff } from "@/types/database";
import { StaffSummaryClient } from "./StaffSummaryClient";

export default async function StaffSummaryPage() {
  await requireProfile();
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("*, staff:profiles!projects_staff_id_fkey(id, name)");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">担当者別集計</h1>
      <StaffSummaryClient projects={(projects as ProjectWithStaff[]) ?? []} />
    </div>
  );
}
