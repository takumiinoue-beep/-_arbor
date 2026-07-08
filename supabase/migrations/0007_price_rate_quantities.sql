-- 料金表の行ごとに予算件数・実績件数を持てるようにする。
-- 案件本体の unit_price/quantity/actual_quantity は残すが（料金表の行が
-- 1つもない案件のフォールバック用）、料金表の行がある案件はその行の
-- 合計（単価×件数の総和）を予算・実績として優先する。
--
-- budget/actual はこれまで GENERATED カラム（案件本体の単価×件数のみ）
-- だったが、料金表の行の合計も考慮する必要があるため、通常カラム＋
-- トリガーでの自動再計算に切り替える。

alter table public.price_rates
  add column quantity integer not null default 0,
  add column actual_quantity integer not null default 0;

alter table public.projects
  drop column budget,
  drop column actual;

alter table public.projects
  add column budget numeric(14, 0) not null default 0,
  add column actual numeric(14, 0) not null default 0;

-- 指定した案件の budget/actual を再計算する。
-- 料金表の行が1つでもあればその合計、なければ案件本体の単価×件数を使う。
create or replace function public.recompute_project_totals(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate_count integer;
  v_budget numeric(14, 0);
  v_actual numeric(14, 0);
begin
  select count(*) into v_rate_count from public.price_rates where project_id = p_project_id;

  if v_rate_count > 0 then
    select coalesce(sum(unit_price * quantity), 0), coalesce(sum(unit_price * actual_quantity), 0)
      into v_budget, v_actual
      from public.price_rates
      where project_id = p_project_id;
  else
    select unit_price * quantity, unit_price * actual_quantity
      into v_budget, v_actual
      from public.projects
      where id = p_project_id;
  end if;

  update public.projects
    set budget = coalesce(v_budget, 0),
        actual = coalesce(v_actual, 0)
    where id = p_project_id;
end;
$$;

create or replace function public.price_rates_recompute_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_project_totals(old.project_id);
    return old;
  else
    perform public.recompute_project_totals(new.project_id);
    return new;
  end if;
end;
$$;

drop trigger if exists price_rates_after_change on public.price_rates;
create trigger price_rates_after_change
  after insert or update or delete on public.price_rates
  for each row execute procedure public.price_rates_recompute_trigger();

create or replace function public.projects_recompute_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_project_totals(new.id);
  return new;
end;
$$;

drop trigger if exists projects_after_upsert on public.projects;
create trigger projects_after_upsert
  after insert or update of unit_price, quantity, actual_quantity on public.projects
  for each row execute procedure public.projects_recompute_trigger();

-- 既存案件の budget/actual を現在のデータから計算し直す
do $$
declare
  v_project record;
begin
  for v_project in select id from public.projects loop
    perform public.recompute_project_totals(v_project.id);
  end loop;
end;
$$;

-- 料金表の行ごとの実績件数を更新するRPC。
-- 担当者は自分が担当する案件の行のみ、管理者は全案件更新可能。
create or replace function public.update_price_rate_actual(p_rate_id uuid, p_new_quantity integer)
returns public.price_rates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate public.price_rates;
  v_project public.projects;
  v_old_actual numeric(14, 0);
begin
  if p_new_quantity < 0 then
    raise exception '件数は0以上で入力してください';
  end if;

  select * into v_rate from public.price_rates where id = p_rate_id;
  if v_rate is null then
    raise exception '料金表の行が見つかりません';
  end if;

  select * into v_project from public.projects where id = v_rate.project_id;
  if not public.is_admin() and v_project.staff_id <> auth.uid() then
    raise exception '自分が担当する案件の実績のみ更新できます';
  end if;

  v_old_actual := v_project.actual;

  update public.price_rates
    set actual_quantity = p_new_quantity
    where id = p_rate_id
    returning * into v_rate;

  select * into v_project from public.projects where id = v_rate.project_id;

  insert into public.actual_logs (project_id, old_value, new_value, changed_by)
  values (v_rate.project_id, v_old_actual, v_project.actual, auth.uid());

  return v_rate;
end;
$$;

grant execute on function public.update_price_rate_actual(uuid, integer) to authenticated;
