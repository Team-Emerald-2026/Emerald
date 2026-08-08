# 京都TECH学園祭 来場者向けアプリ（フロントエンド）

学園祭来場者向けのモバイルWeb UIです。元は Figma 由来の「東京ディズニーリゾート」デモをベースに、表示文言・校内マップ・注文フロー等を学園祭向けに変更しています。

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

## 静的アセット（トップ画像）

`Home` のヒーローカードは、画像 URL として **`/93769-1-633ff99f5178bc6f1cd15c375861655a-1000x690.png`** を参照しています。

Vite では `public/` 配下のファイルがルート `/` から配信されるため、**同名ファイルを `public/` に配置**すると表示されます。プロジェクト直下のみに置いている場合は、`public/` へコピーしてください。

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

- 画面下部固定のタブナビ（4項目）
- ラベルとリンク先:
  - **ホーム** → `/`
  - **ブース** → `/attractions`
  - **注文** → `/restaurants`（`/restaurants/*` の子パスでも「注文」タブをアクティブ表示）
  - **校内** → `/map`
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
| `/booth` | `Booth` | ブース待ち時間一覧 |
| `/booth` | `BoothDetails` | ブース詳細 |
| `/restaurants` | `Restaurants` | モバイルオーダー：注文画面 |
| `/restaurants/cart` | `Restaurants` | モバイルオーダー：カート確認 |
| `/restaurants/status` | `Restaurants` | モバイルオーダー：注文番号表示 |
| `/map` | `Map` | 校内マップ |
| `/store/login` | `StoreLogin` | 店舗ログイン |
| `/store` | `StorePos` | 店舗画面トップ（レジ） |
| `/store/dashboard` | `StoreDashboard` | 店舗ダッシュボード |
| `/store/ticket` | `StoreTicket` | 受付番号の表示・呼び出し・提供完了 |
| `/store/served` | `StoreServed` | 提供済み履歴 |
| `/store/dashboard` | `NewItem` | 商品追加 |
| `/store/No` | `Nomber` | 呼び出し番号表示 |
| 上記以外 | `NotFound` | 404 |

`restaurants` は `restaurants/*` で同一コンポーネントをマウントし、URL サブパスで表示モードを切り替えています。

---

## 画面別：実装されている機能

### 1. ホーム（`/`）— `src/app/components/Home.tsx`

- **ヒーローカード（1枚）**
  - タイトル: 「京都TECH学園祭」
  - サブタイトル: 「夢と魔法の王国」
  - 背景画像: 上記「静的アセット」のパス
  - グラデーションオーバーレイ（青〜紫）
  - カード全体クリックで **`/attractions`** へ遷移
- **画像表示**: `ImageWithFallback`（読み込み中プレースホルダ、失敗時メッセージ）
- **クイックメニュー（3件）**
  - 本日の待ち時間 → `/attractions`
  - モバイルオーダー → `/restaurants`
  - 校内マップ → `/map`
  - 各項目: アイコン色付きブロック、タイトル、説明文、右矢印

### 2. ブース待ち時間（`/attractions`）— `src/app/components/Attractions.tsx`

- ページタイトル: **「ブース待ち時間」**
- **カテゴリフィルタ（チップ）**: すべて / スリル / ファミリー / ショー  
  - 選択中は青背景・白文字、非選択は灰系（ダーク時は `dark:` で調整）
- **一覧カード（モックデータ）**
  - ブース名、エリア名、待ち分数（色分けバッジ: 緑〜赤系）
  - 身長制限がある項目のみ「身長制限」行を表示
  - 「ファストパス対応」「スリル系」等のタグ表示条件付き
- **フッター注意書き**（青系ボックス）: 待ち時間更新の説明（文言はデモ用）

※ 一覧に出る名称はコード上まだパーク由来のモック名が残っています（表示ロジック自体は「ブース」向け）。

### 3. モバイルオーダー（`/restaurants` 配下）— `src/app/components/Restaurants.tsx`

共通ヘッダー:

- タイトル: **「モバイルオーダー」**
- サブナビ（`Link`）: **注文画面** / **カート確認** / **注文番号**

