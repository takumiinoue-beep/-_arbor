import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createClientRecord } from "./actions";
import { ClientForm } from "./ClientForm";
import { DeleteClientButton } from "./DeleteClientButton";

const TYPE_LABEL: Record<string, string> = {
  customer: "得意先",
  supplier: "仕入先",
  other: "その他",
};

export default async function ClientsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: clients } = await supabase.from("clients").select("*").order("name");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">取引先マスタ</h1>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">取引先の登録</h2>
        <ClientForm action={createClientRecord} submitLabel="登録する" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">取引先名</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">種別</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">郵便番号</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">住所</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(clients ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{c.name}</td>
                <td className="px-3 py-2 text-slate-600">{TYPE_LABEL[c.type] ?? c.type}</td>
                <td className="px-3 py-2 text-slate-600">{c.postal_code ?? "-"}</td>
                <td className="px-3 py-2 text-slate-600">{c.address ?? "-"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <Link href={`/invoices/clients/${c.id}/edit`} className="text-xs text-slate-600 hover:underline">
                      編集
                    </Link>
                    <DeleteClientButton id={c.id} />
                  </div>
                </td>
              </tr>
            ))}
            {(clients ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  取引先が登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
