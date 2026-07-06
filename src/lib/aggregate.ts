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

export type ProjectChartRow = {
  projectName: string;
  staffName: string;
  budget: number;
  actual: number;
};

// 担当者ごとにまとめた上で、担当者の中を案件名でさらに分割した棒グラフ用データ。
// 同じ担当者の案件が横軸で隣り合うように並べる。
export function projectsGroupedByStaff(projects: ProjectWithStaff[]): ProjectChartRow[] {
  return [...projects]
    .sort((a, b) => {
      const staffCompare = (a.staff?.name ?? "未割当").localeCompare(b.staff?.name ?? "未割当", "ja");
      if (staffCompare !== 0) return staffCompare;
      return a.name.localeCompare(b.name, "ja");
    })
    .map((p) => ({
      projectName: p.name,
      staffName: p.staff?.name ?? "未割当",
      budget: p.budget,
      actual: p.actual,
    }));
}

export type StaffGroupBand = {
  staffName: string;
  startProjectName: string;
  endProjectName: string;
};

// projectsGroupedByStaff の並び順を前提に、担当者ごとの区間（背景帯・ラベル用）を求める。
export function computeStaffGroupBands(rows: ProjectChartRow[]): StaffGroupBand[] {
  const bands: StaffGroupBand[] = [];

  for (const row of rows) {
    const last = bands[bands.length - 1];
    if (last && last.staffName === row.staffName) {
      last.endProjectName = row.projectName;
    } else {
      bands.push({
        staffName: row.staffName,
        startProjectName: row.projectName,
        endProjectName: row.projectName,
      });
    }
  }

  return bands;
}
