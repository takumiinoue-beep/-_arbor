import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CompanySettingsForm } from "./CompanySettingsForm";
import { BankAccountForm } from "./BankAccountForm";
import { DeleteBankAccountButton } from "./DeleteBankAccountButton";
import { DeleteStaffButton } from "../../staff/DeleteStaffButton";

export default async function CompanyPage() {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const [{ data: settingsRows }, { data: bankAccounts }, { data: staffList }] = await Promise.all([
    supabase.from("company_settings").select("*").order("id").limit(1),
    supabase.from("company_bank_accounts").select("*").order("id"),
    supabase.from("profiles").select("*").order("name"),
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

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">担当者管理</h2>
        <Link
          href="/staff/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + 担当者を登録
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-500">担当者名</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">所属・役職</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">権限</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(staffList ?? []).map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{s.name}</td>
                <td className="px-3 py-2 text-slate-600">{s.position ?? "-"}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      s.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {s.role === "admin" ? "管理者" : "担当者"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <Link href={`/staff/${s.id}/edit`} className="text-xs text-slate-600 hover:underline">
                      編集
                    </Link>
                    <DeleteStaffButton id={s.id} currentUserId={profile.id} />
                  </div>
                </td>
              </tr>
            ))}
            {(staffList ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  担当者が登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
