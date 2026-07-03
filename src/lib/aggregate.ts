import type { ProjectWithStaff } from "@/types/database";

export type StaffAggregate = {
  staffId: string;
  staffName: string;
  budget: number;
  actual: number;
};

export function aggregateByStaff(projects: ProjectWithStaff[]): StaffAggregate[] {
  const map = new Map<string, StaffAggregate>();

  for (const p of projects) {
    const staffId = p.staff_id ?? "unknown";
    const staffName = p.staff?.name ?? "未割当";
    const entry = map.get(staffId) ?? { staffId, staffName, budget: 0, actual: 0 };
    entry.budget += p.budget;
    entry.actual += p.actual;
    map.set(staffId, entry);
  }

  return Array.from(map.values()).sort((a, b) => b.actual - a.actual);
}

export type MonthlyAggregate = {
  month: string;
  budget: number;
  actual: number;
};

export function aggregateByMonth(projects: ProjectWithStaff[]): MonthlyAggregate[] {
  const map = new Map<string, MonthlyAggregate>();

  for (const p of projects) {
    const month = p.start_date.slice(0, 7);
    const entry = map.get(month) ?? { month, budget: 0, actual: 0 };
    entry.budget += p.budget;
    entry.actual += p.actual;
    map.set(month, entry);
  }

  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export function sumBudget(projects: ProjectWithStaff[]): number {
  return projects.reduce((sum, p) => sum + p.budget, 0);
}

export function sumActual(projects: ProjectWithStaff[]): number {
  return projects.reduce((sum, p) => sum + p.actual, 0);
}
