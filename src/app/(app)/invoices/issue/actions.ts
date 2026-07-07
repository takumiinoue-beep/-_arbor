"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { InvoiceItem, InvoiceStatus } from "@/types/database";

export type InvoiceItemPayload = {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  amount: number;
};

export type SaveInvoicePayload = {
  id?: number;
  invoice_number: string;
  date: string;
  due_date: string | null;
  subject: string;
  client_id: number | null;
  client_name: string;
  company_bank_account_id: number | null;
  notes: string;
  subtotal: number;
  tax_8: number;
  tax_10: number;
  total: number;
  items: InvoiceItemPayload[];
};

export async function saveInvoice(payload: SaveInvoicePayload): Promise<void> {
  await requireAdmin();
  const { id, items, ...invoice } = payload;
  const supabase = await createClient();

  if (id) {
    const { error } = await supabase.from("invoices_issued").update(invoice).eq("id", id);
    if (error) throw new Error(error.message);

    const { error: deleteError } = await supabase.from("invoice_items").delete().eq("invoice_id", id);
    if (deleteError) throw new Error(deleteError.message);

    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(items.map((it) => ({ ...it, invoice_id: id })));
      if (itemsError) throw new Error(itemsError.message);
    }
  } else {
    const { data, error } = await supabase
      .from("invoices_issued")
      .insert({ ...invoice, dencho_saved_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(items.map((it) => ({ ...it, invoice_id: data.id })));
      if (itemsError) throw new Error(itemsError.message);
    }
  }

  revalidatePath("/invoices/issue");
}

export async function deleteInvoiceAction(id: number): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  await supabase.from("invoice_items").delete().eq("invoice_id", id);
  const { error } = await supabase.from("invoices_issued").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/invoices/issue");
}

export async function updateInvoiceStatusAction(
  id: number,
  status: InvoiceStatus,
  paidDate: string | null
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices_issued")
    .update({ status, paid_date: paidDate })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/invoices/issue");
}

export async function getInvoiceItemsAction(invoiceId: number): Promise<InvoiceItem[]> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("id");
  if (error) throw new Error(error.message);

  return data ?? [];
}
