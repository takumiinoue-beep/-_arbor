"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/accounting/pl", label: "月次PL（計画と結果）" },
  { href: "/accounting/plan", label: "計画入力" },
  { href: "/accounting/members", label: "メンバー・人件費" },
  { href: "/accounting/expenses", label: "経費" },
  { href: "/accounting/vendor-invoices", label: "取引先請求" },
];

export function AccountingTabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap ${
            pathname === t.href
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
