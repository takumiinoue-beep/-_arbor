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
  created_at: string;
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
  address: string | null;
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

