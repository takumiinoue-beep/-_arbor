import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PriceRate, Project } from "@/types/database";
import { ProjectsClient } from "./ProjectsClient";

export default async function ProjectsPage() {
  const supabase = await createClient();

  // 認証確認とデータ取得を並列に行い、直列の待ち時間を減らす
  const [profile, { data: projects }] = await Promise.all([
    requireProfile(),
    supabase.from("projects").select("*, price_rates(*)").order("start_date", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">案件一覧</h1>
      <ProjectsClient
        projects={(projects as (Project & { price_rates: PriceRate[] })[]) ?? []}
        isAdmin={profile.role === "admin"}
      />
    </div>
  );
}
