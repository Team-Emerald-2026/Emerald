# 京都TECH学園祭 来場者向けアプリ（フロントエンド）

学園祭来場者向け・店舗向けのモバイルWeb UIです。来場者はブース、呼び出し番号、イベント、お知らせ、校内マップを確認し、店舗側は受付番号、待ち時間、会計、売上を管理します。

- 元デザイン（Figma）: https://www.figma.com/design/j3VT8gNDqnpmMIILQFN8z8/Tokyo-Disney-Resort-App

---

## 技術スタック

| 区分 | 内容 |
|------|------|
| フレームワーク | React 18（`peerDependencies`） |
| ビルド | Vite 6 |
| ルーティング | React Router 7（`createBrowserRouter`） |
| スタイル | Tailwind CSS 4（`@tailwindcss/vite`） |
| アイコン | lucide-react |
| UI部品 | Radix UI 系コンポーネント（`src/app/components/ui/` に多数。現状の主要画面では未使用のものも含む） |

---

## 起動方法

```bash
npm i
npm run dev
```

本番ビルド:

```bash
npm run build
```

---

## 静的アセット

`Home` のヒーローカードは **`/hero.mp4`** を参照します。
校内マップは `public/` 配下のフロア画像 **`/campus-map-1f.png` 〜 `/campus-map-8f.png`** を使用します。

Vite では `public/` 配下のファイルがルート `/` から配信されます。

---

## アプリ全体構成（シェル）

共通レイアウトは `src/app/components/Layout.tsx` です。

### ヘッダー

- 中央にタイトル文言: **「京都TECH学園祭」**
- **右上**: ライト / ダークテーマ切替ボタン
  - `document.documentElement` に `dark` クラスを付与・削除
  - 選択は `localStorage` キー `theme` に `light` / `dark` で保存
  - 初回: `localStorage` に値がなければ `prefers-color-scheme: dark` に追随

### フッター（固定ナビゲーション）

- 画面下部固定のタブナビ（現状4項目、今後5項目へ変更予定）
- ラベルとリンク先:
  - **ホーム** → `/`
  - **ブース** → `/attractions`
  - **注文** → `/restaurants`（現状はモバイルオーダー画面。今後は呼び出し番号確認またはカミングスーンに変更予定）
  - **マップ** → `/map`
- 今後追加予定:
  - **イベント** → `/events`（お知らせ・イベント情報）
- アクティブ判定: ホームは完全一致、その他はパス一致または `path/` で始まる子ルートもアクティブ

### メイン領域

- `Outlet` で子ルートを表示
- 下部ナビの高さ分、スクロール領域に `pb-20` を付与

### ダークモード時の見た目

主要画面の背景・カード・枠線・テキスト等に Tailwind の `dark:` バリアントを付与し、テーマ切替で視認性が変わるようにしています。テーマ変数は `src/styles/theme.css`（`.dark` 時の CSS 変数）と連動します。

---

## ルーティング一覧

定義ファイル: `src/app/routes.tsx`

| パス | コンポーネント | 説明 |
|------|----------------|------|
| `/` | `Home` | ホーム、ヒーロー動画、待ち時間が短いブースのおすすめ |
| `/attractions` | `Attractions` | ブース待ち時間一覧、詳細表示、マップリンク |
| `/restaurants` | `Restaurants` | 現状は注文画面。今後は呼び出し番号確認またはカミングスーンに変更予定 |
| `/restaurants/cart` | `Restaurants` | 現状のカート確認。今後削除または無効化予定 |
| `/restaurants/status` | `Restaurants` | 現状の注文番号表示。今後は呼び出し番号表示へ整理予定 |
| `/map` | `Map` | 校内マップ |
| `/store/login` | `StoreLogin` | 店舗ログイン |
| `/store/register` | `StoreRegister` | 店舗登録（今後ログイン画面からの導線は削除予定） |
| `/store` | `StorePos` | 店舗画面トップ（レジ） |
| `/store/dashboard` | `StoreDashboard` | 店舗ダッシュボード |
| `/store/waiting` | `StoreWaiting` | 待ち人数管理 |
| `/store/ticket` | `StoreTicket` | 受付番号の表示・呼び出し・提供完了 |
| `/store/served` | `StoreServed` | 提供済み履歴 |
| `/store/profile` | `StoreProfile` | 店舗情報表示・編集 |
| `/admin` | 未実装 | 管理画面。店舗作成、総収益、店舗編集・削除、分析・可視化を予定 |
| `/events` | 未実装 | イベント・お知らせ画面を予定 |
| `/monitor` | 未実装 | 校内モニター向け呼び出し番号一覧画面を予定 |
| 上記以外 | `NotFound` | 404 |

`restaurants` は現状 `restaurants/*` で同一コンポーネントをマウントし、URL サブパスで表示モードを切り替えています。ただし、今後モバイルオーダーと予約システムはなくし、カミングスーンまたは呼び出し番号確認画面に整理します。

