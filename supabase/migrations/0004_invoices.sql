-- 請求書発行機能
-- 取引先・自社情報・自社銀行口座・請求書・請求書明細。
-- この機能一式は管理者のみが閲覧・操作できる（一般権限者はアクセス不可）。

-- =========================================
-- clients（取引先）
-- =========================================
create table if not exists public.clients (
  id bigserial primary key,
  name text not null,
  type text not null default 'customer' check (type in ('customer', 'supplier', 'other')),
  address text,
  postal_code text,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;

create policy "clients_all_admin" on public.clients
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =========================================
-- company_bank_accounts（自社銀行口座）
-- =========================================
create table if not exists public.company_bank_accounts (
  id bigserial primary key,
  bank_name text not null,
  bank_branch text,
  account_type text,
  account_number text,
  account_holder text,
  created_at timestamptz not null default now()
);

alter table public.company_bank_accounts enable row level security;

create policy "company_bank_accounts_all_admin" on public.company_bank_accounts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =========================================
-- company_settings（自社情報。基本的に1行のみ運用）
-- =========================================
create table if not exists public.company_settings (
  id bigserial primary key,
  company_name text,
  representative text,
  address text,
  invoice_number text,
  created_at timestamptz not null default now()
);

alter table public.company_settings enable row level security;

create policy "company_settings_all_admin" on public.company_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =========================================
-- invoices_issued（請求書）
-- =========================================
create table if not exists public.invoices_issued (
  id bigserial primary key,
  invoice_number text,
  date date,
  due_date date,
  subject text,
  client_id bigint references public.clients (id),
  client_name text,
  company_bank_account_id bigint references public.company_bank_accounts (id),
  bank_account_id bigint,
  subtotal numeric(14, 0) default 0,
  tax_8 numeric(14, 0) default 0,
  tax_10 numeric(14, 0) default 0,
  total numeric(14, 0) default 0,
  notes text,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  is_deleted boolean not null default false,
  dencho_saved_at timestamptz,
  journal_id bigint,
  paid_date date,
  created_at timestamptz not null default now()
);

alter table public.invoices_issued enable row level security;

create policy "invoices_issued_all_admin" on public.invoices_issued
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =========================================
-- invoice_items（請求書明細）
-- =========================================
create table if not exists public.invoice_items (
  id bigserial primary key,
  invoice_id bigint not null references public.invoices_issued (id) on delete cascade,
  description text,
  quantity numeric(14, 2),
  unit_price numeric(14, 0),
  tax_rate numeric(4, 2),
  amount numeric(14, 0),
  unit text,
  created_at timestamptz not null default now()
);

alter table public.invoice_items enable row level security;

create policy "invoice_items_all_admin" on public.invoice_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create index if not exists idx_invoices_issued_date on public.invoices_issued (date);
create index if not exists idx_invoices_issued_client_id on public.invoices_issued (client_id);
create index if not exists idx_invoice_items_invoice_id on public.invoice_items (invoice_id);

-- Data API 用の明示的なGRANT（Automatically expose new tablesをOFFにしている前提）
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.company_bank_accounts to authenticated;
grant select, insert, update, delete on public.company_settings to authenticated;
grant select, insert, update, delete on public.invoices_issued to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;
grant usage, select on all sequences in schema public to authenticated;
