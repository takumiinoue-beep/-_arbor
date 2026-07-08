-- 実績件数のうち「確定」した件数を管理できるようにする。
-- 確定件数 ÷ 実績件数 で「有効率」を画面側で算出する（金額には影響しない、
-- 純粋な件数の指標のため generated column やトリガーは不要）。
-- 料金表の行がある案件は行ごとに、無い案件は案件本体に確定件数を持つ
-- （実績件数・予算件数と同じ考え方）。

alter table public.projects
  add column confirmed_quantity integer not null default 0;

alter table public.price_rates
  add column confirmed_quantity integer not null default 0;