---

## 画面別：実装されている機能

### 1. ホーム（`/`）— `src/app/components/Home.tsx`

- **ヒーローカード（1枚）**
  - タイトル: 「京都TECH学園祭」
  - 背景動画: `/hero.mp4`
  - グラデーションオーバーレイ（青〜紫）
  - カード全体クリックで **`/attractions`** へ遷移
- **待ち時間が短いブース**: バックエンド API から店舗・マップ情報を取得し、待ち時間が短い順におすすめ表示
- **クイックメニュー（3件）**
  - 本日の待ち時間 → `/attractions`
  - モバイルオーダー → `/restaurants`（今後呼び出し番号またはカミングスーンに変更予定）
  - マップ → `/map`
  - 各項目: アイコン色付きブロック、タイトル、説明文、右矢印

### 2. ブース待ち時間（`/attractions`）— `src/app/components/Attractions.tsx`

- ページタイトル: **「ブース待ち時間」**
- **カテゴリフィルタ（チップ）**: すべて / 体験 / フード / ステージ
- **一覧カード**
  - バックエンド API の店舗情報とマップ情報から、ブース名、場所、待ち時間を表示
  - 「人気」は現状、待ち人数または待ち時間から暫定判定。正式定義は今後決定
  - 詳細ボタンで同一画面内に詳細を展開
  - マップボタンで `/map?store=<store_id>` へ遷移
  - フードブースのみ現状の注文導線を表示
- **フッター注意書き**（青系ボックス）: 待ち時間更新の説明（文言はデモ用）

今後の変更:
- 注文対象外表示を削除する
- ブース詳細を、店舗名、説明、メニュー一覧、場所(マップリンク)、電子呼び出し番号、一人あたりの待ち時間で構成する
- 待ち時間が短いブースをクリックすると詳細が自動で開き、画面中央に表示されるようにする

### 3. 注文・呼び出し番号（`/restaurants` 配下）— `src/app/components/Restaurants.tsx`

共通ヘッダー:

- タイトル: 現状 **「モバイルオーダー」**
- サブナビ（`Link`）: **選ぶ** / **確認** / **番号**
- 今後、モバイルオーダーと予約システムはなくし、カミングスーンまたは呼び出し番号確認画面に変更する

#### 3-1. 現状の注文画面（`/restaurants`）

- 説明用の青系情報ボックス（注文の案内）
- **店舗カード**
  - バックエンド API の店舗情報を表示
  - 商品が未登録の店舗は準備中として表示
- **メニュー行**
  - 現状、来場者向けメニュー API との接続は限定的
  - 今後は注文機能を削除またはカミングスーンにするため、ブース詳細のメニュー一覧表示へ役割を移す
- **カートサマリー（固定バー）**（注文画面のみ、カートに1点以上あるとき）
  - 点数合計、金額合計
  - **「カートの中を確認」** → `/restaurants/cart` へ遷移
- ページ下部: モバイルオーダー説明（青系ボックス）

カート状態は `useState` のオブジェクト `{ [商品ID]: 数量 }` で保持。ページ遷移しても同一コンポーネント内のため状態は維持されます。

#### 3-2. カート確認（`/restaurants/cart`）

- 見出し: **「カートの中を確認」**
- カート空のとき: メッセージと **「注文画面に戻る」**（`/restaurants`）
- カートに商品があるとき:
  - 行ごとに商品名、店舗名、**数量の増減（+/-）**、行小計
  - **「削除」**（枠付きボタン）で当該商品をカートから削除
  - **合計**金額
  - **「戻る」**（注文画面）、**「注文を決定」**（`/restaurants/status`）

#### 3-3. 注文番号（`/restaurants/status`）

- **モバイルオーダー番号**を表示（会計確定時に店舗側で発行された最新番号）
- 受け取り案内の説明文

### 4. 校内マップ（`/map`）— `src/app/components/Map.tsx`

- バックエンド API の `map/facilities` から施設・ブース情報を取得する
- 1F〜8F の校内マップ画像を表示し、その上にブースピンを重ねる
- `store` または `facility` クエリで対象施設を選択できる
- 選択中のブースからブース詳細へ遷移できる

UI:

- 現状は階層・ブースタイプのフィルタトグルがある
- 今後、マップのフィルタは削除する
- 校内マップ画像に、施設ピンと選択中ブースの詳細カードを表示する
- ページ下部: 緑系情報ボックス（校内マップの案内）

### 5. 404（`*`）— `src/app/components/NotFound.tsx`

- メッセージ: ページが見つかりません
- **ホームに戻る**（`/`）、**マップを見る**（`/map`）

### 6. 店舗向け画面（`/store/*`）— `src/app/components/store/`

