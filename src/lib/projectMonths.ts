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
