import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CompanySettingsForm } from "./CompanySettingsForm";
import { BankAccountForm } from "./BankAccountForm";
import { DeleteBankAccountButton } from "./DeleteBankAccountButton";

export default async function CompanyPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: settingsRows }, { data: bankAccounts }] = await Promise.all([
    supabase.from("company_settings").select("*").order("id").limit(1),
    supabase.from("company_bank_accounts").select("*").order("id"),
  ]);

  const settings = settingsRows?.[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">自社情報</h1>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">会社情報</h2>
        <CompanySettingsForm settings={settings} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">自社銀行口座の登録</h2>
        <BankAccountForm />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">銀行名</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">支店名</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">口座種別</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">口座番号</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">口座名義</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(bankAccounts ?? []).map((b) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{b.bank_name}</td>
                <td className="px-3 py-2 text-slate-600">{b.bank_branch ?? "-"}</td>
                <td className="px-3 py-2 text-slate-600">{b.account_type ?? "-"}</td>
                <td className="px-3 py-2 text-slate-600">{b.account_number ?? "-"}</td>
                <td className="px-3 py-2 text-slate-600">{b.account_holder ?? "-"}</td>
                <td className="px-3 py-2">
                  <DeleteBankAccountButton id={b.id} />
                </td>
              </tr>
            ))}
            {(bankAccounts ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  自社銀行口座が登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
