-- 案件獲得ログに「OP」（担当者＝profiles）を追加する。
-- OPは実際にログイン操作した人（created_by）とは別に、その獲得の
-- 成果を計上する担当者を表す（管理者が他のOPの分をまとめて登録できるため）。

alter table public.acquisitions
  add column if not exists staff_id uuid references public.profiles (id);

-- 既存データがある場合は登録者本人をOPとみなして埋める
update public.acquisitions set staff_id = created_by where staff_id is null;

alter table public.acquisitions
  alter column staff_id set not null;

create index if not exists idx_acquisitions_staff_id on public.acquisitions (staff_id);

-- 1回の登録で複数の案件（商材）をまとめて登録できるようにする、
-- バッチ版のRPC。日付・OPは共通、案件ごとの行をjsonbの配列で受け取る。
-- 1件でも失敗したら全体をロールバックする（一部だけ登録される不整合を防ぐ）。
create or replace function public.create_acquisitions_batch(
  p_acquired_date date,
  p_staff_id uuid,
  p_created_by uuid,
  p_rows jsonb
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
  v_result public.acquisitions;
begin
  if p_created_by is distinct from auth.uid() then
    raise exception '不正なリクエストです';
  end if;

  if p_staff_id is null then
    raise exception 'OPを選択してください';
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
      acquired_date, project_id, rate_id, position, employee_count, unit_price, quantity, amount,
      staff_id, created_by
    ) values (
      p_acquired_date, v_project_id, v_rate_id, v_position, v_employee_count, v_unit_price, v_quantity,
      v_unit_price * v_quantity, p_staff_id, p_created_by
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

grant execute on function public.create_acquisitions_batch(date, uuid, uuid, jsonb) to authenticated;
