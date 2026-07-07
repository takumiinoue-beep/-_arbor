import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { logout } from "@/app/login/actions";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/projects", label: "案件一覧" },
  { href: "/staff-summary", label: "担当者別集計" },
  { href: "/charts", label: "グラフ" },
  { href: "/fixed-costs", label: "固定費管理" },
];

const adminNavItems = [
  { href: "/staff", label: "担当者管理" },
  { href: "/invoices/issue", label: "請求書発行" },
  { href: "/invoices/clients", label: "取引先" },
  { href: "/invoices/company", label: "自社情報" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-sm font-bold text-slate-900">案件・売上管理</span>
            <nav className="flex flex-wrap gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
              {profile.role === "admin" &&
                adminNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    {item.label}
                  </Link>
                ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {profile.name}
              <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                {profile.role === "admin" ? "管理者" : "担当者"}
              </span>
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
