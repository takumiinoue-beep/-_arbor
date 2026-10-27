// 案件は月ごとに作る運用のため、計上月の案件がまだ無いときは、前の月の案件を引き継いで作る。
// （期間の終了日が計上月以降にある案件は、その期間に含まれるので引き継がない）
export function needsMonthlyCopy(
  project: { start_date: string; end_date: string | null; status?: string },
  month: string // "YYYY-MM"
): boolean {
  if (project.status !== undefined && project.status !== "進行中") return false;
  if (project.start_date.slice(0, 7) >= month) return false;
  if (project.end_date && project.end_date.slice(0, 7) >= month) return false;
  return true;
}

// 同じ案件名の案件（月ごとに作られる）の中から、指定した月に当てはまるものを選ぶ
// （期間内のもの → 無ければその月以前で最も新しいもの → 無ければ一番早いもの）
export function pickVersion<T extends { start_date: string; end_date: string | null }>(
  versions: T[],
  month: string // "YYYY-MM"
): T | undefined {
  const byStartDesc = [...versions].sort((a, b) => b.start_date.localeCompare(a.start_date));
  const ym = (d: string) => d.slice(0, 7);
  return (
    byStartDesc.find((p) => ym(p.start_date) <= month && (!p.end_date || ym(p.end_date) >= month)) ??
    byStartDesc.find((p) => ym(p.start_date) <= month) ??
    byStartDesc[byStartDesc.length - 1]
  );
}