- **ログイン**（`/store/login`）
  - ログインID・パスワードでバックエンド認証し、店舗セッションを保持
  - 今後「初めての方は 新規登録」を削除し、`/admin` への導線を追加する
- **店舗登録**（`/store/register`）
  - 現状は店舗名、説明、ログインID、パスワードで新規登録できる
  - 今後、管理画面側の店舗作成へ移す予定
- **レジ**（`/store/pos`）
  - 商品を選択して会計確定、受付番号（C-101, Y-101... のようなブース別 prefix）を発行
  - 発行時に待ち人数を +1、提供待ち一覧へ追加
- **待ち人数管理**（`/store/waiting`）
  - `+1 / -1` で手動調整（連打時も反映される実装）
- **受付番号表示**（`/store/ticket`）
  - 「大きく表示」対象を一覧から選択
  - 各行で「呼び出し」→「提供完了」を操作
  - 「大きく表示」は見た目専用で、呼び出し状態とは独立
  - 提供待ちが0件のときは大きく表示番号を `---`（なし）表示
- **ダッシュボード**（`/store/dashboard`）
  - バックエンド API から店舗名、説明、待ち人数、待ち時間、営業状態を取得
  - 今後、総収益の表示を追加する
- **提供済み履歴**（`/store/served`）
  - 提供完了した受付番号と内容を時系列で確認
- **店舗情報**（`/store/profile`）
  - 店舗名、説明、営業状態を閲覧・編集する
  - 現状、ログイン情報の参照方法に不整合があるため修正予定

### 7. 今後追加する画面

- `/events`: イベント・お知らせ一覧
- `/admin`: 管理画面。新規店舗作成、総収益、店舗情報の閲覧・編集・削除、分析・可視化
- `/monitor`: 校内モニター向け呼び出し番号一覧

---

## その他のフロント資産

### `index.html`

- ドキュメントタイトル: **「京都TECH学園祭」**
- `#root` 高さ 100% 用の最小スタイル

### `src/app/components/ImageWithFallback.tsx`

- 画像読み込み中: グレーのパルスプレースホルダ
- 読み込み失敗: 「画像を読み込めません」表示

### `src/styles/`

- `index.css`: フォント・Tailwind・テーマの import
- `theme.css`: ライト/ダーク用 CSS 変数、`@custom-variant dark`（`.dark` 配下）
- Tailwind の `@layer base` で `body` に `bg-background` / `text-foreground` を適用

### `vite.config.ts`

- `@` → `src` エイリアス
- `figma:asset/...` → `src/assets` 解決用プラグイン（Figma 連携用）

---

## 現在の制約・今後の拡張

- 店舗ログイン、ログアウト、ダッシュボード、会計メニュー、会計注文、清算 API はバックエンド API（`/api/v1/booth/*`）に接続済みです。
- ただし、フロント側のレジ・待ち人数・受付番号・提供済み履歴の一部は引き続き `localStorage` ベースです。
- モバイルオーダーと予約システムは今後なくし、カミングスーンまたは呼び出し番号確認へ置き換えます。
- 複数端末でのリアルタイム同期（WebSocket 等）や本番運用向け監査機能は今後の拡張対象です。

---

## 主要ファイル対応表（実装機能の所在）

| 機能領域 | 主なファイル |
|----------|----------------|
| ルート定義 | `src/app/routes.tsx` |
| 共通シェル・テーマ・フッターナビ | `src/app/components/Layout.tsx` |
| ホーム | `src/app/components/Home.tsx` |
| ブース待ち | `src/app/components/Attractions.tsx` |
| 注文・呼び出し番号 | `src/app/components/Restaurants.tsx` |
| 店舗ログイン | `src/app/components/store/StoreLogin.tsx` |
| 店舗登録 | `src/app/components/store/StoreRegister.tsx` |
| 店舗レジ | `src/app/components/store/StorePos.tsx` |
| 店舗ダッシュボード | `src/app/components/store/StoreDashboard.tsx` |
| 店舗待ち人数管理 | `src/app/components/store/StoreWaiting.tsx` |
| 店舗受付番号表示 | `src/app/components/store/StoreTicket.tsx` |
| 提供済み履歴 | `src/app/components/store/StoreServed.tsx` |
| 店舗情報 | `src/app/components/store/StoreProfile.tsx` |
| 校内マップ | `src/app/components/Map.tsx` |
| スケルトン表示 | `src/app/components/Skeleton.tsx` |
| 404 | `src/app/components/NotFound.tsx` |
| 画像フォールバック | `src/app/components/ImageWithFallback.tsx` |
| エントリ | `src/main.tsx` |
| アプリルート | `src/app/App.tsx`（`RouterProvider`） |

---

## ライセンス・帰属

プロジェクトに `ATTRIBUTIONS.md` がある場合は、そちらも併せて参照してください。
