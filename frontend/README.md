# 京都TECH学園祭アプリ（フロントエンド）

学園祭の来場者がブース、呼び出し番号、イベント、お知らせ、校内マップを確認し、店舗側が受付番号・会計・待ち時間を管理するためのWebアプリです。
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
| `/` | ホーム | ヒーロー動画、待ち時間が短いブース、クイックメニュー |
| `/attractions` | ブース待ち時間 | ブース一覧、詳細、マップリンク |
| `/restaurants` | 注文・呼び出し番号 | 現状は注文画面。今後カミングスーンまたは呼び出し番号確認へ変更予定 |
| `/restaurants/cart` | カート確認 | 今後削除または無効化予定 |
| `/restaurants/status` | 番号表示 | 今後呼び出し番号確認へ整理予定 |
| `/map` | 校内マップ | フロア画像、ブースピン、ブース詳細リンク |
| `/events` | イベント・お知らせ | 今後追加予定 |
| その他 | 404 | NotFound |

### 店舗向け（`/store/*`：認証ガードあり）

| パス | 画面 |
| --- | --- |
| `/store/login` | 店舗ログイン |
| `/store/register` | 店舗登録（今後は管理画面側へ移行予定） |
| `/store` | レジ（会計／受付番号発行） |
| `/store/dashboard` | ダッシュボード |
| `/store/waiting` | 待ち人数管理（±1） |
| `/store/ticket` | 受付番号の呼び出し・提供完了・大きく表示 |
| `/store/served` | 提供済み履歴 |
| `/store/profile` | 店舗情報表示・編集 |
| `/admin` | 管理画面（今後追加予定） |
| `/monitor` | 校内モニター向け呼び出し番号一覧（今後追加予定） |

## データについて

来場者向けのブース、ホームおすすめ、校内マップはバックエンド API から取得します。
店舗ログイン、ログアウト、ダッシュボード、会計メニュー、会計注文、清算 API もバックエンド接続済みです。
一部の店舗画面状態は `localStorage`（キー `kt_festival_state_v1`）に残っています。
モバイルオーダーと予約システムは今後なくし、カミングスーンまたは呼び出し番号確認へ変更します。

## テーマ

- ヘッダー右上のボタンでライト／ダークを切替（`localStorage('theme')` に保存）
- 初回は OS の `prefers-color-scheme` に追随
- 配色定義は `src/styles/theme.css`（CSS変数 ＋ `@theme`）

## 静的アセット

ホームのヒーロー動画は `public/hero.mp4` を参照します。
校内マップは `public/campus-map-1f.png` 〜 `public/campus-map-8f.png` を参照します。
