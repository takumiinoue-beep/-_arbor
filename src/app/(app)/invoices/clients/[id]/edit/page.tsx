import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateClientRecord } from "../../actions";
import { ClientForm } from "../../ClientForm";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).single();
  if (!client) notFound();

  const boundAction = updateClientRecord.bind(null, client.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">取引先の編集</h1>
      <ClientForm action={boundAction} client={client} submitLabel="更新する" showCancel />
    </div>
  );
}
