-- 料金表を「全案件共通」から「案件ごと」に変更する。
-- 例：「リンクアンドモチベーション」案件専用の役職×従業員数→単価の表、というように
-- 案件ごとに別々の料金表を持つ。

-- 直前のマイグレーションで作った全体共通データは意味が変わるため削除する
delete from public.price_rates;

alter table public.price_rates
  add column project_id uuid references public.projects (id) on delete cascade;

alter table public.price_rates
  alter column project_id set not null;

create index if not exists idx_price_rates_project_id on public.price_rates (project_id);
