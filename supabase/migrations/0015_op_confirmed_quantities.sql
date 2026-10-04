-- ダッシュボードの有効件数（確定件数）をOPごとに持てるようにする。
-- これまでは案件（または料金表の行）の確定件数を全OPで共有していたため、
-- 同じ案件を複数のOPが獲得していると、どのOPの行にも同じ値が表示・更新されていた。
--
-- 案件一覧の確定件数は「全OP分の合計」として扱う。ダッシュボードでOPごとの値を
-- 更新したとき、その案件（料金表の行）の確定件数を、OPごとの値の合計に自動で揃える。

create table if not exists public.op_confirmed_quantities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  rate_id uuid references public.price_rates (id) on delete cascade,
  staff_id uuid not null references public.profiles (id) on delete cascade,
  confirmed_quantity integer not null default 0 check (confirmed_quantity >= 0),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_op_confirmed_quantities_target
  on public.op_confirmed_quantities (
    project_id,
    coalesce(rate_id, '00000000-0000-0000-0000-000000000000'::uuid),
    staff_id
  );

alter table public.op_confirmed_quantities enable row level security;

drop policy if exists "op_confirmed_quantities_select_authenticated" on public.op_confirmed_quantities;
create policy "op_confirmed_quantities_select_authenticated" on public.op_confirmed_quantities
  for select to authenticated using (true);

grant select on public.op_confirmed_quantities to authenticated;

-- OPごとの有効件数を更新し、案件一覧側の確定件数を合計に揃える（管理者のみ）。
create or replace function public.set_op_confirmed_quantity(
  p_project_id uuid,
  p_rate_id uuid,
  p_staff_id uuid,
  p_quantity integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '管理者のみ更新できます';
  end if;

  if p_quantity is null or p_quantity < 0 then
    raise exception '件数は0以上で入力してください';
  end if;

  update public.op_confirmed_quantities
    set confirmed_quantity = p_quantity,
        updated_at = now()
    where project_id = p_project_id
      and rate_id is not distinct from p_rate_id
      and staff_id = p_staff_id;

  if not found then
    insert into public.op_confirmed_quantities (project_id, rate_id, staff_id, confirmed_quantity)
    values (p_project_id, p_rate_id, p_staff_id, p_quantity);
  end if;

  if p_rate_id is not null then
    update public.price_rates
      set confirmed_quantity = coalesce((
        select sum(confirmed_quantity) from public.op_confirmed_quantities where rate_id = p_rate_id
      ), 0)
      where id = p_rate_id and project_id = p_project_id;
  else
    update public.projects
      set confirmed_quantity = coalesce((
        select sum(confirmed_quantity)
          from public.op_confirmed_quantities
          where project_id = p_project_id and rate_id is null
      ), 0)
      where id = p_project_id;
  end if;
end;
$$;

grant execute on function public.set_op_confirmed_quantity(uuid, uuid, uuid, integer) to authenticated;
