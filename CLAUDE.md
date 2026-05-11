# plant — Claude 向けプロジェクトガイド

## 概要

**plant** は植物の登録・世話記録・写真・AI による状態の可能性提示（決めつけない）を扱うモバイルアプリです。**セキュリティとプライバシーを最優先**し、クライアントに AI 系 API キーや `service_role` を置かない方針です。

## 技術スタック

- **Expo（React Native）** + **TypeScript**
- **Supabase**（Auth / Postgres + RLS / Storage / Edge Functions）
- **サーバー側のみ**で LLM / 植物識別 API 等を呼ぶ（キーは Edge のシークレットのみ）

## 重要ドキュメント

- [SECURITY.md](./SECURITY.md) — シークレット・ログ方針
- [PRIVACY.md](./PRIVACY.md)
- [THREAT_MODEL.md](./THREAT_MODEL.md)
- [DATA_FLOW.md](./DATA_FLOW.md)
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) — スキーマ・RLS・Storage（実装は `supabase/migrations/` が正）

## ディレクトリ（目安）

```
plant/
├── App.tsx                 # エントリ UI（拡張予定）
├── src/
│   ├── lib/supabase.ts     # クライアント（anon + ユーザセッションのみ）
│   └── types/database.ts   # DB 型（手動同期）
├── supabase/
│   ├── migrations/
│   └── functions/          # Edge Functions（AI・おすすめ世話）
├── README.md
└── .env.example            # 実シークレットはコミットしない
```

## 絶対にやらないこと

- `EXPO_PUBLIC_*` にシークレットを入れる
- モバイルに `service_role` や OpenAI / Anthropic / Plant.id 等のキーを埋め込む
- 本番ログに JWT・署名付き URL・画像バイナリ・生プロンプトを残す

## エージェント向け

- 変更は依頼範囲に留め、RLS / Storage ポリシーを緩めない。
- 新テーブルは `user_id` + `auth.uid()` ポリシーを必須とする。
- ユーザー向け文言（日本語）と AI 出力は「可能性」の表現を維持する。
