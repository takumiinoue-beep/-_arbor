import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/types/database";
import { createProject } from "../actions";
import { ProjectForm } from "../ProjectForm";

export default async function NewProjectPage() {
  await requireAdmin();
  const supabase = await createClient();
  // 案件の取引先に選べるのは、仕入先以外の取引先
  const { data: clients } = await supabase.from("clients").select("id, name").neq("type", "supplier").order("name");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">案件の新規登録</h1>
      <ProjectForm action={createProject} clients={(clients as Pick<Client, "id" | "name">[]) ?? []} priceRates={[]} submitLabel="登録する" />
    </div>
  );
}
