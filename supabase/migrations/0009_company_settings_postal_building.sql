-- 自社情報に郵便番号・建物名を追加する。
-- 住所と建物名を分けて登録し、請求書では改行して表示する。

alter table public.company_settings
  add column postal_code text,
  add column building_name text;
