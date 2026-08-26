# バックエンドAPI定義書

## 1. 概要
- 対象: 京都TECH学園祭アプリ
- 目的: 来場者向けアプリと店舗向け管理画面が利用するREST APIの仕様を定義する
- 対象クライアント:
	- 来場者向けWeb / モバイルアプリ
	- 店舗向け管理画面

## 2. 共通仕様
- ベースURL: `https://api.example.com/api/v1`
- データ形式: `application/json`
- 日時形式: ISO 8601（例: `2026-05-09T12:34:56Z`）
- 認証:
	- 来場者向け: なし
	- 店舗向け: `Authorization: Bearer <JWT>`
- レート制限: 1000 req/min
- バージョニング方式: URLパス `/v1/`
- 文字コード: UTF-8
- エラー形式: 共通エラーフォーマットを使用する

## 3. エンドポイント一覧
| エンドポイント | メソッド | 認証 | 説明 |
| --- | ---: | --- | --- |
| /restaurants | GET | なし | ブース・店舗一覧取得 |
| /restaurants/{id} | GET | なし | ブース・店舗詳細取得 |
| /map/facilities | GET | なし | マップ表示データ取得 |
| /call-numbers | GET | なし | 来場者向け呼び出し番号一覧 |
| /monitor/call-numbers | GET | なし | 校内モニター向け呼び出し番号一覧 |
| /events | GET | なし | イベント・お知らせ一覧取得 |
| /events/{id} | GET | なし | イベント・お知らせ詳細取得 |
| /auth/login | POST | なし | 店舗ログイン |
| /auth/logout | POST | Bearer Token | 店舗ログアウト |
| /auth/register | POST | なし | 店舗登録（今後は管理画面へ移行予定） |
| /store/{id}/wait-time | PATCH | Bearer Token | 待ち時間・待ち人数更新 |
| /booth/auth/login | POST | なし | 店舗ログイン |
| /booth/auth/logout | POST | Bearer Token | 店舗ログアウト |
| /booth/dashboard | GET | Bearer Token | 店舗ダッシュボード取得 |
| /booth/accounting/menu-items | GET | Bearer Token | 店舗メニュー取得 |
| /booth/accounting/orders | GET | Bearer Token | 会計一覧取得 |
| /booth/accounting/orders | POST | Bearer Token | 会計作成・受付番号発行 |
| /booth/accounting/orders/{id} | GET | Bearer Token | 会計詳細取得 |
| /booth/accounting/orders/ticket/{ticketNumber} | GET | Bearer Token | 受付番号で会計取得 |
| /booth/accounting/orders/{id}/settle | PATCH | Bearer Token | 会計清算 |
| /booth/accounting/orders/{id}/call | PATCH | Bearer Token | 会計を呼び出し中にする |
| /booth/accounting/orders/{id}/serve | PATCH | Bearer Token | 会計を提供完了にする |
| /booth/sales | GET | Bearer Token | 当日売上記録一覧 |
| /booth/sales | POST | Bearer Token | 当日売上入力 |
| /booth/sales/{id} | PATCH | Bearer Token | 当日売上記録の編集 |
| /booth/sales/{id} | DELETE | Bearer Token | 当日売上記録の削除 |
| /admin/auth/login | POST | なし | 管理者ログイン |
| /admin/auth/logout | POST | Bearer Token | 管理者ログアウト |
| /admin/stores | GET | Bearer Token | 店舗一覧取得 |
| /admin/stores | POST | Bearer Token | 新規店舗作成 |
| /admin/stores/{id} | GET | Bearer Token | 店舗詳細取得 |
| /admin/stores/{id} | PATCH | Bearer Token | 店舗編集 |
| /admin/stores/{id} | DELETE | Bearer Token | 店舗削除（非表示化） |
| /admin/revenue | GET | Bearer Token | 総収益取得 |
| /admin/analytics | GET | Bearer Token | 集計・分析・可視化用データ取得 |
| /admin/events | GET | Bearer Token | イベント・お知らせ一覧（管理者） |
| /admin/events | POST | Bearer Token | イベント・お知らせ作成 |
| /admin/events/{id} | GET | Bearer Token | イベント・お知らせ詳細（管理者） |
| /admin/events/{id} | PATCH | Bearer Token | イベント・お知らせ編集 |
| /admin/events/{id} | DELETE | Bearer Token | イベント・お知らせ削除 |

