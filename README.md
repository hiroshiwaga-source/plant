# plant

植物管理アプリ（Expo + TypeScript + Supabase）。セキュリティ設計はリポジトリ直下の `SECURITY.md` / `THREAT_MODEL.md` などを参照してください。

### 対象の幅（プロダクト）

**盆栽やビカクシダ（コウモリラン）など趣味・嗜好が強い植物**から、**一般の観葉植物**まで、幅広いユーザーと植物を想定します。品種名や世話の粒度はユーザー任せの自由記述・ログでカバーし、特定ジャンルにUIを寄せすぎない方針です。

ログイン後は **植物の一覧・追加・編集・削除**、**水やり／肥料／剪定／植え替えの記録**（任意メモ・相対日時表示つき）が利用できます。写真・AI 診断は DB / Edge 準備済みで UI は今後の拡張です。

### 機能の洗い出し（ユーザー目線・プロ目線）

| 区分 | 内容 |
|------|------|
| **今回反映した** | 世話ログに**任意メモ**（液肥倍率・剪定部位など）。履歴の**相対日時**（今日・昨日・N日前）。**ログアウト確認**。主要操作の **VoiceOver 用ラベル**。`console.warn` は **開発時のみ**（本番ノイズ削減）。 |
| **追加を検討（未実装）** | **写真**（メタ先行 + Storage）。**AI 診断・今日のおすすめ**（Edge 接続 UI）。**過去日時の世話**（いまは記録時刻＝現在）。**検索・タグ・置き場所**。オフライン下書き。病害虫・薬剤の**構造化フィールド**（`meta` 拡張 or 別テーブル）。盆栽向け**テンプレート**（改作・針金など任意プリセット）。 |
| **見送り・避けたい** | 特定ジャンル専用に固定化した UI 文言（多様な利用者と矛盾）。本番で環境未設定の **console だらけ**（`__DEV__` に限定済み）。 |

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

### メール確認リンクで「サイトにアクセスできない」場合

スマホのメールアプリから開くと、確認後の **リダイレクト先**（Supabase の **Site URL** や `emailRedirectTo`）が **`localhost` や PC 内だけの URL** だと、端末側で到達できずエラーになります。

1. **Supabase Dashboard** → **Authentication** → **URL Configuration**
   - **Site URL** を、スマホのブラウザから開ける **`https://...` の公開 URL** にする（`localhost` のままにしない）。
   - **Redirect URLs** に、次のいずれかを追加する（複数可）。
     - アプリのディープリンク: `plant://auth/callback`（本リポジトリの `app.json` の `scheme` に合わせています）。
     - 開発中は Expo が返す URL も必要なことがあります。未設定なら `getAuthEmailRedirectTo()` と同じ文字列を一度ログに出すか、README の `.env.example` の **`EXPO_PUBLIC_AUTH_EMAIL_REDIRECT_URL`** で **静的な成功ページ**（GitHub Pages / Vercel など）を指定すると確実です。その URL も **Redirect URLs** に含めてください。
2. アプリは `signUp` 時に **`emailRedirectTo`** を送るようになっています。メール内のリンクを踏んだあと **アプリに戻る**と、トークンを読み取ってログイン状態にします（`App.tsx` の `Linking` リスナー）。

変更後は **Expo を再起動**し、必要なら **新規に確認メールを送り直す**と反映されます。

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
