import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ProjectWithStaff } from "@/types/database";
import { DashboardClient, type AcquisitionRow } from "./DashboardClient";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: projects }, { data: staffList }, { data: acquisitions }] = await Promise.all([
    supabase.from("projects").select("*, staff:profiles!projects_staff_id_fkey(id, name), price_rates(*)"),
    supabase.from("profiles").select("*").order("name"),
    supabase
      .from("acquisitions")
      .select(
        "*, project:projects(id, name, confirmed_quantity), staff:profiles!acquisitions_staff_id_fkey(id, name), rate:price_rates(id, confirmed_quantity)"
      )
      .order("acquired_date", { ascending: false }),
  ]);

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">ダッシュボード</h1>
      <DashboardClient
        projects={(projects as ProjectWithStaff[]) ?? []}
        staffList={(staffList as Profile[]) ?? []}
        acquisitions={(acquisitions as AcquisitionRow[]) ?? []}
        currentUserId={profile.id}
        isAdmin={profile.role === "admin"}
        todayISO={todayISO}
      />
    </div>
  );
}
