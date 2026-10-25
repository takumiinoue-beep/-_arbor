import Link from "next/link";
import { fiscalYearLabel } from "@/lib/accounting";

export function FiscalYearNav({ basePath, fy }: { basePath: string; fy: number }) {
  const linkClass = "rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`${basePath}?fy=${fy - 1}`} className={linkClass}>
        ← 前年度
      </Link>
      <span className="px-2 text-sm font-semibold text-slate-800">{fiscalYearLabel(fy)}</span>
      <Link href={`${basePath}?fy=${fy + 1}`} className={linkClass}>
        翌年度 →
      </Link>
    </div>
  );
}
