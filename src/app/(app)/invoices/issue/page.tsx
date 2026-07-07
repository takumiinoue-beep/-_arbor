import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, CompanyBankAccount, InvoiceIssued } from "@/types/database";
import { InvoiceIssueClient } from "./InvoiceIssueClient";

export default async function InvoiceIssuePage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: clients }, { data: bankAccounts }, { data: settingsRows }, { data: invoicesRaw }] =
    await Promise.all([
      supabase.from("clients").select("*").order("name"),
      supabase.from("company_bank_accounts").select("*").order("id"),
      supabase.from("company_settings").select("*").order("id").limit(1),
      supabase
        .from("invoices_issued")
        .select("*, clients(name)")
        .eq("is_deleted", false)
        .order("date", { ascending: false }),
    ]);

  const invoices = (invoicesRaw ?? []).map((row) => {
    const { clients: clientRelation, ...rest } = row as InvoiceIssued & { clients: { name: string } | null };
    return { ...rest, client_name: rest.client_name || clientRelation?.name || null };
  });

  return (
    <InvoiceIssueClient
      clients={(clients as Client[]) ?? []}
      companyBankAccounts={(bankAccounts as CompanyBankAccount[]) ?? []}
      company={settingsRows?.[0] ?? null}
      invoices={invoices}
    />
  );
}
