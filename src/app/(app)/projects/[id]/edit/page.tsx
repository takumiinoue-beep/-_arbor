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

  const [{ data: project }, { data: staffList }, { data: priceRates }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("profiles").select("*").order("name"),
    supabase.from("price_rates").select("*").order("position").order("employee_min"),
  ]);

  if (!project) notFound();

  const boundAction = updateProject.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">案件の編集</h1>
      <ProjectForm
        action={boundAction}
        staffList={staffList ?? []}
        priceRates={priceRates ?? []}
        project={project}
        submitLabel="更新する"
      />
    </div>
  );
}
