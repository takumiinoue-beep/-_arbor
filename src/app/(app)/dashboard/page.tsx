import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
import { fetchConfirmedRows } from "@/lib/confirmed";
import type { Profile, ProjectAssignment } from "@/types/database";
import { DashboardClient, type AcquisitionRow } from "./DashboardClient";
import type { AcquisitionProject } from "./AcquisitionButton";

const ACQUISITION_COLUMNS =
  "id, acquired_date, target_month, project_id, rate_id, staff_id, unit_price, quantity, amount, " +
  "project:projects(id, name), " +
  "staff:profiles!acquisitions_staff_id_fkey(id, name)";

export default async function DashboardPage() {
  const supabase = await createClient();

  // 認証確認とデータ取得を並列に行い、直列の待ち時間を減らす
  const [profile, { data: projects }, { data: staffList }, acquisitions, { data: assignments }] = await Promise.all([
    requireProfile(),
    supabase
      .from("projects")
      .select(
        "id, name, start_date, status, unit_price, effective_rate, price_rates(id, position, employee_min, employee_max, unit_price)"
      ),
    supabase.from("profiles").select("id, name").order("name"),
    fetchAllRows<AcquisitionRow>((from, to) =>
      supabase
        .from("acquisitions")
        .select(ACQUISITION_COLUMNS)
        .order("acquired_date", { ascending: false })
        .order("id")
        .range(from, to)
        .overrideTypes<AcquisitionRow[], { merge: false }>()
    ),
    supabase.from("project_assignments").select("id, month, staff_id, project_id, target_quantity"),
  ]);

  const confirmed = await fetchConfirmedRows();

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">ダッシュボード</h1>
      <DashboardClient
        projects={(projects as AcquisitionProject[]) ?? []}
        assignments={
          (assignments as Pick<ProjectAssignment, "month" | "staff_id" | "project_id" | "target_quantity">[]) ?? []
        }
        staffList={(staffList as Pick<Profile, "id" | "name">[]) ?? []}
        acquisitions={acquisitions}
        confirmed={confirmed}
        currentUserId={profile.id}
        isAdmin={profile.role === "admin"}
        todayISO={todayISO}
      />
    </div>
  );
}
