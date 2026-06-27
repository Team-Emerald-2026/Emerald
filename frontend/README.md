# 京都TECH学園祭アプリ（フロントエンド）

学園祭の来場者が、ブースを円滑に回れるようにするためのモバイルWebアプリです。
`docs/frontend.md` の仕様に基づき、React 18 + Vite 6 + React Router 7 + Tailwind CSS 4 で実装しています。

## 起動方法

```bash
npm i
npm run dev      # 開発サーバー
npm run build    # 本番ビルド
npm run preview  # ビルド結果の確認
npm run typecheck # 型チェック（任意）
```

## 画面構成

### 来場者向け（共通シェル：ヘッダー＋下部タブナビ）

| パス | 画面 | 内容 |
| --- | --- | --- |
| `/` | ホーム | ヒーローカード＋クイックメニュー（3件） |
| `/attractions` | ブース待ち時間 | カテゴリ（すべて/体験/フード/ステージ）で絞り込み、待ち時間バッジ |
| `/restaurants` | モバイルオーダー：注文 | 屋台ごとのメニュー、カート追加、固定カートバー |
| `/restaurants/cart` | カート確認 | 数量変更・削除・合計・注文を決定 |
| `/restaurants/status` | 注文番号 | 発行された受付番号を表示 |
| `/map` | 校内マップ | 階層／ブースタイプで絞り込み、階層別一覧 |
| その他 | 404 | NotFound |

### 店舗向け（`/store/*`：認証ガードあり）

| パス | 画面 |
| --- | --- |
| `/store/login` | 店舗ログイン（デモ：任意の店舗ID＋パスワード `festival`） |
| `/store` | レジ（会計／受付番号発行） |
| `/store/dashboard` | ダッシュボード |
| `/store/waiting` | 待ち人数管理（±1） |
| `/store/ticket` | 受付番号の呼び出し・提供完了・大きく表示 |
| `/store/served` | 提供済み履歴 |

## データについて

バックエンド未接続のため、注文（受付番号）・店舗セッション・待ち人数は `localStorage`
（キー `kt_festival_state_v1`）に保持します。`src/app/lib/festivalStore.ts` が単一の
データソースで、来場者の「注文を決定」で発行した受付番号を店舗側の各画面が共有します。
永続DB・WebSocket同期は今後の拡張対象です。

## テーマ

- ヘッダー右上のボタンでライト／ダークを切替（`localStorage('theme')` に保存）
- 初回は OS の `prefers-color-scheme` に追随
- 配色定義は `src/styles/theme.css`（CSS変数 ＋ `@theme`）

## 静的アセット

ホームのヒーロー画像は `public/93769-1-...-1000x690.png` を参照します。差し替える場合は
同じパスのファイルを置き換えてください。画像が読めない場合もグラデーションで表示は崩れません。
