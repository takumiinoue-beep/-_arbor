-- =========================================
-- 0030: 有効件数を「月 × 案件 × 単価」の合計で入力できるようにする
--   confirmed_totals：ダッシュボード上部の表で、案件×単価ごとに有効件数（全OPの合計）を入力する。
--   OPごとの有効件数は、獲得件数の比率で自動で按分する。確定金額＝有効件数×単価。
--   閲覧は全員、編集は管理者のみ。既存データは変更しません（新しいテーブルを追加するだけ。
--   0028 の confirmed_quantities は使わなくなりますが、そのまま残します）。
-- =========================================
create table if not exists public.confirmed_totals (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  project_name text not null,
  unit_price integer not null,
  quantity numeric(10, 2) not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (month, project_name, unit_price)
);

create index if not exists idx_confirmed_totals_month on public.confirmed_totals (month);

alter table public.confirmed_totals enable row level security;

drop policy if exists "confirmed_totals_select_authenticated" on public.confirmed_totals;
create policy "confirmed_totals_select_authenticated" on public.confirmed_totals
  for select to authenticated using (true);

drop policy if exists "confirmed_totals_write_admin" on public.confirmed_totals;
create policy "confirmed_totals_write_admin" on public.confirmed_totals
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.confirmed_totals to authenticated;

notify pgrst, 'reload schema';
