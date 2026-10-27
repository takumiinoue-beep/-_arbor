-- =========================================
-- 0027: メンバー番号（担当者管理で付ける番号。案件設定は番号の小さい順に並べる）
--   profiles.member_no：メンバー番号。既存のメンバーには登録順に 1, 2, 3… を振ります（あとから自由に変更できます）。
-- =========================================
alter table public.profiles
  add column if not exists member_no integer check (member_no is null or member_no > 0);

update public.profiles p
set member_no = r.n
from (
  select id, row_number() over (order by created_at, name) as n
  from public.profiles
  where member_no is null
) r
where p.id = r.id;

notify pgrst, 'reload schema';
