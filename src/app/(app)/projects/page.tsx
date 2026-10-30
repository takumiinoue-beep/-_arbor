import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, PriceRate, Project } from "@/types/database";
import { ProjectsClient } from "./ProjectsClient";

export default async function ProjectsPage() {
  const supabase = await createClient();

  // 認証確認とデータ取得を並列に行い、直列の待ち時間を減らす
  const [profile, { data: projects }, { data: clients }] = await Promise.all([
    requireProfile(),
    supabase.from("projects").select("*, price_rates(*)").order("start_date", { ascending: false }),
    // 取引先は管理者だけが読める（管理者以外には空で返り、取引先は「-」と表示される）
    supabase.from("clients").select("id, name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">案件一覧</h1>
      <ProjectsClient
        projects={(projects as (Project & { price_rates: PriceRate[] })[]) ?? []}
        clientNames={Object.fromEntries(((clients as Pick<Client, "id" | "name">[]) ?? []).map((c) => [c.id, c.name]))}
        isAdmin={profile.role === "admin"}
      />
    </div>
  );
}
