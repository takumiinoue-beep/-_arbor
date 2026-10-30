import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
import { latestByName } from "@/lib/projects";
import { confirmedLines } from "@/lib/sales";
import { fetchConfirmedRows } from "@/lib/confirmed";
import type { Client, CompanyBankAccount, InvoiceIssued } from "@/types/database";
import { InvoiceIssueClient, type BillableItem } from "./InvoiceIssueClient";

export default async function InvoiceIssuePage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: clients }, { data: bankAccounts }, { data: settingsRows }, { data: invoicesRaw }, { data: projects }, confirmed, acquisitions] =
    await Promise.all([
      supabase.from("clients").select("*").order("name"),
      supabase.from("company_bank_accounts").select("*").order("id"),
      supabase.from("company_settings").select("*").order("id").limit(1),
      supabase
        .from("invoices_issued")
        .select("*, clients(name)")
        .eq("is_deleted", false)
        .order("date", { ascending: false }),
      supabase.from("projects").select("id, name, start_date, client_id"),
      fetchConfirmedRows(),
      fetchAllRows<{
        acquired_date: string;
        target_month: string | null;
        project_id: string;
        staff_id: string;
        quantity: number;
        unit_price: number;
      }>((from, to) =>
        supabase
          .from("acquisitions")
          .select("acquired_date, target_month, project_id, staff_id, quantity, unit_price")
          .order("acquired_date")
          .order("id")
          .range(from, to)
      ),
    ]);

  // 請求書の明細候補：計上月 × 案件 × 単価ごとの有効件数（ダッシュボードで入力した件数を、OPをまとめて合計）
  const nameById = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));
  // 案件の取引先（案件名ごとに、一番新しい案件の取引先）
  const clientIdByName = new Map(
    Array.from(
      latestByName((projects ?? []) as { name: string; start_date: string; client_id: number | null }[]),
      ([name, p]) => [name, p.client_id] as const
    )
  );
  const grouped = new Map<string, { month: string; name: string; unitPrice: number; qty: number }>();
  for (const l of confirmedLines({ acquisitions, nameById, confirmed })) {
    const key = `${l.month}|${l.projectName}|${l.unitPrice}`;
    const cur = grouped.get(key) ?? { month: l.month, name: l.projectName, unitPrice: l.unitPrice, qty: 0 };
    cur.qty += l.quantity;
    grouped.set(key, cur);
  }
  const billableItems: BillableItem[] = Array.from(grouped, ([id, g]) => ({ ...g, id, qty: Math.round(g.qty * 100) / 100 }))
    .filter((g) => g.qty > 0)
    .sort((a, b) => b.month.localeCompare(a.month) || a.name.localeCompare(b.name, "ja") || b.unitPrice - a.unitPrice)
    .map((g) => ({
      id: g.id,
      description: g.name,
      label: `${Number(g.month.slice(5, 7))}月 ${g.name}（有効 ${g.qty}件 × ¥${g.unitPrice.toLocaleString("ja-JP")}）`,
      unit_price: g.unitPrice,
      client_id: clientIdByName.get(g.name) ?? null,
      confirmed_quantity: g.qty,
      start_date: `${g.month}-01`,
    }));

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
      billableItems={billableItems}
    />
  );
}
