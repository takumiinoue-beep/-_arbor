-- =========================================
-- 0032: メンバーの月額交通費
--   members.monthly_transport：メンバーごとの月額の交通費。start_month〜end_month の各月に、
--   会計の販管費「旅費交通費」へ自動で計上する。既存データは変更しません（列を追加するだけ。既存は0円）。
-- =========================================
alter table public.members
  add column if not exists monthly_transport numeric(14, 0) not null default 0
  check (monthly_transport >= 0);

notify pgrst, 'reload schema';
