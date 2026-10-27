-- =========================================
-- 0029: 案件獲得の登録を、削除せずに修正できるようにする（管理者のみ）
--   獲得日・計上月・件数を直せる。金額は単価×件数で計算し直す。
--   既存のデータは変更しません（関数を追加するだけ）。
-- =========================================
create or replace function public.update_acquisition(
  p_id uuid,
  p_acquired_date date,
  p_target_month date,
  p_quantity integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.acquisitions;
begin
  if not public.is_admin() then
    raise exception '管理者のみ修正できます';
  end if;

  if p_acquired_date is null then
    raise exception '獲得日は必須です';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception '件数は1以上で入力してください';
  end if;

  select * into v_row from public.acquisitions where id = p_id for update;
  if v_row is null then
    raise exception '対象のデータが見つかりません';
  end if;

  update public.acquisitions
    set acquired_date = p_acquired_date,
        target_month = p_target_month,
        quantity = p_quantity,
        amount = v_row.unit_price * p_quantity
    where id = p_id;

  -- 削除時と同じく、案件（料金表）側の実績件数も、件数の増減分だけ合わせる
  if p_quantity <> v_row.quantity then
    if v_row.rate_id is not null then
      update public.price_rates
        set actual_quantity = greatest(0, actual_quantity + (p_quantity - v_row.quantity))
        where id = v_row.rate_id;
    else
      update public.projects
        set actual_quantity = greatest(0, actual_quantity + (p_quantity - v_row.quantity))
        where id = v_row.project_id;
    end if;
  end if;
end;
$$;

grant execute on function public.update_acquisition(uuid, date, date, integer) to authenticated;

notify pgrst, 'reload schema';
