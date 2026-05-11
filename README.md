# plant

植物管理アプリ（Expo + TypeScript + Supabase）。セキュリティ設計はリポジトリ直下の `SECURITY.md` / `THREAT_MODEL.md` などを参照してください。

## 開発

```bash
cp .env.example .env
# .env には EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY のみ推奨
# （Expo が .env を読み込むため、service_role を同じファイルに置かない方が安全です）

npm install
npx expo start
# babel.config.js を追加・変更したあとは一度: npx expo start --clear
```

メールでの **ログイン／登録を短時間に何度も**試すと、Supabase 側で **レート制限**がかかります。しばらく待つか、ダッシュボード **Authentication** の設定（メール確認の有無など）を確認してください。

### 結合テスト用のシークレット（任意）

`SUPABASE_SERVICE_ROLE_KEY` は **`.env.test.local`** にだけ書く（Git 対象外）。`npm run test:integration` は `.env` のあと `.env.test.local` を読みます。中身の例:

```bash
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=（Legacy の service_role JWT）
```

## Supabase

- SQL マイグレーション: `supabase/migrations/`
- ローカル: [Supabase CLI](https://supabase.com/docs/guides/cli) と Docker で `supabase start` → `supabase db reset`（または `db push`）
- Edge Functions: `supabase/functions/ai-diagnose`, `care-recommendations`（シークレットはダッシュボード / `supabase secrets` のみ）

### 写真アップロード順序

1. `plant_photos` にメタデータ行を挿入する（`storage_path` は `user_id/plant_id/photo_id` 形式で、トリガーが整合性を検証）
2. 同じパスで Storage `plant-photos` へアップロードする（Storage ポリシーがメタデータ行の存在を要求）

## テスト

```bash
npm test
# RLS 結合テスト（.env に SUPABASE_URL / SUPABASE_ANON_KEY）
npm run test:integration
```

`signUp` が **email rate limit** になる場合は、**`.env.test.local`** に **`SUPABASE_SERVICE_ROLE_KEY`** を足す（ダッシュボード → Legacy **service_role**）。テストが Admin API でユーザーを作り、終了時に削除します。同じキーを `.env` に置くと Expo 起動時に Metro プロセスへ載るため避けてください。

結合テストは `SUPABASE_URL` / `SUPABASE_ANON_KEY` が無い場合スキップされます。
