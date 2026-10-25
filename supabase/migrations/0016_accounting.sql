-- 会計機能（月次PL・メンバー人件費・経費・取引先請求・計画）
-- すべて管理者のみが閲覧・操作できる。既存テーブルは変更しない。

-- =========================================
-- members（メンバー：人件費・インセンティブの元データ）
--   kind: labor_existing=直雇用(既存) / labor_new=直雇用(新人) / outsource=業務委託
--         executive=役員報酬 / salary=給料手当(販管費)
--   monthly_cost: 月額の人件費・報酬（start_month〜end_monthの各月に計上）
--   incentive: 売上 incentive_sales_unit 円ごとに incentive_amount 円
--   profile_id: 紐づくログインアカウント(OP)。紐づけるとそのOPの売上でインセンを計算
-- =========================================
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('labor_existing', 'labor_new', 'outsource', 'executive', 'salary')),
  profile_id uuid references public.profiles (id) on delete set null,
  monthly_cost numeric(14, 0) not null default 0 check (monthly_cost >= 0),
  monthly_social_insurance numeric(14, 0) not null default 0 check (monthly_social_insurance >= 0),
  incentive_sales_unit numeric(14, 0) check (incentive_sales_unit is null or incentive_sales_unit > 0),
  incentive_amount numeric(14, 0) check (incentive_amount is null or incentive_amount >= 0),
  start_month date not null,
  end_month date,
  notes text,
  created_at timestamptz not null default now()
);

-- =========================================
-- expenses（経費：勘定科目ごとの月次実績）
-- =========================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_month date not null,
  account text not null,
  amount numeric(14, 0) not null check (amount >= 0),
  description text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_month on public.expenses (expense_month);

-- =========================================
-- vendor_invoices（取引先からの請求：仕入・外注費など）
-- =========================================
create table if not exists public.vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id bigint references public.clients (id) on delete set null,
  vendor_name text,
  invoice_date date not null,
  subtotal numeric(14, 0) not null check (subtotal >= 0),
  tax numeric(14, 0) not null default 0 check (tax >= 0),
  account text not null default '外注費',
  description text,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  paid_date date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_vendor_invoices_date on public.vendor_invoices (invoice_date);

-- =========================================
-- pl_plan_entries（PLの計画値：月×行）
--   section: sales=売上 / labor=原価(労務費) / outsource=原価(外注費) / sga=販売管理費
-- =========================================
create table if not exists public.pl_plan_entries (
  id uuid primary key default gen_random_uuid(),
  plan_month date not null,
  section text not null check (section in ('sales', 'labor', 'outsource', 'sga')),
  line_label text not null,
  amount numeric(14, 0) not null default 0,
  sort_order integer not null default 0,
  unique (plan_month, section, line_label)
);

create index if not exists idx_pl_plan_entries_month on public.pl_plan_entries (plan_month);

-- =========================================
-- RLS：すべて管理者のみ
-- =========================================
alter table public.members enable row level security;
alter table public.expenses enable row level security;
alter table public.vendor_invoices enable row level security;
alter table public.pl_plan_entries enable row level security;

drop policy if exists "members_all_admin" on public.members;
create policy "members_all_admin" on public.members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "expenses_all_admin" on public.expenses;
create policy "expenses_all_admin" on public.expenses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "vendor_invoices_all_admin" on public.vendor_invoices;
create policy "vendor_invoices_all_admin" on public.vendor_invoices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pl_plan_entries_all_admin" on public.pl_plan_entries;
create policy "pl_plan_entries_all_admin" on public.pl_plan_entries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.vendor_invoices to authenticated;
grant select, insert, update, delete on public.pl_plan_entries to authenticated;

-- =========================================
-- 計画の一括保存：指定期間の計画を丸ごと入れ替える（1トランザクション）
--   p_rows: [{plan_month, section, line_label, amount, sort_order}, ...]
-- =========================================
create or replace function public.save_pl_plan(p_from date, p_to date, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '管理者のみ保存できます';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception '計画データの形式が不正です';
  end if;

  delete from public.pl_plan_entries where plan_month >= p_from and plan_month <= p_to;

  insert into public.pl_plan_entries (plan_month, section, line_label, amount, sort_order)
  select x.plan_month, x.section, x.line_label, x.amount, coalesce(x.sort_order, 0)
  from jsonb_to_recordset(p_rows) as x(
    plan_month date,
    section text,
    line_label text,
    amount numeric,
    sort_order integer
  )
  where x.plan_month >= p_from and x.plan_month <= p_to
    and coalesce(trim(x.line_label), '') <> '';
end;
$$;

grant execute on function public.save_pl_plan(date, date, jsonb) to authenticated;
