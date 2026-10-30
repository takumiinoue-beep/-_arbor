import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/types/database";
import { updateProject } from "../../actions";
import { ProjectForm } from "../../ProjectForm";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: priceRates }, { data: clients }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("price_rates").select("*").eq("project_id", id).order("sort_order"),
    supabase.from("clients").select("id, name").neq("type", "supplier").order("name"),
  ]);

  if (!project) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">案件の編集</h1>
      <ProjectForm
        action={updateProject.bind(null, id)}
        clients={(clients as Pick<Client, "id" | "name">[]) ?? []}
        priceRates={priceRates ?? []}
        project={project}
        submitLabel="更新する"
      />
    </div>
  );
}
