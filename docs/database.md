| データ名 | 目的 | 主な項目 | 関連データ |
|---|---|---|---|
| Store | 店舗・ブース情報を管理する | 店舗ID、店舗名、説明、受付番号prefix、営業状態、待ち時間、待ち人数 | MenuItem, Order, MapFacility |
| MenuItem | 店舗ごとの商品情報を管理する | 商品ID、店舗ID、商品名、説明、価格、販売状態 | Store, OrderItem |
| Order | モバイルオーダーの注文情報を管理する | 注文ID、店舗ID、受付番号、合計金額、注文状態 | Store, OrderItem |
| OrderItem | 注文された商品の明細を管理する | 注文明細ID、注文ID、商品ID、数量、単価 | Order, MenuItem |
| Order ID | モバイルオーダーの受取番号 | 注文ID、受付番号、注文状態 | Order |
| StoreAccount | 店舗ログイン情報を管理する | アカウントID、店舗ID、ログインID、パスワードハッシュ | Store |
| WaitStatus | 店舗ごとの待ち時間・待ち人数を管理する | 店舗ID、待ち時間、待ち人数、更新日時 | Store |
| MapFacility | 校内マップに表示する施設・ブース情報を管理する | 施設ID、名称、種別、階数、x座標、y座標 | Store |

#### テーブル名：
stores

目的：
学園祭の店舗・ブース情報を管理する

主なカラム：
- id
- name
- description
- ticket_prefix
- is_open
- current_wait_min
- current_queue_count
- created_at
- updated_at

主キー：
id

外部キー：
なし

初期データの有無：
あり

読み取り権限：
来場者、店舗、管理者

書き込み権限：
店舗、管理者

#### テーブル名：
menu_items

目的：
各店舗の商品情報を管理する

主なカラム：
- id
- store_id
- name
- description
- price
- is_available
- created_at
- updated_at

主キー：
id

外部キー：
store_id → stores.id

初期データの有無：
あり

読み取り権限：
来場者、店舗、管理者

書き込み権限：
店舗、管理者

#### テーブル名：
orders

目的：
モバイルオーダーの注文情報と受付番号を管理する

主なカラム：
- id
- store_id
- ticket_number
- total_price
- status
- ordered_at
- called_at
- served_at
- created_at
- updated_at

主キー：
id

外部キー：
store_id → stores.id

初期データの有無：
なし

読み取り権限：
来場者、店舗、管理者

書き込み権限：
店舗、管理者

#### テーブル名：
ticket_counters

目的：
各店舗ごとの受付番号（ticket_number）を原子的に採番するためのカウンタを管理します。高並列でのオーダー作成時にもユニークな受付番号を保証する用途です。

主なカラム：
- store_id (PK) — stores.id を参照
- last_number (unsigned big integer) — 最後に割り当てた数値部分（例: 101）
- created_at
- updated_at

運用メモ：
- 初回利用時は各店舗の prefix で `PREFIX-101` が採番されます（例: `C-101`）。
- カウンタは各店舗単位で管理され、DB トランザクションと行ロックで安全に更新されます。
- 既存 orders がある場合は、その prefix の最大値から続けます。

#### テーブル名：
order_items

目的：
注文に含まれる商品明細を管理する

主なカラム：
- id
- order_id
- menu_item_id
- quantity
- unit_price
- subtotal

主キー：
id

外部キー：
order_id → orders.id
menu_item_id → menu_items.id

初期データの有無：
なし

読み取り権限：
店舗、管理者

書き込み権限：
店舗、管理者

#### テーブル名：
store_accounts

目的：
店舗向け管理画面のログイン情報を管理する

主なカラム：
- id
- store_id
- login_id
- password_hash
- created_at
- updated_at

主キー：
id

外部キー：
store_id → stores.id

初期データの有無：
あり

読み取り権限：
管理者

書き込み権限：
管理者

#### テーブル名：
map_facilities

目的：
校内マップに表示する施設・ブース情報を管理する

主なカラム：
- id
- store_id
- name
- type
- floor
- x
- y
- created_at
- updated_at

主キー：
id

外部キー：
store_id → stores.id

初期データの有無：
あり

読み取り権限：
来場者、店舗、管理者

書き込み権限：
管理者
