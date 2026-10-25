import { requireAdmin } from "@/lib/auth";
import { AccountingTabs } from "./AccountingTabs";

export default async function AccountingLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-slate-900">会計</h1>
      <AccountingTabs />
      {children}
    </div>
  );
}
