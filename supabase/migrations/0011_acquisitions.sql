-- 案件獲得ログ機能
-- 「今日どの商材（＝既存案件）を何件獲得したか」を日付単位で記録する、
-- 予算・実績とは別の単純な集計用ログ。役職・従業員数を選ぶと、その案件の
-- 料金表（あれば）から単価を自動決定する。

create table if not exists public.acquisitions (
  id uuid primary key default gen_random_uuid(),
  acquired_date date not null,
  project_id uuid not null references public.projects (id) on delete cascade,
  position text,
  employee_count integer,
  unit_price numeric(14, 0) not null,
  amount numeric(14, 0) not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.acquisitions enable row level security;

-- 閲覧は全員可能（デイリー集計をダッシュボードで見るため）
create policy "acquisitions_select_authenticated" on public.acquisitions
  for select to authenticated using (true);

-- 登録は誰でも可能。ただし自分自身をcreated_byとして記録する行のみ
create policy "acquisitions_insert_authenticated" on public.acquisitions
  for insert to authenticated with check (auth.uid() = created_by);

-- 削除は管理者のみ（誤登録の削除用）
create policy "acquisitions_delete_admin" on public.acquisitions
  for delete to authenticated using (public.is_admin());

create index if not exists idx_acquisitions_acquired_date on public.acquisitions (acquired_date);
create index if not exists idx_acquisitions_project_id on public.acquisitions (project_id);

grant select, insert, delete on public.acquisitions to authenticated;
