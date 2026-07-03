# 案件・売上管理システム

案件ごとの担当者・予算（目標売上）・実績（実際の売上）・固定費を一元管理し、一覧表とグラフで可視化する社内システムです。

## 技術スタック

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase（Postgres + Auth: メール/パスワード）
- Recharts（グラフ）
- Vercel（ホスティング）

## 機能

- 担当者マスタ管理（ログインアカウント兼用、管理者のみ登録・編集・削除可）
- 案件管理（案件名・担当者・期間・予算・実績・ステータス・備考の登録／編集／削除、管理者のみ）
- 実績の随時更新（担当者は自分の担当案件のみ、管理者は全案件、更新履歴を自動記録）
- 予算・実績の一覧表示（検索・絞り込み・合計集計）
- ダッシュボード（全体サマリ・粗利・主要グラフ）
- 担当者別集計画面
- グラフ画面（担当者別・案件別・月別推移・実績構成比）
- 固定費管理（品目・金額・発生周期・合計自動集計）

## 権限

- **管理者**：担当者・案件・固定費の全操作（登録／編集／削除）が可能
- **担当者**：全案件の予算・実績を閲覧可能。実績の入力・更新は自分が担当する案件のみ可能

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

Supabaseダッシュボードの「SQL Editor」で [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) の内容を実行してください。
（`supabase` CLIをリンク済みであれば `supabase db push` でも可）

作成されるもの：
- `profiles`（担当者マスタ兼ログインユーザー）
- `projects`（案件）
- `actual_logs`（実績更新履歴）
- `fixed_costs`（固定費）
- RLS（Row Level Security）ポリシーと、実績更新用のRPC関数 `update_project_actual`

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

以降の担当者アカウントは、アプリにログイン後「担当者管理」画面から管理者が発行できます。

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

- 固定費の発生周期（毎月／毎年）を考慮した期間別の粗利算出の精緻化（現状は登録済み固定費の単純合計で算出）
- 既存Excel等からのデータ移行（今回は対象外）
- 予算未達アラート等の通知機能（今回は対象外）
- スマートフォン・タブレット対応のレイアウト最適化
