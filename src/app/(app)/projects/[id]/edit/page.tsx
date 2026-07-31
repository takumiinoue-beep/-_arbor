import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Project, PriceRate } from "@/types/database";
import { updateProject } from "../../actions";
import { ProjectForm, type NameTemplate } from "../../ProjectForm";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: staffList }, { data: priceRates }, { data: allProjects }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("profiles").select("*").order("name"),
      supabase.from("price_rates").select("*").eq("project_id", id).order("sort_order"),
      supabase
        .from("projects")
        .select("name, unit_price, client_position, client_employee_count, price_rates(*)")
        .order("start_date", { ascending: false }),
    ]);

  if (!project) notFound();

  const boundAction = updateProject.bind(null, id);

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
      <h1 className="text-lg font-bold text-slate-900">案件の編集</h1>
      <ProjectForm
        action={boundAction}
        staffList={staffList ?? []}
        priceRates={priceRates ?? []}
        project={project}
        existingNames={existingNames}
        nameTemplates={nameTemplates}
        submitLabel="更新する"
      />
    </div>
  );
}
