import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateProject } from "../../actions";
import { ProjectForm } from "../../ProjectForm";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: staffList }, { data: priceRates }, { data: projectNameRows }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("profiles").select("*").order("name"),
      supabase.from("price_rates").select("*").eq("project_id", id).order("sort_order"),
      supabase.from("projects").select("name").order("name"),
    ]);

  if (!project) notFound();

  const boundAction = updateProject.bind(null, id);
  const existingNames = Array.from(new Set((projectNameRows ?? []).map((p) => p.name))).sort((a, b) =>
    a.localeCompare(b, "ja")
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">案件の編集</h1>
      <ProjectForm
        action={boundAction}
        staffList={staffList ?? []}
        priceRates={priceRates ?? []}
        project={project}
        existingNames={existingNames}
        submitLabel="更新する"
      />
    </div>
  );
}
