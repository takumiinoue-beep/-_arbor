# 案件・売上管理システム

案件ごとの担当者・予算（目標売上）・実績（実際の売上）を一元管理し、一覧表とグラフで可視化する社内システムです。

## 技術スタック

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase（Postgres + Auth: メール/パスワード）
- Recharts（グラフ）
- Vercel（ホスティング）

## 機能

- 担当者マスタ管理（ログインアカウント兼用、管理者のみ登録・編集・削除可、自社情報画面内で管理）
- 案件管理（案件名・担当者・期間・予算・実績・ステータス・備考の登録／編集／削除、管理者のみ）
- 実績の随時更新（担当者は自分の担当案件のみ、管理者は全案件、更新履歴を自動記録）
- 予算・実績の一覧表示（検索・絞り込み・合計集計）
- ダッシュボード（全体サマリ・粗利・担当者別集計・グラフを1ページに集約、期間タブで連動絞り込み）
- 請求書発行（請求書番号自動生成、明細入力、リアルタイムプレビュー、ブラウザ印刷によるPDF出力、発行済一覧、入金ステータス管理、インボイス制度対応）
- 会計（月次PLの計画と結果の並列表示、メンバー人件費・インセンティブ、経費、取引先からの請求、計画入力。事業年度は9月始まり、管理者のみ）
- 取引先マスタ・自社情報（会社情報・自社銀行口座・担当者管理）管理

## 権限

- **管理者**：担当者・案件・請求書関連（取引先／自社情報／請求書発行）の全操作（登録／編集／削除）が可能
- **担当者**：全案件の予算・実績を閲覧可能。実績の入力・更新は自分が担当する案件のみ可能。請求書関連機能へはアクセス不可

## セットアップ手順

### 1. Supabaseプロジェクトを作成

