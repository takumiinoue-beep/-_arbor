import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Project, PriceRate } from "@/types/database";
import { createProject } from "../actions";
import { ProjectForm, type NameTemplate } from "../ProjectForm";

export default async function NewProjectPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: staffList }, { data: allProjects }] = await Promise.all([
    supabase.from("profiles").select("*").order("name"),
    supabase
      .from("projects")
      .select("name, unit_price, client_position, client_employee_count, price_rates(*)")
      .order("start_date", { ascending: false }),
  ]);

  const rows =
    (allProjects as (Pick<Project, "name" | "unit_price" | "client_position" | "client_employee_count"> & {
      price_rates: PriceRate[];
    })[]) ?? [];

  const nameTemplates: Record<string, NameTemplate> = {};
  for (const p of rows) {
    if (!nameTemplates[p.name]) {
      nameTemplates[p.name] = {
        unit_price: p.unit_price,
        client_position: p.client_position,
        client_employee_count: p.client_employee_count,
        price_rates: p.price_rates ?? [],
      };
    }
  }

  const existingNames = Object.keys(nameTemplates).sort((a, b) => a.localeCompare(b, "ja"));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">案件の新規登録</h1>
      <ProjectForm
        action={createProject}
        staffList={staffList ?? []}
        priceRates={[]}
        existingNames={existingNames}
        nameTemplates={nameTemplates}
        submitLabel="登録する"
      />
    </div>
  );
}
