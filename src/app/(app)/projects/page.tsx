import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ProjectWithStaff } from "@/types/database";
import { ProjectsClient } from "./ProjectsClient";
import { CarryOverButton } from "./CarryOverButton";

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
  // 引き継ぎ先の初期値は来月
  const nextMonth = new Date(Date.UTC(Number(todayISO.slice(0, 4)), Number(todayISO.slice(5, 7)), 1))
    .toISOString()
    .slice(0, 7);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900">案件一覧（案件の登録）</h1>
        {profile.role === "admin" && <CarryOverButton defaultMonth={nextMonth} />}
      </div>
      <ProjectsClient
        projects={(projects as ProjectWithStaff[]) ?? []}
        staffList={staffList ?? []}
        isAdmin={profile.role === "admin"}
        todayISO={todayISO}
      />
    </div>
  );
}
