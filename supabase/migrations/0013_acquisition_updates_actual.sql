-- 案件獲得を登録した際、その件数をその案件（料金表の行がある場合はその行、
-- 無い場合は案件本体）の実績件数に加算する。ログの登録と実績の加算は
-- 1つの関数内でまとめて行い、一方だけ成功する不整合を防ぐ。
-- 案件獲得は担当者に関わらず誰でも登録できる機能のため、実績加算も
-- 担当者チェックを行わない（update_project_actual等の直接編集とは異なる）。
--
-- どの料金表の行に加算したかを記録しておき、削除時に正しく差し引けるように
-- rate_id列を追加する。

alter table public.acquisitions
  add column if not exists rate_id uuid references public.price_rates (id) on delete set null;

create or replace function public.create_acquisition(
  p_acquired_date date,
  p_project_id uuid,
  p_rate_id uuid,
  p_position text,
  p_employee_count integer,
  p_unit_price numeric,
  p_quantity integer,
  p_created_by uuid
)
returns public.acquisitions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.acquisitions;
begin
  if p_created_by is distinct from auth.uid() then
    raise exception '不正なリクエストです';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception '件数は1以上で入力してください';
  end if;

  if p_unit_price is null or p_unit_price <= 0 then
    raise exception '単価を決定できませんでした';
  end if;

  insert into public.acquisitions (
    acquired_date, project_id, rate_id, position, employee_count, unit_price, quantity, amount, created_by
  ) values (
    p_acquired_date, p_project_id, p_rate_id, p_position, p_employee_count, p_unit_price, p_quantity,
    p_unit_price * p_quantity, p_created_by
  )
  returning * into v_row;

  if p_rate_id is not null then
    update public.price_rates
      set actual_quantity = actual_quantity + p_quantity
      where id = p_rate_id and project_id = p_project_id;
  else
    update public.projects
      set actual_quantity = actual_quantity + p_quantity
      where id = p_project_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.create_acquisition(date, uuid, uuid, text, integer, numeric, integer, uuid) to authenticated;

-- 削除時は加算した実績件数を元に戻す（管理者のみ削除可、既存のRLSと同じ制約）
create or replace function public.delete_acquisition(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.acquisitions;
begin
  if not public.is_admin() then
    raise exception '管理者のみ削除できます';
  end if;

  select * into v_row from public.acquisitions where id = p_id;
  if v_row is null then
    raise exception '対象のデータが見つかりません';
  end if;

  delete from public.acquisitions where id = p_id;

  if v_row.rate_id is not null then
    update public.price_rates
      set actual_quantity = greatest(0, actual_quantity - v_row.quantity)
      where id = v_row.rate_id;
  else
    update public.projects
      set actual_quantity = greatest(0, actual_quantity - v_row.quantity)
      where id = v_row.project_id;
  end if;
end;
$$;

grant execute on function public.delete_acquisition(uuid) to authenticated;
