-- =========================================
-- 0025: 案件設定（月ごとに、メンバー×案件の目標件数と有効率を設定する）
--   project_assignments：月 × メンバー(担当者) × 案件 ごとの件数・有効率・メモ。
--   閲覧は全員、編集は管理者のみ。既存データは変更しません（新しいテーブルと関数を追加するだけ）。
-- =========================================
create table if not exists public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  staff_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  target_quantity integer not null default 0 check (target_quantity >= 0),
  effective_rate numeric(5, 2) not null default 100 check (effective_rate >= 0 and effective_rate <= 100),
  memo text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (month, staff_id, project_id)
);

create index if not exists idx_project_assignments_month on public.project_assignments (month);

alter table public.project_assignments enable row level security;

drop policy if exists "project_assignments_select_authenticated" on public.project_assignments;
create policy "project_assignments_select_authenticated" on public.project_assignments
  for select to authenticated using (true);

drop policy if exists "project_assignments_write_admin" on public.project_assignments;
create policy "project_assignments_write_admin" on public.project_assignments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.project_assignments to authenticated;

-- 月の案件設定を丸ごと入れ替える（1トランザクション）
--   p_rows: [{staff_id, project_id, target_quantity, effective_rate, memo, sort_order}, ...]
create or replace function public.save_project_assignments(p_month date, p_rows jsonb)
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
    raise exception '案件設定のデータの形式が不正です';
  end if;

  delete from public.project_assignments where month = p_month;

  insert into public.project_assignments (month, staff_id, project_id, target_quantity, effective_rate, memo, sort_order)
  select p_month, x.staff_id, x.project_id, coalesce(x.target_quantity, 0), coalesce(x.effective_rate, 100),
         nullif(x.memo, ''), coalesce(x.sort_order, 0)
  from jsonb_to_recordset(p_rows) as x(
    staff_id uuid,
    project_id uuid,
    target_quantity integer,
    effective_rate numeric,
    memo text,
    sort_order integer
  )
  where x.staff_id is not null and x.project_id is not null;
end;
$$;

grant execute on function public.save_project_assignments(date, jsonb) to authenticated;

notify pgrst, 'reload schema';
