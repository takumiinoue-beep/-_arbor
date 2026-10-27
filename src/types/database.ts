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
  unit_price: number;
  quantity: number;
  budget: number;
  actual_quantity: number;
  confirmed_quantity: number;
  actual: number;
  status: ProjectStatus;
  notes: string | null;
  client_position: string | null;
  client_employee_count: number | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type ProjectWithStaff = Project & {
  staff: Pick<Profile, "id" | "name"> | null;
  price_rates?: PriceRate[];
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

export type PriceRate = {
  id: string;
  project_id: string;
  position: string;
  employee_min: number;
  employee_max: number | null;
  unit_price: number;
  quantity: number;
  actual_quantity: number;
  confirmed_quantity: number;
  sort_order: number;
  created_at: string;
};

export type Acquisition = {
  id: string;
  acquired_date: string;
  target_month: string | null;
  project_id: string;
  rate_id: string | null;
  position: string | null;
  employee_count: number | null;
  unit_price: number;
  quantity: number;
  amount: number;
  staff_id: string;
  created_by: string | null;
  created_at: string;
};

export type MemberKind = "labor_existing" | "labor_new" | "outsource" | "executive" | "salary";

export type IncentiveTier = { threshold: number; amount: number };

export type Member = {
  id: string;
  name: string;
  kind: MemberKind;
  profile_id: string | null;
  monthly_cost: number;
  monthly_social_insurance: number;
  incentive_sales_unit: number | null;
  incentive_amount: number | null;
  incentive_tiers: IncentiveTier[];
  start_month: string;
  end_month: string | null;
  notes: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  expense_month: string;
  end_month: string | null;
  ongoing: boolean;
  account: string;
  amount: number;
  description: string | null;
  created_by: string | null;
  created_at: string;
};

export type VendorInvoiceStatus = "unpaid" | "paid";

export type VendorInvoice = {
  id: string;
  client_id: number | null;
  vendor_name: string | null;
  invoice_date: string;
  subtotal: number;
  tax: number;
  account: string;
  description: string | null;
  status: VendorInvoiceStatus;
  paid_date: string | null;
  created_by: string | null;
  created_at: string;
};

export type PlSection = "sales" | "labor" | "outsource" | "sga";

export type PlPlanEntry = {
  id: string;
  plan_month: string;
  section: PlSection;
  line_label: string;
  amount: number;
  sort_order: number;
};

// 案件設定：月 × メンバー × 案件の目標件数・有効率（%）
export type ProjectAssignment = {
  id: string;
  month: string;
  staff_id: string;
  project_id: string;
  target_quantity: number;
  effective_rate: number;
  memo: string | null;
  sort_order: number;
};

// 結果の手入力値（pl_actual_entries）。形は計画と同じ
export type PlActualEntry = PlPlanEntry;

export type OpConfirmedQuantity = {
  id: string;
  project_id: string;
  rate_id: string | null;
  staff_id: string;
  confirmed_quantity: number;
  updated_at: string;
};

export type ClientType = "customer" | "supplier" | "other";
export type InvoiceStatus = "unpaid" | "paid";

export type Client = {
  id: number;
  name: string;
  type: ClientType;
  address: string | null;
  postal_code: string | null;
  created_at: string;
};

export type CompanyBankAccount = {
  id: number;
  bank_name: string;
  bank_branch: string | null;
  account_type: string | null;
  account_number: string | null;
  account_holder: string | null;
  created_at: string;
};

export type CompanySettings = {
  id: number;
  company_name: string | null;
  representative: string | null;
  postal_code: string | null;
  address: string | null;
  building_name: string | null;
  invoice_number: string | null;
  created_at: string;
};

export type InvoiceItem = {
  id: number;
  invoice_id: number;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  tax_rate: number | null;
  amount: number | null;
  unit: string | null;
  created_at: string;
};

export type InvoiceIssued = {
  id: number;
  invoice_number: string | null;
  date: string | null;
  due_date: string | null;
  subject: string | null;
  client_id: number | null;
  client_name: string | null;
  company_bank_account_id: number | null;
  bank_account_id: number | null;
  subtotal: number;
  tax_8: number;
  tax_10: number;
  total: number;
  notes: string | null;
  status: InvoiceStatus;
  is_deleted: boolean;
  dencho_saved_at: string | null;
  journal_id: number | null;
  paid_date: string | null;
  created_at: string;
};

