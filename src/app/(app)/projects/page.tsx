import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ProjectWithStaff } from "@/types/database";
import { ProjectsClient } from "./ProjectsClient";

export default async function ProjectsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: projects }, { data: staffList }] = await Promise.all([
    supabase
      .from("projects")
      .select("*, staff:profiles!projects_staff_id_fkey(id, name), price_rates(*)")
      .order("start_date", { ascending: false }),
    supabase.from("profiles").select("*").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">案件一覧</h1>
      <ProjectsClient
        projects={(projects as ProjectWithStaff[]) ?? []}
        staffList={staffList ?? []}
        currentUserId={profile.id}
        isAdmin={profile.role === "admin"}
      />
    </div>
  );
}
