# plant

植物管理アプリ（Expo + TypeScript + Supabase）。セキュリティ設計はリポジトリ直下の `SECURITY.md` / `THREAT_MODEL.md` などを参照してください。

## 開発

```bash
cp .env.example .env
# .env に EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を設定（anon のみ。service_role は入れない）

npm install
npx expo start
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

`signUp` が **email rate limit** になる場合は、`.env` に **`SUPABASE_SERVICE_ROLE_KEY`** を足す（ダッシュボード → Settings → API の **service_role**。**Expo には絶対に入れない**）。テストが Admin API でユーザーを作り、終了時に削除します。

結合テストは `SUPABASE_URL` / `SUPABASE_ANON_KEY` が無い場合スキップされます。
