import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updatePriceRate } from "../../actions";
import { PriceRateForm } from "../../PriceRateForm";

export default async function EditPriceRatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: priceRate } = await supabase.from("price_rates").select("*").eq("id", id).single();
  if (!priceRate) notFound();

  const boundAction = updatePriceRate.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">料金設定の編集</h1>
      <PriceRateForm action={boundAction} priceRate={priceRate} submitLabel="更新する" showCancel />
    </div>
  );
}
