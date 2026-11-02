-- =========================================
-- 0033: 経費を「ある項目の○%」で計算して登録できるようにする
--   expenses.percent_base：もとにする項目（sales=売上 / cogs=原価（労務費・外注費）/ sga:科目名=販管費の科目）。空なら金額を直接入力。
--   expenses.percent_rate：その項目に対する割合（%）。
--   割合で登録した経費は、PLの各月で「項目の金額 × 割合」を自動計算して計上する（amount は 0）。
--   既存データは変更しません（列を追加するだけ。既存の経費は今までどおり金額を直接入力）。
-- =========================================
alter table public.expenses
  add column if not exists percent_base text,
  add column if not exists percent_rate numeric(7, 2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'expenses_percent_check' and conrelid = 'public.expenses'::regclass
  ) then
    alter table public.expenses
      add constraint expenses_percent_check
      check (
        (percent_base is null and percent_rate is null)
        or (percent_base is not null and percent_rate is not null and percent_rate > 0 and percent_rate <= 1000)
      );
  end if;
end $$;

notify pgrst, 'reload schema';