## 4. 各API詳細

### 4.1 飲食店一覧取得
```javascript
GET /api/v1/restaurants
{
  method: 'GET',
  headers: {
    'Accept': 'application/json',
  }
}
```

#### 説明
来場者向けに、表示対象のブース・店舗一覧を取得する。モバイルオーダーと予約システムは今後なくす方針のため、このAPIはブース一覧・ブース詳細・呼び出し番号導線の基礎データとして扱う。

#### パラメータ
| 項目 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| page | int | 任意 | ページ番号 |
| limit | int | 任意 | 1ページあたりの件数 |

#### 成功レスポンス (200)
```json
{
	"data": [
		{
			"id": "store-101",
			"name": "KTCカフェ",
			"is_open": true,
			"wait_time": 10
		},
		{
			"id": "store-102",
			"name": "天津飯",
			"is_open": true,
			"wait_time": 15
		}
	],
	"meta": {
		"total": 10,
		"page": 1,
		"limit": 20
	}
}
```

#### エラー例
- 500 Internal Server Error: 一覧取得処理で予期しないエラーが発生した場合

#### 備考
- データが0件の場合でも 200 OK を返し、`data` は空配列とする

### 4.2 飲食店詳細取得
```javascript
GET /api/v1/restaurants/{id}
{
  method: 'GET',
  headers: {
    'Accept': 'application/json',
  }
}
```

#### 説明
来場者向けに、ブース・店舗の詳細、待ち時間、受付番号情報を取得する。

今後、レスポンスには以下を含める。
- 店舗名
- 説明
- メニュー一覧
- 場所（マップリンクに利用できる `map_facility_id` または `store_id`）
- 電子呼び出し番号
- 一人あたりの待ち時間

#### パラメータ
| 項目 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| id | string | 必須 | 飲食店ID |

#### 成功レスポンス (200)
```json
{
	"id": "store-101",
	"name": "KTCカフェ",
	"description": "学園祭限定メニューを提供するカフェ",
	"is_open": true,
	"wait_time": 10,
	"current_wait_min": 10,
	"current_queue_count": 5,
	"wait_display_mode": "minutes",
	"wait_display_text": null,
	"map_facility_id": "1",
	"menu_items": [
		{
			"id": 1,
			"name": "ブレンドコーヒー",
			"description": "ホット",
			"price": 350,
			"is_available": true
		}
	],
	"ticket_numbers": ["C-120"]
}
```

#### エラー例
- 404 Not Found: 指定した飲食店IDが存在しない場合
- 500 Internal Server Error: 詳細情報の取得処理で予期しないエラーが発生した場合

### 4.3 店舗ログイン
```javascript
POST /api/v1/store/login
{
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    login_id: 'cafe_admin',
    password: 'password123',
  })
}
```

#### 説明
店舗IDとパスワードでログインし、JWTを発行する。

#### リクエストボディ
```json
{
	"login_id": "cafe_admin",
	"password": "password123"
}
```

#### 成功レスポンス (200)
```json
{
	"token": "eyJhbGciOi...",
	"store_id": "store-101"
}
```

#### エラー例
- 400 Bad Request: `login_id` または `password` が不足している場合
- 401 Unauthorized: 店舗IDまたはパスワードが正しくない場合

### 4.4 待ち時間更新
```javascript
PATCH /api/v1/store/{id}/wait-time
{
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <JWT_TOKEN>',
  },
  body: JSON.stringify({
    current_wait_min: 20,
    current_queue_count: 10,
  })
}
```

