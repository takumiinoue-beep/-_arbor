import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ProjectWithStaff } from "@/types/database";
import { ProjectsClient } from "./ProjectsClient";

export default async function ProjectsPage() {
  const supabase = await createClient();

  // 認証確認とデータ取得を並列に行い、直列の待ち時間を減らす
  const [profile, { data: projects }, { data: staffList }] = await Promise.all([
    requireProfile(),
    supabase
      .from("projects")
      .select("*, staff:profiles!projects_staff_id_fkey(id, name), price_rates(*)")
      .order("start_date", { ascending: false }),
    supabase.from("profiles").select("*").order("name"),
  ]);

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">案件一覧</h1>
      <ProjectsClient
        projects={(projects as ProjectWithStaff[]) ?? []}
        staffList={staffList ?? []}
        currentUserId={profile.id}
        isAdmin={profile.role === "admin"}
        todayISO={todayISO}
      />
    </div>
  );
}
