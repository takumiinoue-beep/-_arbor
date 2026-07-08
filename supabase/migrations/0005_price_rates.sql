-- 料金表機能
-- 取引先担当者の役職 × 取引先企業の従業員数レンジ で単価が決まる料金マトリクス。
-- 案件登録時にここから単価を自動反映するために使う。管理者のみが閲覧・操作できる。

create table if not exists public.price_rates (
  id uuid primary key default gen_random_uuid(),
  position text not null,
  employee_min integer not null default 0,
  employee_max integer, -- null = 上限なし（〇〇人以上）
  unit_price numeric(14, 0) not null,
  created_at timestamptz not null default now()
);

alter table public.price_rates enable row level security;

create policy "price_rates_all_admin" on public.price_rates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create index if not exists idx_price_rates_position on public.price_rates (position);

grant select, insert, update, delete on public.price_rates to authenticated;

-- 案件に「取引先担当者の役職」「取引先企業の従業員数」を記録できるようにする
alter table public.projects
  add column if not exists client_position text,
  add column if not exists client_employee_count integer;
