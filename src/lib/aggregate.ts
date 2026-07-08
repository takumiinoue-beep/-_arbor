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

export type EffectiveCounts = { actualQty: number; confirmedQty: number };

// 実績件数・確定件数を返す。料金表の行がある案件は行ごとの合計、
// 無い案件は案件本体の値を使う（予算・実績件数と同じ考え方）。
export function getEffectiveCounts(p: ProjectWithStaff): EffectiveCounts {
  const rates = p.price_rates;
  if (rates && rates.length > 0) {
    return {
      actualQty: rates.reduce((sum, r) => sum + r.actual_quantity, 0),
      confirmedQty: rates.reduce((sum, r) => sum + r.confirmed_quantity, 0),
    };
  }
  return { actualQty: p.actual_quantity, confirmedQty: p.confirmed_quantity };
}

export function sumEffectiveCounts(projects: ProjectWithStaff[]): EffectiveCounts {
  return projects.reduce(
    (acc, p) => {
      const c = getEffectiveCounts(p);
      acc.actualQty += c.actualQty;
      acc.confirmedQty += c.confirmedQty;
      return acc;
    },
    { actualQty: 0, confirmedQty: 0 }
  );
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
