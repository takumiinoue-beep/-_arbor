import { currentFiscalYear } from "@/lib/accounting";

// ?fy=2025 のような指定を事業年度（開始年）に解釈する。無効なら今の事業年度。
export function resolveFiscalYear(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100) return parsed;
  return currentFiscalYear(new Date().toISOString().slice(0, 10));
}
