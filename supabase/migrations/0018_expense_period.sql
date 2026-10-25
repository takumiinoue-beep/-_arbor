-- 経費に期間を設定できるようにする。
--   expense_month: 開始月（これまで通り）
--   end_month    : 終了月（入力した場合、開始月〜終了月の毎月に amount を計上）
--   ongoing      : true なら終了未定（開始月以降、毎月計上し続ける）
--   end_month が空で ongoing も false なら、これまで通り開始月だけの単月経費。
-- 既存の経費は全て単月のままで、金額・月は変わらない。

alter table public.expenses
  add column if not exists end_month date,
  add column if not exists ongoing boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_period_check') then
    alter table public.expenses
      add constraint expenses_period_check check (end_month is null or end_month >= expense_month);
  end if;
end;
$$;

notify pgrst, 'reload schema';
