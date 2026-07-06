-- 実績（実際の売上）を「単価 × 実績件数」から自動算出するように変更する。
-- 担当者・管理者は実績件数のみを入力し、金額は単価（projects.unit_price）から自動計算される。

alter table public.projects
  add column actual_quantity integer not null default 0;

alter table public.projects
  drop column actual;

alter table public.projects
  add column actual numeric(14, 0) generated always as (unit_price * actual_quantity) stored;

-- RPC関数を「実績件数」を受け取る形に更新する
drop function if exists public.update_project_actual(uuid, numeric);

create or replace function public.update_project_actual(p_project_id uuid, p_new_quantity integer)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_old_actual numeric(14, 0);
begin
  if p_new_quantity < 0 then
    raise exception '件数は0以上で入力してください';
  end if;

  select * into v_project from public.projects where id = p_project_id;

  if v_project is null then
    raise exception '案件が見つかりません';
  end if;

  if not public.is_admin() and v_project.staff_id <> auth.uid() then
    raise exception '自分が担当する案件の実績のみ更新できます';
  end if;

  v_old_actual := v_project.actual;

  update public.projects
    set actual_quantity = p_new_quantity,
        updated_by = auth.uid()
    where id = p_project_id
    returning * into v_project;

  insert into public.actual_logs (project_id, old_value, new_value, changed_by)
  values (p_project_id, v_old_actual, v_project.actual, auth.uid());

  return v_project;
end;
$$;

grant execute on function public.update_project_actual(uuid, integer) to authenticated;
