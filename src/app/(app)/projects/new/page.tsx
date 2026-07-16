import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createProject } from "../actions";
import { ProjectForm } from "../ProjectForm";

export default async function NewProjectPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: staffList }, { data: projectNameRows }] = await Promise.all([
    supabase.from("profiles").select("*").order("name"),
    supabase.from("projects").select("name").order("name"),
  ]);

  const existingNames = Array.from(new Set((projectNameRows ?? []).map((p) => p.name))).sort((a, b) =>
    a.localeCompare(b, "ja")
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">案件の新規登録</h1>
      <ProjectForm
        action={createProject}
        staffList={staffList ?? []}
        priceRates={[]}
        existingNames={existingNames}
        submitLabel="登録する"
      />
    </div>
  );
}
