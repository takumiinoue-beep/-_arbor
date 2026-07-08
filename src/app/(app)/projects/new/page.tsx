import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createProject } from "../actions";
import { ProjectForm } from "../ProjectForm";

export default async function NewProjectPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: staffList }, { data: priceRates }] = await Promise.all([
    supabase.from("profiles").select("*").order("name"),
    supabase.from("price_rates").select("*").order("position").order("employee_min"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">案件の新規登録</h1>
      <ProjectForm
        action={createProject}
        staffList={staffList ?? []}
        priceRates={priceRates ?? []}
        submitLabel="登録する"
      />
    </div>
  );
}
