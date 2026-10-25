-- インセンティブを「売上の段階ごとの金額表」で設定できるようにする。
--   incentive_tiers: [{"threshold": 800000, "amount": 50000}, ...]
--   月の売上が threshold 以上になった最も高い段階の amount を支給する。
--   段階ごとの金額は不規則でよい（例：80万円→5万円、90万円→8万円、100万円→12万円）。

alter table public.members
  add column if not exists incentive_tiers jsonb not null default '[]'::jsonb;

-- 既存の「売上X円ごとにY円」の設定は、20段階分の表に展開して引き継ぐ
update public.members m
set incentive_tiers = (
  select coalesce(
    jsonb_agg(
      jsonb_build_object('threshold', k * m.incentive_sales_unit, 'amount', k * m.incentive_amount)
      order by k
    ),
    '[]'::jsonb
  )
  from generate_series(1, 20) as k
)
where m.incentive_sales_unit is not null
  and m.incentive_amount is not null
  and m.incentive_tiers = '[]'::jsonb;

notify pgrst, 'reload schema';