#### 説明
店舗側が待ち時間や待ち人数を更新する。

#### パラメータ
| 項目 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| id | string | 必須 | 店舗ID |

#### リクエストボディ
```json
{
	"current_wait_min": 20,
	"current_queue_count": 10
}
```

#### 成功レスポンス (200)
```json
{
	"id": "store-101",
	"current_wait_min": 20,
	"current_queue_count": 10,
	"updated_at": "2026-05-09T12:34:56Z"
}
```

#### エラー例
- 400 Bad Request: `current_wait_min` や `current_queue_count` の値が不正な場合
- 401 Unauthorized: JWTが無効または期限切れの場合
- 403 Forbidden: 自店舗以外の待ち時間を更新しようとした場合
- 404 Not Found: 指定した店舗IDが存在しない場合

今後、時間で開始するブース向けに、数値の待ち時間ではなくテキスト表示を返せる項目を追加する。
`wait_display_mode` を `text` にし、`wait_display_text` に表示文言を入れる。

### 4.5 マップ表示データ取得
```javascript
GET /api/v1/map/facilities
{
  method: 'GET',
  headers: {
    'Accept': 'application/json',
  }
}
```

#### 説明
校内マップに表示する施設・ブース情報を取得する。

#### 成功レスポンス (200)
```json
{
  "data": [
    {
      "id": "1",
      "type": "map_facilities",
      "attributes": {
        "store_id": 1,
        "name": "VRお化け屋敷",
        "type": "booth",
        "floor": 1,
        "x": 120,
        "y": 80
      }
    },
    {
      "id": "2",
      "type": "map_facilities",
      "attributes": {
        "store_id": 2,
        "name": "カフェ休憩所",
        "type": "food",
        "floor": 1,
        "x": 60,
        "y": 140
      }
    },
    {
      "id": "3",
      "type": "map_facilities",
      "attributes": {
        "store_id": 3,
        "name": "ARゲームコーナー",
        "type": "booth",
        "floor": 2,
        "x": 200,
        "y": 100
      }
    },
    {
      "id": "4",
      "type": "map_facilities",
      "attributes": {
        "store_id": 4,
        "name": "グッズ販売",
        "type": "shop",
        "floor": 2,
        "x": 150,
        "y": 150
      }
    }
  ]
}
```

#### エラー例
- 500 Internal Server Error: マップ表示データの取得に失敗した場合

今後、フロント側ではマップフィルタを削除する予定。API は引き続き施設種別や階層を返すが、主用途はフロア画像上のピン描画とブース詳細へのリンクにする。

### 4.6 店舗ダッシュボード取得
```javascript
GET /api/v1/booth/dashboard
```

#### 説明
ログイン中店舗の店舗名、説明、営業状態、待ち時間、待ち人数、総収益を取得する。

#### 成功レスポンス (200)
```json
{
  "id": "store-101",
  "name": "KTCカフェ",
  "description": "学園祭限定メニューを提供するカフェ",
  "is_open": true,
  "current_wait_min": 10,
  "current_queue_count": 5,
  "wait_display_mode": "minutes",
  "wait_display_text": null,
  "revenue": 12000
}
```

### 4.7 店舗会計 API

#### メニュー取得
```javascript
GET /api/v1/booth/accounting/menu-items
```

ログイン中店舗の商品メニューを取得する。

#### 会計作成・受付番号発行
```javascript
POST /api/v1/booth/accounting/orders
{
  "items": [
    { "menu_item_id": 1, "quantity": 2 }
  ]
}
```

会計を作成し、店舗ごとの `ticket_prefix` を使って `C-101` のような電子呼び出し番号を発行する。

#### 会計清算
```javascript
PATCH /api/v1/booth/accounting/orders/{id}/settle
```

紙媒体の決済合計と照合するため、店舗側で清算済みとして記録する。

