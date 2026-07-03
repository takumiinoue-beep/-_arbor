import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateFixedCost } from "../../actions";
import { FixedCostForm } from "../../FixedCostForm";

export default async function EditFixedCostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: fixedCost } = await supabase.from("fixed_costs").select("*").eq("id", id).single();
  if (!fixedCost) notFound();

  const boundAction = updateFixedCost.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">固定費の編集</h1>
      <FixedCostForm action={boundAction} fixedCost={fixedCost} submitLabel="更新する" showCancel />
    </div>
  );
}
