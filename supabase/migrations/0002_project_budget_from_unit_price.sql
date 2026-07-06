-- 予算（目標売上）を「単価 × 件数」から自動算出するように変更する。
-- 実績（actual）は従来通り手入力・随時更新のまま。

alter table public.projects
  add column unit_price numeric(14, 0) not null default 0,
  add column quantity integer not null default 0;

alter table public.projects
  drop column budget;

alter table public.projects
  add column budget numeric(14, 0) generated always as (unit_price * quantity) stored;