#### 3-1. 注文画面（`/restaurants`）

- 説明用の青系情報ボックス（注文の案内）
- **店舗（モック）ごとのカード**
  - 店名、エリア、料理ジャンル、価格帯記号（`¥` の繰り返し）、「注文可能」バッジ
- **メニュー行ごと**
  - 商品名、説明、単価
  - **カートに追加**、または数量調整（`-` / 数量 / `+`）と小計
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

データ構造は **`campusMap` オブジェクト**に集約:

- `name`: マップタイトル（「京都TECH学園祭 校内マップ」）
- `floors`: 階層プルダウン用（すべて / 1F / 2F / 3F）
- `boothTypes`: ブースタイププルダウン用（すべて、体験、フード、物販、トイレ、案内、救護室、サポート）
- `facilities`: 各ブース（名前、タイプ、階、マップ上の相対座標 `x`/`y` パーセント）

UI:

- **フィルタ表示トグル**（初期は非表示）  
  「階層・ブースタイプを表示」⇔「フィルタを閉じる」
- 表示中は **階層**・**ブースタイプ** をそれぞれ `<select>` で選択
- **簡易マップ領域**（グラデーション背景）に、フィルタ後の施設をドット＋アイコンで配置
- **ブース一覧（階層表示）**: 選択階が「すべて」のときは 1F→2F→3F の見出しの下にグループ化してリスト表示
- 各行の **「詳細」** ボタン（現状は見た目のみ。モーダルや別ページへの遷移は未接続）
- ページ下部: 緑系情報ボックス（校内マップの案内）

### 5. 404（`*`）— `src/app/components/NotFound.tsx`

- メッセージ: ページが見つかりません
- **ホームに戻る**（`/`）、**マップを見る**（`/map`）

### 6. 店舗向け画面（`/store/*`）— `src/app/components/store/`

- **ログイン**（`/store/login`）
  - 店舗ID・パスワードで認証し、店舗セッションを保持
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
  - 待ち人数・大きく表示中番号・最新発行番号を確認
- **提供済み履歴**（`/store/served`）
  - 提供完了した受付番号と内容を時系列で確認

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

- 店舗ログイン（`/store/login`）と店舗ダッシュボード（`/store/dashboard`）はバックエンド API（`/api/v1/booth/*`）に接続済みです。
- ただし、レジ・待ち人数・受付番号・提供済み履歴は引き続き `localStorage` ベースで、永続DB連携は未実装です。
- 複数端末でのリアルタイム同期（WebSocket 等）や本番運用向け監査機能は今後の拡張対象です。

---

## 主要ファイル対応表（実装機能の所在）

| 機能領域 | 主なファイル |
|----------|----------------|
| ルート定義 | `src/app/routes.tsx` |
| 共通シェル・テーマ・フッターナビ | `src/app/components/Layout.tsx` |
| ホーム | `src/app/components/Home.tsx` |
| ブース待ち | `src/app/components/Attractions.tsx` |
| モバイルオーダー | `src/app/components/Restaurants.tsx` |
| 店舗ログイン | `src/app/components/store/StoreLogin.tsx` |
| 店舗レジ | `src/app/components/store/StorePos.tsx` |
| 店舗ダッシュボード | `src/app/components/store/StoreDashboard.tsx` |
| 店舗待ち人数管理 | `src/app/components/store/StoreWaiting.tsx` |
| 店舗受付番号表示 | `src/app/components/store/StoreTicket.tsx` |
| 提供済み履歴 | `src/app/components/store/StoreServed.tsx` |
| 校内マップ | `src/app/components/Map.tsx` |
| 404 | `src/app/components/NotFound.tsx` |
| 画像フォールバック | `src/app/components/ImageWithFallback.tsx` |
| エントリ | `src/main.tsx` |
| アプリルート | `src/app/App.tsx`（`RouterProvider`） |

---

## ライセンス・帰属

プロジェクトに `ATTRIBUTIONS.md` がある場合は、そちらも併せて参照してください。
