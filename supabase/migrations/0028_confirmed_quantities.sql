-- =========================================
-- 0028: 有効件数（ダッシュボードで、月 × OP × 案件 × 単価 ごとに手入力する）
--   confirmed_quantities：その単価の獲得のうち、有効と確定した件数。
--   確定金額＝有効件数×単価。閲覧は全員、編集は管理者のみ。
--   既存データは変更しません（新しいテーブルを追加するだけ）。
-- =========================================
create table if not exists public.confirmed_quantities (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  staff_id uuid not null references public.profiles (id) on delete cascade,
  project_name text not null,
  unit_price integer not null,
  quantity numeric(10, 2) not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (month, staff_id, project_name, unit_price)
);

create index if not exists idx_confirmed_quantities_month on public.confirmed_quantities (month);

alter table public.confirmed_quantities enable row level security;

drop policy if exists "confirmed_quantities_select_authenticated" on public.confirmed_quantities;
create policy "confirmed_quantities_select_authenticated" on public.confirmed_quantities
  for select to authenticated using (true);

drop policy if exists "confirmed_quantities_write_admin" on public.confirmed_quantities;
create policy "confirmed_quantities_write_admin" on public.confirmed_quantities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.confirmed_quantities to authenticated;

notify pgrst, 'reload schema';
