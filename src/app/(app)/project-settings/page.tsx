import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
import type { ProjectAssignment, ProjectStatus } from "@/types/database";
import { ProjectSettingsClient, type SettingsAcquisition, type SettingsProject } from "./ProjectSettingsClient";

export default async function ProjectSettingsPage() {
  const supabase = await createClient();

  const [profile, { data: projects }, { data: staffList }, { data: assignments }, acquisitions] = await Promise.all([
    requireProfile(),
    supabase.from("projects").select("id, name, start_date, end_date, status, unit_price, price_rates(unit_price)"),
    supabase.from("profiles").select("id, name").order("name"),
    supabase.from("project_assignments").select("*").order("sort_order"),
    fetchAllRows<SettingsAcquisition>((from, to) =>
      supabase
        .from("acquisitions")
        .select("acquired_date, target_month, project_id, staff_id, quantity, amount")
        .order("acquired_date")
        .order("id")
        .range(from, to)
    ),
  ]);

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">案件設定</h1>
      <ProjectSettingsClient
        projects={((projects ?? []) as unknown as (SettingsProject & { status: ProjectStatus })[]) ?? []}
        staffList={(staffList as { id: string; name: string }[]) ?? []}
        assignments={(assignments as ProjectAssignment[]) ?? []}
        acquisitions={acquisitions}
        isAdmin={profile.role === "admin"}
        todayISO={todayISO}
      />
    </div>
  );
}