1. [supabase.com](https://supabase.com) でプロジェクトを新規作成
   - プロジェクト作成時の「Data API」設定は次の通りにする
     - **Enable Data API**: ON（必須）
     - **Automatically expose new tables**: OFF（推奨。マイグレーションSQL側で`authenticated`ロールに明示的にGRANTしているため、OFFのままで問題なく動作する）
     - **Enable automatic RLS**: ON（保険。今回のテーブルはマイグレーションSQL内で個別にRLSを有効化済み）
2. 「Project Settings」→「API」から以下を控える
   - Project URL
   - `anon` `public` key
   - `service_role` key（**絶対にブラウザ側コードや公開リポジトリに含めないこと**）

### 2. スキーマを適用

Supabaseダッシュボードの「SQL Editor」で、`supabase/migrations/` 配下のSQLを**番号順に**実行してください。
（`supabase` CLIをリンク済みであれば `supabase db push` でも可）

| ファイル | 内容 |
|---|---|
| [`0001_init.sql`](supabase/migrations/0001_init.sql) | `profiles`（担当者マスタ兼ログインユーザー）／`projects`（案件）／`actual_logs`（実績更新履歴）／`fixed_costs`（固定費）とRLS、実績更新用RPC `update_project_actual` |
| [`0002_project_budget_from_unit_price.sql`](supabase/migrations/0002_project_budget_from_unit_price.sql) | 予算（目標売上）を単価×件数の自動計算に変更 |
| [`0003_actual_from_quantity.sql`](supabase/migrations/0003_actual_from_quantity.sql) | 実績を単価×実績件数の自動計算に変更、RPC更新 |
| [`0004_invoices.sql`](supabase/migrations/0004_invoices.sql) | 請求書発行機能（`clients`／`company_bank_accounts`／`company_settings`／`invoices_issued`／`invoice_items`）とRLS（管理者のみ） |
| [`0005`〜`0014`](supabase/migrations/) | 料金表（案件ごと）・確定件数・案件獲得ログ・自社情報の郵便番号/建物名など（ファイル名の番号順に実行） |
| [`0015_op_confirmed_quantities.sql`](supabase/migrations/0015_op_confirmed_quantities.sql) | 有効件数をOPごとに保持（`op_confirmed_quantities`）、RPC `set_op_confirmed_quantity` |
| [`0016_accounting.sql`](supabase/migrations/0016_accounting.sql) | 会計機能：`members`（人件費・インセンティブ設定）／`expenses`（経費）／`vendor_invoices`（取引先請求）／`pl_plan_entries`（PL計画）とRLS（管理者のみ）、RPC `save_pl_plan` |
| [`0017_member_incentive_tiers.sql`](supabase/migrations/0017_member_incentive_tiers.sql) | メンバーのインセンティブを売上の段階ごとの金額表（`incentive_tiers`）に変更。既存の「◯円ごとに◯円」設定は20段階に展開して引き継ぐ |
| [`0018_expense_period.sql`](supabase/migrations/0018_expense_period.sql) | 経費に期間（単月／開始月〜終了月／継続）を設定できるように（`end_month`・`ongoing`）。既存の経費は単月のまま |
| [`0019_pl_actual_entries.sql`](supabase/migrations/0019_pl_actual_entries.sql) | PLの結果を手入力できるように（`pl_actual_entries`、RPC `save_pl_actual`）。手入力した月は自動計算より優先 |
| [`0020_profile_fk_set_null.sql`](supabase/migrations/0020_profile_fk_set_null.sql) | 担当者を削除できるように。登録者・更新者として参照している列は、削除時に空欄(null)にする |
| [`0021_acquisition_target_month.sql`](supabase/migrations/0021_acquisition_target_month.sql) | 案件獲得に計上月（`target_month`）を追加。来月のアポを今月のうちに登録して、来月のページ・PLに載せられる |
| [`0022_acquisitions_batch_per_row.sql`](supabase/migrations/0022_acquisitions_batch_per_row.sql) | 案件獲得の登録を、行ごとにOP・計上月を指定できるように（複数OPのまとめ登録） |
| [`0023_link_acquisitions_to_project.sql`](supabase/migrations/0023_link_acquisitions_to_project.sql) | 新しい月の案件を登録・更新したとき、その月に計上する獲得（来月のアポなど）を同名の前の案件から付け替える（RPC `link_acquisitions_to_project`） |
| [`0024_carry_over_projects.sql`](supabase/migrations/0024_carry_over_projects.sql) | 続く案件を毎月の案件として自動で作る（`carry_over_project` / `carry_over_projects`）。案件獲得の登録時に計上月の案件が無ければ自動作成。0023を含むので、この1本で動く |
| [`0025_project_assignments.sql`](supabase/migrations/0025_project_assignments.sql) | 案件設定（月×メンバー×案件の目標件数・有効率）：`project_assignments`、RPC `save_project_assignments` |
| [`0026_project_effective_rate.sql`](supabase/migrations/0026_project_effective_rate.sql) | 案件一覧を「案件名・料金表・デフォルト単価・有効率・ステータス」だけに簡素化。`projects.effective_rate`（案件の標準の有効率）を追加。既存データは消さない |
| [`0027_profile_member_no.sql`](supabase/migrations/0027_profile_member_no.sql) | メンバー番号：`profiles.member_no`（既存メンバーには登録順に番号を振る）。案件設定は番号の小さい順に並ぶ |
| [`0028_confirmed_quantities.sql`](supabase/migrations/0028_confirmed_quantities.sql) | 有効件数：`confirmed_quantities`（月×OP×案件×単価ごとに、ダッシュボードで手入力する。確定金額＝有効件数×単価） |

### 3. 環境変数を設定

`.env.local.example` を `.env.local` にコピーし、値を埋めてください。

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 4. 最初の管理者アカウントを作成

このアプリには初期ユーザーが存在しないため、最初の1人だけは手動で作成します。

1. Supabaseダッシュボードの「Authentication」→「Users」→「Add user」でメールアドレスとパスワードを設定して作成
   （「Auto Confirm User」を有効にしてください）
2. 作成されると `profiles` テーブルに自動で行が追加されます（役割は初期値 `staff`）
3. 「Table Editor」→ `profiles` テーブルで、そのユーザーの `role` を `admin` に変更

以降の担当者アカウントは、アプリにログイン後「自社情報」画面内の「担当者管理」から管理者が発行できます。

### 5. ローカルで起動

```bash
npm install
npm run dev
```

http://localhost:3000 にアクセスし、作成した管理者アカウントでログインしてください。

### 6. Vercelへデプロイ

1. このリポジトリをGitHubにpush
2. Vercelで「Import Project」から対象リポジトリを選択
3. 環境変数（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`）をVercelのプロジェクト設定に登録
4. デプロイ

## 今後の検討事項（要件定義書より）

- 既存Excel等からのデータ移行（今回は対象外）
- 予算未達アラート等の通知機能（今回は対象外）
- スマートフォン・タブレット対応のレイアウト最適化
