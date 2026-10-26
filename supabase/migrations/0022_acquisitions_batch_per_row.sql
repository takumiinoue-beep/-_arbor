-- =========================================
-- 0022: 案件獲得の登録を、行ごとにOP・計上月を指定できるように
--   複数のOPの獲得を1回でまとめて登録し、来月のアポなどの計上月も案件ごとに指定できるようにする。
--   p_rows の各行に staff_id（OP）と target_month（"YYYY-MM-01" など）を持たせる。
--   行に無い場合は、従来の p_staff_id / p_target_month を使う（引数の形は変わりません）。
--   既存データは変更しません。
-- =========================================
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
      acquired_date, target_month, project_id, rate_id, position, employee_count, unit_price, quantity, amount,
      staff_id, created_by
    ) values (
      p_acquired_date, v_target_month, v_project_id, v_rate_id, v_position, v_employee_count, v_unit_price, v_quantity,
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
