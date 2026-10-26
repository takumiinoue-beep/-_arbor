-- =========================================
-- 0024: 続く案件を毎月の案件として自動で作る（引き継ぎ）
--   ・carry_over_project：既存の案件を指定した月の案件としてコピーする（料金表も。実績・確定件数は0から）。
--       すでにその月の同名の案件があれば、それを返す。案件獲得の登録時に、計上月の案件がまだ無ければ自動で使う。
--   ・carry_over_projects：進行中の案件を、まとめて指定した月へ引き継ぐ（管理者のみ）。
--   引き継いだ案件には、同名の前の案件に紐づいている「その月に計上する獲得（来月のアポなど）」を付け替える。
--   0023 を実行していなくても、この1本で動きます。既存データは、これらの関数を使ったときだけ変更されます。
-- =========================================

-- 獲得の付け替え本体（権限チェックなし。他の関数から呼ぶ）
create or replace function public.link_acquisitions_internal(p_project_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proj record;
  v_month date;
  v_acq record;
  v_new_rate uuid;
  v_moved integer := 0;
begin
  select id, name, start_date into v_proj from public.projects where id = p_project_id;
  if not found then
    return 0;
  end if;

  v_month := date_trunc('month', v_proj.start_date)::date;

  for v_acq in
    select a.*
    from public.acquisitions a
    join public.projects op on op.id = a.project_id
    where op.name = v_proj.name
      and op.id <> p_project_id
      and date_trunc('month', op.start_date)::date < v_month
      and date_trunc('month', coalesce(a.target_month, a.acquired_date))::date = v_month
    for update of a
  loop
    v_new_rate := null;

    if v_acq.rate_id is not null then
      -- 同じ役職で、従業員数の区分が同じ（無ければ従業員数が当てはまる）新しい料金表の行を探す
      select nr.id into v_new_rate
      from public.price_rates old_r
      join public.price_rates nr on nr.project_id = p_project_id and nr.position = old_r.position
      where old_r.id = v_acq.rate_id
        and (
          (nr.employee_min = old_r.employee_min and nr.employee_max is not distinct from old_r.employee_max)
          or (
            v_acq.employee_count is not null
            and v_acq.employee_count >= nr.employee_min
            and (nr.employee_max is null or v_acq.employee_count <= nr.employee_max)
          )
        )
      order by (nr.employee_min = old_r.employee_min and nr.employee_max is not distinct from old_r.employee_max) desc,
               nr.sort_order
      limit 1;

      if v_new_rate is null then
        continue;
      end if;
    elsif exists (select 1 from public.price_rates where project_id = p_project_id) then
      -- 元は料金表なし、新しい案件は料金表あり：単価の対応が決められないので付け替えない
      continue;
    end if;

    -- 実績件数を元の案件から減らし、新しい案件へ加える
    if v_acq.rate_id is not null then
      update public.price_rates
        set actual_quantity = greatest(0, actual_quantity - v_acq.quantity)
        where id = v_acq.rate_id;
      update public.price_rates
        set actual_quantity = actual_quantity + v_acq.quantity
        where id = v_new_rate;
    else
      update public.projects
        set actual_quantity = greatest(0, actual_quantity - v_acq.quantity)
        where id = v_acq.project_id;
      update public.projects
        set actual_quantity = actual_quantity + v_acq.quantity
        where id = p_project_id;
    end if;

    update public.acquisitions
      set project_id = p_project_id, rate_id = v_new_rate
      where id = v_acq.id;

    v_moved := v_moved + 1;
  end loop;

  return v_moved;
end;
$$;

revoke all on function public.link_acquisitions_internal(uuid) from public;

-- 管理者が直接呼ぶ版（0023と同じ名前・同じ動き）
create or replace function public.link_acquisitions_to_project(p_project_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;
  return public.link_acquisitions_internal(p_project_id);
end;
$$;

grant execute on function public.link_acquisitions_to_project(uuid) to authenticated;

-- 案件を指定した月の案件としてコピーする
create or replace function public.carry_over_project(p_source_id uuid, p_month date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.projects%rowtype;
  v_month date;
  v_new uuid;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  select * into v_src from public.projects where id = p_source_id;
  if not found then
    raise exception '引き継ぎ元の案件が見つかりません';
  end if;

  v_month := date_trunc('month', p_month)::date;

  -- すでにその月の同名の案件があれば、それを使う
  select id into v_new
  from public.projects
  where name = v_src.name and date_trunc('month', start_date)::date = v_month
  order by created_at
  limit 1;
  if v_new is not null then
    return v_new;
  end if;

  if v_src.status <> '進行中' then
    raise exception '進行中の案件のみ引き継げます';
  end if;
  if date_trunc('month', v_src.start_date)::date >= v_month then
    raise exception '引き継ぎ先の月は、元の案件より後の月にしてください';
  end if;

  insert into public.projects (
    name, staff_id, start_date, end_date, unit_price, quantity, actual_quantity, confirmed_quantity,
    status, notes, client_position, client_employee_count
  ) values (
    v_src.name, v_src.staff_id, v_month,
    case when v_src.end_date is null then null else (v_month + interval '1 month - 1 day')::date end,
    v_src.unit_price, v_src.quantity, 0, 0,
    '進行中', v_src.notes, v_src.client_position, v_src.client_employee_count
  )
  returning id into v_new;

  insert into public.price_rates (
    project_id, position, employee_min, employee_max, unit_price, quantity, actual_quantity, confirmed_quantity, sort_order
  )
  select v_new, position, employee_min, employee_max, unit_price, quantity, 0, 0, sort_order
  from public.price_rates
  where project_id = p_source_id;

  -- 先に登録されていた「この月に計上する獲得」を新しい案件へ付け替える
  perform public.link_acquisitions_internal(v_new);

  return v_new;
end;
$$;

grant execute on function public.carry_over_project(uuid, date) to authenticated;

-- 進行中の案件を、まとめて指定した月へ引き継ぐ（作成した件数を返す）
create or replace function public.carry_over_projects(p_month date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date;
  v_src record;
  v_count integer := 0;
  v_before integer;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;

  v_month := date_trunc('month', p_month)::date;

  -- 案件名ごとに一番新しい案件が「進行中」で、まだその月以降の案件が無いものが対象
  for v_src in
    select l.id
    from (
      select distinct on (name) id, name, status, start_date, end_date
      from public.projects
      order by name, start_date desc, created_at desc
    ) l
    where l.status = '進行中'
      and date_trunc('month', l.start_date)::date < v_month
      and not (l.end_date is not null and date_trunc('month', l.end_date)::date >= v_month)
  loop
    select count(*) into v_before from public.projects;
    perform public.carry_over_project(v_src.id, v_month);
    if (select count(*) from public.projects) > v_before then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.carry_over_projects(date) to authenticated;

notify pgrst, 'reload schema';