#### 呼び出し
```javascript
PATCH /api/v1/booth/accounting/orders/{id}/call
```

受付番号を呼び出し中にする。`called_at` を記録する。

#### 提供完了
```javascript
PATCH /api/v1/booth/accounting/orders/{id}/serve
```

提供完了として記録し、待ち人数を 1 減らす。

### 4.8 当日売上入力

```javascript
GET /api/v1/booth/sales
POST /api/v1/booth/sales
PATCH /api/v1/booth/sales/{id}
DELETE /api/v1/booth/sales/{id}
```

店舗が当日アプリ内で売上を入力し、紙媒体の決済合計と突き合わせる。

#### 作成リクエスト
```json
{
  "amount": 15000,
  "memo": "午前レジ締め"
}
```

### 4.9 呼び出し番号

```javascript
GET /api/v1/call-numbers
GET /api/v1/monitor/call-numbers
```

- 来場者向けは、現在呼び出し中の番号一覧を返す
- 校内モニター向けは、店舗ごとに呼び出し中番号と提供待ち番号を返す

### 4.10 イベント・お知らせ

```javascript
GET /api/v1/events
GET /api/v1/events/{id}
```

公開中かつ表示期間内のイベント・お知らせを返す。管理者は `/admin/events` で作成・編集・削除できる。

### 4.11 管理画面

- `GET /api/v1/admin/stores`: 店舗一覧取得
- `POST /api/v1/admin/stores`: 新規店舗作成
- `GET /api/v1/admin/stores/{id}`: 店舗詳細取得
- `PATCH /api/v1/admin/stores/{id}`: 店舗編集
- `DELETE /api/v1/admin/stores/{id}`: 店舗削除（非表示化）
- `GET /api/v1/admin/revenue`: 総収益取得（会計清算 + 当日売上入力）
- `GET /api/v1/admin/analytics`: 集計・分析・可視化用データ取得
- `GET|POST|PATCH|DELETE /api/v1/admin/events`: イベント・お知らせ管理

## 5. エラー仕様

### 共通エラーフォーマット
```json
{
	"error": {
		"code": "INVALID_PARAMS",
		"message": "パラメータが不正です",
		"details": {
			"field": "quantity",
			"reason": "must be > 0"
		}
	}
}
```

### HTTPステータスと意味
| コード | 意味 | 主な原因 |
| --- | --- | --- |
| 400 | Bad Request | パラメータ不足、型不正、バリデーションエラー |
| 401 | Unauthorized | トークン無効、期限切れ、認証失敗 |
| 403 | Forbidden | 権限不足 |
| 404 | Not Found | リソース未発見 |
| 429 | Too Many Requests | レート超過 |
| 500 | Internal Server Error | サーバーエラー |

## 6. バリデーションと運用メモ
- id下3桁を教室番号にしたっていい
- マップは画像にしてもいい
- ID指定APIは、存在しないIDの場合に 404 Not Found を返す
- 店舗向け操作は、JWTの署名検証と認可チェックを必須とする
- 数値項目は、API側で型チェックと範囲チェックを行う

### 6.1 受付番号（ticket_number）の採番について
- 受付番号は `PREFIX-<number>` 形式で発行されます。ユーザー向けの受け取り番号（例: `C-101`）。
- `stores.ticket_prefix` でブースごとの頭文字を管理します。prefix は被らないように運用します。
- 高並列環境でも一意性を担保するため、`ticket_counters` テーブルを設け、各店舗ごとに数値部分を原子的にインクリメントします。
- 実装上の注意点:
  - カウンタは DB トランザクションと行ロックで更新されます（Race 条件を防止）。
  - 初回は `PREFIX-101` から採番され、既存データがある場合は同じ prefix の最大値から継続します。
  - 同一店舗内でのユニーク制約（store_id, ticket_number）が維持されます。

運用変更を行った際はマイグレーションを実行してください:
```
# backend コンテナ内で
docker compose exec backend php artisan migrate
```
