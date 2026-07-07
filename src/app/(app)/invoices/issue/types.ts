export type InvoiceItemForm = {
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: number;
  amount: number;
};

export type InvoiceForm = {
  invoice_number: string;
  date: string;
  due_date: string;
  subject: string;
  client_id: string;
  client_name: string;
  company_bank_account_id: string;
  notes: string;
};

export function toToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toNextMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const yymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `INV-${yymm}-${rand}`;
}

export function formatAmount(n: number): string {
  return "¥" + Math.round(n || 0).toLocaleString("ja-JP");
}

export const emptyItem: InvoiceItemForm = {
  description: "",
  quantity: "1",
  unit_price: "0",
  tax_rate: 0.1,
  amount: 0,
};

export function emptyForm(): InvoiceForm {
  return {
    invoice_number: "",
    date: toToday(),
    due_date: toNextMonth(),
    subject: "",
    client_id: "",
    client_name: "",
    company_bank_account_id: "",
    notes: "",
  };
}

export function computeTotals(items: InvoiceItemForm[]) {
  const subtotal = items.reduce((s, it) => s + (it.amount || 0), 0);
  const tax10 = items
    .filter((it) => it.tax_rate === 0.1)
    .reduce((s, it) => s + Math.round((it.amount || 0) * 0.1), 0);
  const tax8 = items
    .filter((it) => it.tax_rate === 0.08)
    .reduce((s, it) => s + Math.round((it.amount || 0) * 0.08), 0);
  const total = subtotal + tax10 + tax8;
  const subtotal10 = items.filter((it) => it.tax_rate === 0.1).reduce((s, it) => s + (it.amount || 0), 0);
  const subtotal8 = items.filter((it) => it.tax_rate === 0.08).reduce((s, it) => s + (it.amount || 0), 0);

  return { subtotal, tax10, tax8, total, subtotal10, subtotal8 };
}
