| データ名 | 目的 | 主な項目 | 関連データ |
|---|---|---|---|
| Store | 店舗・ブース情報を管理する | 店舗ID、店舗名、説明、受付番号prefix、営業状態、待ち時間、待ち人数、待ち時間表示タイプ | MenuItem, Order, MapFacility, SalesEntry |
| MenuItem | 店舗ごとの商品情報を管理する | 商品ID、店舗ID、商品名、説明、価格、販売状態 | Store, OrderItem |
| Order | 店舗会計と電子呼び出し番号を管理する | 注文ID、店舗ID、受付番号、合計金額、注文状態 | Store, OrderItem |
| OrderItem | 注文された商品の明細を管理する | 注文明細ID、注文ID、商品ID、数量、単価 | Order, MenuItem |
| TicketCounter | 店舗ごとの受付番号採番を管理する | 店舗ID、最終番号 | Store, Order |
| StoreAccount | 店舗ログイン情報を管理する | アカウントID、店舗ID、ログインID、パスワードハッシュ | Store |
| WaitStatus | 店舗ごとの待ち時間・待ち人数を管理する | 店舗ID、待ち時間、待ち人数、更新日時 | Store |
| MapFacility | 校内マップに表示する施設・ブース情報を管理する | 施設ID、名称、種別、階数、x座標、y座標 | Store |
| SalesEntry | 店舗が当日入力する売上を管理する | 店舗ID、金額、メモ、入力日時 | Store |
| EventNotice | イベント・お知らせを管理する | タイトル、本文、表示期間、種別 | なし |
| AdminUser | 管理者ログインと権限を管理する | 管理者ID、ログインID、権限 | Store |

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
- wait_display_mode（予定: `minutes` / `text`）
- wait_display_text（予定: 時間開始型ブース向け表示文言）
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
店舗会計と電子呼び出し番号を管理する。モバイルオーダー・予約システムは今後なくす方針のため、来場者の事前注文ではなく、店舗側の会計・呼び出し番号発行を主用途にする。

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
sales_entries

目的：
店舗が当日アプリ内で売上を入力し、紙媒体の決済合計と突き合わせるための売上記録を管理する。

主なカラム（予定）：
- id
- store_id
- amount
- memo
- recorded_at
- created_at
- updated_at

主キー：
id

外部キー：
store_id → stores.id

読み取り権限：
店舗、管理者

書き込み権限：
店舗、管理者

#### テーブル名：
event_notices

目的：
イベント画面に表示するお知らせ・タイムテーブル・運営連絡を管理する。

主なカラム（予定）：
- id
- title
- body
- type（event / notice）
- starts_at
- ends_at
- is_published
- created_at
- updated_at

主キー：
id

読み取り権限：
来場者、店舗、管理者

書き込み権限：
管理者

#### テーブル名：
admin_users

目的：
`/admin` の管理者ログインと権限を管理する。

主なカラム（予定）：
- id
- login_id
- password_hash
- role
- created_at
- updated_at

主キー：
id

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
