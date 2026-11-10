-- =========================================
-- 0035: 単価を税抜と税込に分ける
--   単価（unit_price）は税抜のまま。別に税込の単価（unit_price_incl）を持てるようにする。
--   案件のデフォルト単価・料金表・案件獲得の登録に、税込の単価の列を追加する（空のときは 税抜×1.1 として扱う）。
--   案件獲得の登録（create_acquisitions_batch）と、単価の反映（reprice_acquisitions）が、税込の単価も扱うようにする。
--   既存のデータは変更しません（列を追加し、関数を作り直すだけ。既存の税込の単価は空のまま）。
-- =========================================
alter table public.projects
  add column if not exists unit_price_incl numeric(14, 0) check (unit_price_incl is null or unit_price_incl >= 0);

alter table public.price_rates
  add column if not exists unit_price_incl numeric(14, 0) check (unit_price_incl is null or unit_price_incl >= 0);

alter table public.acquisitions
  add column if not exists unit_price_incl numeric(14, 0) check (unit_price_incl is null or unit_price_incl >= 0);

create or replace function public.create_acquisitions_batch(
  p_acquired_date date,
  p_staff_id uuid,
  p_created_by uuid,
  p_rows jsonb,
  p_target_month date default null
)
returns setof public.acquisitions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_project_id uuid;
  v_rate_id uuid;
  v_position text;
  v_employee_count integer;
  v_unit_price numeric;
  v_unit_price_incl numeric;
  v_quantity integer;
  v_staff_id uuid;
  v_target_month date;
  v_result public.acquisitions;
begin
  if p_created_by is distinct from auth.uid() then
    raise exception '不正なリクエストです';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception '案件を1件以上追加してください';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_project_id := nullif(v_row->>'project_id', '')::uuid;
    v_rate_id := nullif(v_row->>'rate_id', '')::uuid;
    v_position := nullif(v_row->>'position', '');
    v_employee_count := nullif(v_row->>'employee_count', '')::integer;
    v_unit_price := nullif(v_row->>'unit_price', '')::numeric;
    v_unit_price_incl := nullif(v_row->>'unit_price_incl', '')::numeric;
    v_quantity := nullif(v_row->>'quantity', '')::integer;
    v_staff_id := coalesce(nullif(v_row->>'staff_id', '')::uuid, p_staff_id);
    v_target_month := case
      when v_row ? 'target_month' then nullif(v_row->>'target_month', '')::date
      else p_target_month
    end;

    if v_staff_id is null then
      raise exception 'OPを選択してください';
    end if;
    if v_project_id is null then
      raise exception '案件を選択してください';
    end if;
    if v_quantity is null or v_quantity < 1 then
      raise exception '件数は1以上で入力してください';
    end if;
    if v_unit_price is null or v_unit_price <= 0 then
      raise exception '単価を決定できませんでした';
    end if;

    insert into public.acquisitions (
      acquired_date, target_month, project_id, rate_id, position, employee_count, unit_price, unit_price_incl, quantity, amount,
      staff_id, created_by
    ) values (
      p_acquired_date, v_target_month, v_project_id, v_rate_id, v_position, v_employee_count, v_unit_price,
      case when v_unit_price_incl > 0 then v_unit_price_incl else null end, v_quantity,
      v_unit_price * v_quantity, v_staff_id, p_created_by
    )
    returning * into v_result;

    if v_rate_id is not null then
      update public.price_rates
        set actual_quantity = actual_quantity + v_quantity
        where id = v_rate_id and project_id = v_project_id;
    else
      update public.projects
        set actual_quantity = actual_quantity + v_quantity
        where id = v_project_id;
    end if;

    return next v_result;
  end loop;

  return;
end;
$$;

grant execute on function public.create_acquisitions_batch(date, uuid, uuid, jsonb, date) to authenticated;

notify pgrst, 'reload schema';


-- 単価の反映：税込の単価も一緒に直す
--   p_updates: [{id, unit_price, unit_price_incl}]
create or replace function public.reprice_acquisitions(p_updates jsonb, p_moves jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;

  if p_updates is null or jsonb_typeof(p_updates) <> 'array'
     or p_moves is null or jsonb_typeof(p_moves) <> 'array' then
    raise exception 'データの形式が不正です';
  end if;

  update public.acquisitions a
    set unit_price = u.unit_price,
        unit_price_incl = case when u.unit_price_incl > 0 then u.unit_price_incl else null end,
        amount = u.unit_price * a.quantity
    from jsonb_to_recordset(p_updates) as u(id uuid, unit_price numeric, unit_price_incl numeric)
    where a.id = u.id and u.unit_price > 0;
  get diagnostics v_count = row_count;

  drop table if exists _moved_q;
  create temp table _moved_q on commit drop as
    with mv as (
      select * from jsonb_to_recordset(p_moves)
        as m(month date, staff_id uuid, project_name text, old_price integer, new_price integer)
      where old_price <> new_price
    ),
    del as (
      delete from public.confirmed_quantities c
        using mv
        where c.month = mv.month and c.staff_id = mv.staff_id
          and c.project_name = mv.project_name and c.unit_price = mv.old_price
        returning c.month, c.staff_id, c.project_name, mv.new_price as unit_price, c.quantity
    )
    select month, staff_id, project_name, unit_price, sum(quantity) as quantity
      from del group by month, staff_id, project_name, unit_price;

  insert into public.confirmed_quantities (month, staff_id, project_name, unit_price, quantity)
    select month, staff_id, project_name, unit_price, quantity from _moved_q
    on conflict (month, staff_id, project_name, unit_price)
    do update set quantity = public.confirmed_quantities.quantity + excluded.quantity, updated_at = now();

  drop table if exists _moved_t;
  create temp table _moved_t on commit drop as
    with mv as (
      select distinct month, project_name, old_price, new_price
        from jsonb_to_recordset(p_moves)
        as m(month date, staff_id uuid, project_name text, old_price integer, new_price integer)
        where old_price <> new_price
    ),
    del as (
      delete from public.confirmed_totals c
        using mv
        where c.month = mv.month and c.project_name = mv.project_name and c.unit_price = mv.old_price
        returning c.month, c.project_name, mv.new_price as unit_price, c.quantity
    )
    select month, project_name, unit_price, sum(quantity) as quantity
      from del group by month, project_name, unit_price;

  insert into public.confirmed_totals (month, project_name, unit_price, quantity)
    select month, project_name, unit_price, quantity from _moved_t
    on conflict (month, project_name, unit_price)
    do update set quantity = public.confirmed_totals.quantity + excluded.quantity, updated_at = now();

  return v_count;
end;
$$;

grant execute on function public.reprice_acquisitions(jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
