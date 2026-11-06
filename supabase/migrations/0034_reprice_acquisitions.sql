-- =========================================
-- 0034: 案件一覧で変えた単価を、登録済みの案件獲得に反映する（管理者のみ）
--   reprice_acquisitions(p_updates, p_moves)
--     p_updates: [{id, unit_price}]  … 案件獲得の単価を変え、金額を 単価×件数 に計算し直す
--     p_moves:   [{month, staff_id, project_name, old_price, new_price}]
--                … 単価が変わった行に入力済みの有効件数を、新しい単価の行に付け替える
--   どの獲得をどの単価にするかは、アプリ側で（案件一覧の最新の料金に合わせて）決める。
--   既存のテーブルは変更しません（関数を追加するだけ）。
-- =========================================
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
        amount = u.unit_price * a.quantity
    from jsonb_to_recordset(p_updates) as u(id uuid, unit_price numeric)
    where a.id = u.id and u.unit_price > 0;
  get diagnostics v_count = row_count;

  -- OPごとの有効件数（confirmed_quantities）を、新しい単価の行へ付け替える
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

  -- 以前に入力した合計（confirmed_totals）も同じように付け替える
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
