-- =========================================
-- 0026: 案件一覧をシンプルに（案件名・料金表・デフォルト単価・有効率・ステータス）
--   projects.effective_rate：案件ごとの標準の有効率（%）。案件設定・ダッシュボードの有効件数／有効金額の計算に使う。
--   既存データは変更しません（列を追加するだけ。予算・実績・確定件数の列も消さずに残します）。
-- =========================================
alter table public.projects
  add column if not exists effective_rate numeric(5, 2) not null default 100
    check (effective_rate >= 0 and effective_rate <= 100);

-- 案件は月ごとに作らなくなるため、開始日は入力不要（未指定なら登録日）
alter table public.projects
  alter column start_date set default current_date;

notify pgrst, 'reload schema';
