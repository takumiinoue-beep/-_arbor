import { requireAdmin } from "@/lib/auth";
import { createProject } from "../actions";
import { ProjectForm } from "../ProjectForm";

export default async function NewProjectPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">案件の新規登録</h1>
      <ProjectForm action={createProject} priceRates={[]} submitLabel="登録する" />
    </div>
  );
}
