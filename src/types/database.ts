export type Role = "admin" | "staff";
export type ProjectStatus = "進行中" | "完了" | "中止";
export type PeriodType = "毎月" | "毎年" | "単発";

export type Profile = {
  id: string;
  name: string;
  position: string | null;
  role: Role;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  staff_id: string | null;
  start_date: string;
  end_date: string | null;
  budget: number;
  actual: number;
  status: ProjectStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type ProjectWithStaff = Project & {
  staff: Pick<Profile, "id" | "name"> | null;
};

export type ActualLog = {
  id: string;
  project_id: string;
  old_value: number | null;
  new_value: number | null;
  changed_by: string | null;
  changed_at: string;
};

export type FixedCost = {
  id: string;
  item_name: string;
  amount: number;
  period_type: PeriodType;
  target_month: string;
  notes: string | null;
  created_at: string;
};

