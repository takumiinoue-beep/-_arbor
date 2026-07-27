-- 案件獲得ログに件数を追加する。
-- 1回の登録で複数件をまとめて記録できるようにし、
-- 金額は単価×件数で保存する。

alter table public.acquisitions
  add column quantity integer not null default 1;
