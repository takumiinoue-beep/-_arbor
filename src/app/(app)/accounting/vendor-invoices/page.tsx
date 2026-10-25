import { createClient } from "@/lib/supabase/server";
import { fiscalRange } from "@/lib/accounting";
import type { Client, VendorInvoice } from "@/types/database";
import { FiscalYearNav } from "../FiscalYearNav";
import { resolveFiscalYear } from "../fy";
import { VendorInvoicesClient } from "./VendorInvoicesClient";

export default async function VendorInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const fy = resolveFiscalYear((await searchParams).fy);
  const { from, toExclusive } = fiscalRange(fy);
  const supabase = await createClient();

  const [{ data: invoices }, { data: clients }] = await Promise.all([
    supabase
      .from("vendor_invoices")
      .select("*, client:clients(name)")
      .gte("invoice_date", from)
      .lt("invoice_date", toExclusive)
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name, type").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <FiscalYearNav basePath="/accounting/vendor-invoices" fy={fy} />
      <VendorInvoicesClient
        key={fy}
        invoices={(invoices as (VendorInvoice & { client: { name: string } | null })[]) ?? []}
        clients={(clients as Pick<Client, "id" | "name" | "type">[]) ?? []}
        defaultDate={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
