import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FixedCost, ProjectWithStaff } from "@/types/database";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: projects }, { data: fixedCosts }] = await Promise.all([
    supabase.from("projects").select("*, staff:profiles!projects_staff_id_fkey(id, name)"),
    supabase.from("fixed_costs").select("*"),
  ]);

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">ダッシュボード</h1>
      <DashboardClient
        projects={(projects as ProjectWithStaff[]) ?? []}
        fixedCosts={(fixedCosts as FixedCost[]) ?? []}
        todayISO={todayISO}
      />
    </div>
  );
}
