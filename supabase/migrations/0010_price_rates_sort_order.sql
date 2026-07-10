-- 料金表の行を役職名の並び替えではなく、登録した順に表示できるようにする。
-- created_atは同一INSERT文内では全行同じ値になり順序判定に使えないため、
-- 明示的な並び順カラムを追加する。

alter table public.price_rates
  add column sort_order integer not null default 0;

create index if not exists idx_price_rates_sort_order on public.price_rates (project_id, sort_order);
