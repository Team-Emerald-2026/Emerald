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
| /restaurants | GET | なし | 飲食店一覧取得 |
| /restaurants/{id} | GET | なし | 飲食店詳細取得 |
| /store/login | POST | なし | 店舗ログイン（JWT発行） |
| /store/{id}/wait-time | PATCH | Bearer JWT | 待ち時間更新 |
| /map/facilities | GET | なし | マップ表示データ取得 |

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
来場者向けに、注文可能な飲食店一覧を取得する。

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
来場者向けに、飲食店の詳細、待ち時間、受け取り番号一覧を取得する。

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
	"ticket_numbers": ["C-120", "C-121", "Y-122"]
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
