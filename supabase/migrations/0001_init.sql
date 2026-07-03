-- 案件・売上管理システム 初期スキーマ
-- profiles / projects / actual_logs / fixed_costs + RLS

create extension if not exists pgcrypto;

-- =========================================
-- profiles（担当者マスタ = ログインユーザー）
-- =========================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  position text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 現在ログイン中のユーザーが管理者かどうか
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 新規ユーザー作成時に profiles を自動生成（管理者が admin API 経由で
-- user_metadata に name / position / role を渡すことを想定）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, position, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.raw_user_meta_data ->> 'position',
    coalesce(new.raw_user_meta_data ->> 'role', 'staff')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ログイン済みユーザーは全担当者を閲覧可能（案件割当プルダウン・集計に必要）
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

-- 担当者の登録・編集・削除は管理者のみ
create policy "profiles_update_admin" on public.profiles
  for update to authenticated using (public.is_admin());

create policy "profiles_delete_admin" on public.profiles
  for delete to authenticated using (public.is_admin());

-- =========================================
-- projects（案件）
-- =========================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  staff_id uuid references public.profiles (id),
  start_date date not null,
  end_date date,
  budget numeric(14, 0) not null default 0,
  actual numeric(14, 0) not null default 0,
  status text not null default '進行中' check (status in ('進行中', '完了', '中止')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

alter table public.projects enable row level security;

-- 一覧・グラフ用に全員が全案件を閲覧可能
create policy "projects_select_authenticated" on public.projects
  for select to authenticated using (true);

-- 登録・削除・全項目編集は管理者のみ
create policy "projects_insert_admin" on public.projects
  for insert to authenticated with check (public.is_admin());

create policy "projects_update_admin" on public.projects
  for update to authenticated using (public.is_admin());

create policy "projects_delete_admin" on public.projects
  for delete to authenticated using (public.is_admin());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

-- =========================================
-- actual_logs（実績更新履歴）
-- =========================================
create table if not exists public.actual_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  old_value numeric(14, 0),
  new_value numeric(14, 0),
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);

alter table public.actual_logs enable row level security;

create policy "actual_logs_select_authenticated" on public.actual_logs
  for select to authenticated using (true);

-- =========================================
-- 実績更新用 RPC
-- 担当者は自分が担当する案件の実績のみ更新可能、管理者は全案件更新可能。
-- projects テーブルへの直接 UPDATE は管理者のみに絞り、担当者はこの関数経由に限定する。
-- =========================================
create or replace function public.update_project_actual(p_project_id uuid, p_new_actual numeric)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_old_value numeric(14, 0);
begin
  select * into v_project from public.projects where id = p_project_id;

  if v_project is null then
    raise exception '案件が見つかりません';
  end if;

  if not public.is_admin() and v_project.staff_id <> auth.uid() then
    raise exception '自分が担当する案件の実績のみ更新できます';
  end if;

  v_old_value := v_project.actual;

  update public.projects
    set actual = p_new_actual,
        updated_by = auth.uid()
    where id = p_project_id
    returning * into v_project;

  insert into public.actual_logs (project_id, old_value, new_value, changed_by)
  values (p_project_id, v_old_value, p_new_actual, auth.uid());

  return v_project;
end;
$$;

-- =========================================
-- fixed_costs（固定費）
-- =========================================
create table if not exists public.fixed_costs (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  amount numeric(14, 0) not null,
  period_type text not null check (period_type in ('毎月', '毎年', '単発')),
  target_month date not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.fixed_costs enable row level security;

create policy "fixed_costs_select_authenticated" on public.fixed_costs
  for select to authenticated using (true);

create policy "fixed_costs_insert_admin" on public.fixed_costs
  for insert to authenticated with check (public.is_admin());

create policy "fixed_costs_update_admin" on public.fixed_costs
  for update to authenticated using (public.is_admin());

create policy "fixed_costs_delete_admin" on public.fixed_costs
  for delete to authenticated using (public.is_admin());

create index if not exists idx_projects_staff_id on public.projects (staff_id);
create index if not exists idx_projects_start_date on public.projects (start_date);
create index if not exists idx_actual_logs_project_id on public.actual_logs (project_id);
create index if not exists idx_fixed_costs_target_month on public.fixed_costs (target_month);

-- =========================================
-- Data API 権限（GRANT）
-- 本システムはログイン必須（anon には一切公開しない）。
-- 「Automatically expose new tables」を無効化した Supabase プロジェクト向けに、
-- authenticated ロールへ明示的に権限を付与する。行単位の制御は上記の RLS が担う。
-- =========================================
grant usage on schema public to authenticated;

grant select, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select on public.actual_logs to authenticated;
grant select, insert, update, delete on public.fixed_costs to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.update_project_actual(uuid, numeric) to authenticated;

-- profiles への insert は auth.users 作成時のトリガー（security definer）経由のみのため
-- authenticated ロールへの insert 権限は付与しない。
