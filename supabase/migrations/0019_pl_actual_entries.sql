-- =========================================
-- 0019: PLの「結果」を手入力できるように
--   pl_actual_entries：結果の手入力値（月×行）。計画の pl_plan_entries と同じ形。
--   手入力した月は自動計算（売上・メンバー・経費・取引先請求）より優先され、空欄の月は自動計算のまま。
--   既存データは変更しません（新しいテーブルと関数を追加するだけ）。
-- =========================================
create table if not exists public.pl_actual_entries (
  id uuid primary key default gen_random_uuid(),
  plan_month date not null,
  section text not null check (section in ('sales', 'labor', 'outsource', 'sga')),
  line_label text not null,
  amount numeric(14, 0) not null default 0,
  sort_order integer not null default 0,
  unique (plan_month, section, line_label)
);

create index if not exists idx_pl_actual_entries_month on public.pl_actual_entries (plan_month);

alter table public.pl_actual_entries enable row level security;

drop policy if exists "pl_actual_entries_all_admin" on public.pl_actual_entries;
create policy "pl_actual_entries_all_admin" on public.pl_actual_entries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.pl_actual_entries to authenticated;

-- 結果の一括保存：指定期間の手入力値を丸ごと入れ替える（1トランザクション）
create or replace function public.save_pl_actual(p_from date, p_to date, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '管理者のみ保存できます';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception '結果データの形式が不正です';
  end if;

  delete from public.pl_actual_entries where plan_month >= p_from and plan_month <= p_to;

  insert into public.pl_actual_entries (plan_month, section, line_label, amount, sort_order)
  select x.plan_month, x.section, x.line_label, x.amount, coalesce(x.sort_order, 0)
  from jsonb_to_recordset(p_rows) as x(
    plan_month date,
    section text,
    line_label text,
    amount numeric,
    sort_order integer
  )
  where x.plan_month >= p_from and x.plan_month <= p_to
    and coalesce(trim(x.line_label), '') <> '';
end;
$$;

revoke all on function public.save_pl_actual(date, date, jsonb) from public;
grant execute on function public.save_pl_actual(date, date, jsonb) to authenticated;

notify pgrst, 'reload schema';
