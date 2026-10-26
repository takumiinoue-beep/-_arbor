-- =========================================
-- 0023: 新しい月の案件を登録したとき、その月に計上する獲得（来月のアポなど）を自動でつなげる
--   案件は月ごとに作られるため、来月の案件がまだ無い間に登録した「来月計上の獲得」は、
--   直近の（前月までの）同名の案件に紐づいている。
--   新しい案件を登録（保存）したとき、同名の前の案件に紐づく「その月に計上する獲得」を、新しい案件へ付け替え、
--   実績件数もそれに合わせて移す。
--   料金表のある案件は、役職と従業員数の区分が一致する行へ付け替える。対応する行が無い獲得は付け替えない。
--   既存データは、この関数を実行したときだけ変更されます。
-- =========================================
create or replace function public.link_acquisitions_to_project(p_project_id uuid)
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
  if not public.is_admin() then
    raise exception '管理者のみ実行できます';
  end if;

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

grant execute on function public.link_acquisitions_to_project(uuid) to authenticated;

notify pgrst, 'reload schema';
