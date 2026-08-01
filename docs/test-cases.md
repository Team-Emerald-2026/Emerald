# テストケース一覧 — Emerald プロジェクト

作成日: 2026-07-18

このドキュメントはバックエンド（Laravel）とフロントエンド（React + Vite）について、実装可能な網羅的テストケースを列挙します。各ケースには ID, 名称, 前提条件, 手順, 期待結果, 優先度（Critical/High/Medium/Low）, 推奨テストデータ / 備考 を含みます。

---

## 目次
- バックエンド: 認証・認可 / 店舗 (Store) / 地図施設 (MapFacilities) / マイグレーション / セキュリティ / その他API
- フロントエンド: UI 基本 / localStorage・同期 / API エラー回復 / セキュリティ / E2E フロー

---

## 共通ルール
- テストは可能な限り自動化（PHPUnit / Pest for backend、Jest+Testing Library / Playwright for frontend）すること。
- DB: sqlite::memory: を活用するかテスト用 MySQL を用意し、各テストはトランザクションで巻き戻すこと。
- シークレットは環境変数（CI secrets）で注入すること。ログ出力に秘密が含まれないことを確認する。

---

# バックエンドテストケース

## 認証・認可 (Authentication & Authorization)

- B-AUTH-001 | ログイン成功 | 前提: テスト用ユーザー (email: user@example.com / password: password) が存在 | 手順: POST /api/login に有効な資格情報 | 期待: 200, トークン（access_token）を返す。ユーザーIDが一致する。 | 優先: Critical | データ: fixtures/users.json

- B-AUTH-002 | ログイン失敗（誤パスワード） | 前提: ユーザー存在 | 手順: POST /api/login に誤パスワード | 期待: 401 または 422、エラーメッセージ | 優先: High

- B-AUTH-003 | 保護API未認証アクセス拒否 | 前提: なし | 手順: GET /api/stores を Bearer トークンなしで呼ぶ | 期待: 401 | 優先: Critical

- B-AUTH-004 | トークンでの認可成功 | 前提: 有効トークンを保有 | 手順: GET /api/stores with Authorization Bearer | 期待: 200 + データ | 優先: Critical

- B-AUTH-005 | トークン期限切れ | 前提: 期限切れトークン / 有効なユーザー | 手順: API 呼び出し | 期待: 401 + 明示的メッセージ | 優先: High

- B-AUTH-006 | 権限によるアクセス制御（垂直） | 前提: 管理者と通常ユーザー | 手順: 管理者専用エンドポイントに通常ユーザーでアクセス | 期待: 403 | 優先: High

- B-AUTH-007 | トークンリフレッシュ | 前提: リフレッシュトークン実装がある場合 | 手順: POST /api/refresh with refresh token | 期待: 新しい access token が返る | 優先: Medium


## 店舗 (Store) API（CRUD）

- B-STORE-001 | 店舗一覧取得（正常） | 前提: 3 件の店舗が DB に存在 | 手順: GET /api/stores | 期待: 200, 配列長=3, 各フィールド型が期待通り | 優先: Critical | データ: fixtures/stores.json

- B-STORE-002 | 店舗取得（存在しないID） | 前提: 存在しない UUID | 手順: GET /api/stores/{id} | 期待: 404 | 優先: High

- B-STORE-003 | 店舗作成（正常） | 前提: 認証済み（適切権限） | 手順: POST /api/stores with valid payload | 期待: 201, DB レコード作成, 応答に id を含む | 優先: Critical

- B-STORE-004 | 店舗作成（バリデーション：必須フィールド欠如） | 前提: 認証済み | 手順: POST /api/stores with missing required fields | 期待: 422, エラー詳細 | 優先: High

- B-STORE-005 | 店舗更新（正常） | 前提: 既存店舗 | 手順: PUT /api/stores/{id} with changed fields | 期待: 200, DB に反映 | 優先: High

- B-STORE-006 | 店舗削除（正常） | 前提: 既存店舗、適切権限 | 手順: DELETE /api/stores/{id} | 期待: 204 / 200, レコード非表示または削除 | 優先: High

- B-STORE-007 | マスアサインメント防止 | 前提: POST /api/stores 実装あり | 手順: POST /api/stores に "is_admin": true のような想定外カラムを含める | 期待: 422 か is_admin が保存されない | 優先: High | 備考: 期待はプロジェクトの設計方針に準ずる

- B-STORE-008 | 型キャスト検証 | 前提: is_open 等にキャストあり | 手順: POST/PUT に文字列 'true'/'false' を送る | 期待: DB 側／レスポンスで boolean として扱われる | 優先: Medium

- B-STORE-009 | 同時更新の整合性（楽観ロック想定） | 前提: 楽観ロック未実装の場合は低優先 | 手順: 2 並列更新シナリオ | 期待: 最終状態が定義通り（ race が許容される場合はドキュメント化） | 優先: Medium


## MapFacilities API

- B-MAP-001 | 地図施設作成（正常） | 前提: store_id が存在 | 手順: POST /api/map-facilities | 期待: 201, DB 保存, 整数キャスト確認 | 優先: High

- B-MAP-002 | 地図施設取得（一覧） | 前提: store_id 指定で 0/複数件 | 手順: GET /api/stores/{store_id}/map-facilities | 期待: 200, 正しい件数 | 優先: Medium

- B-MAP-003 | 無効な座標値の拒否 | 前提: x,y は整数 | 手順: POST with x='a' | 期待: 422 | 優先: High


## マイグレーション / DB

- B-MIG-001 | マイグレーション適用（テスト） | 前提: 新しい migration ファイル | 手順: php artisan migrate --env=testing | 期待: exit 0, 新しいテーブル/カラムが作成される | 優先: High

- B-MIG-002 | マイグレーションロールバック | 前提: 直前の migrate を実行済み | 手順: php artisan migrate:rollback --env=testing | 期待: 元のスキーマに戻る | 優先: High

- B-MIG-003 | 破壊的変更の検出（レビュー） | 前提: migration に dropColumn/dropTable | 手順: CI にてレビュー用ジョブを実行し警告を出す | 期待: 明示的承認が必要であることを通知 | 優先: High


## セキュリティテスト（自動/手動）

- B-SEC-001 | SQL インジェクション試験 | 前提: 文字列パラメータを受け取る API | 手順: ' OR 1=1 -- のようなペイロードを送る | 期待: 予期したバリデーションエラーまたはエスケープされる。DB からの不正行取得が起きない | 優先: Critical

- B-SEC-002 | マスアサインメント侵害試験 | 前提: create/update API | 手順: 想定しない属性（role, is_admin, password_hash）を送る | 期待: 保存されない | 優先: Critical

- B-SEC-003 | レートリミット（Brute Force 保護） | 前提: ログイン API | 手順: 短時間に大量の失敗ログイン試行 | 期待: 一定回数で 429 を返す or lockout 動作 | 優先: High

- B-SEC-004 | ログに秘密が書き込まれていないか | 前提: テストラン時のログ取得 | 手順: テスト実行ログの検索で APP_KEY/DB_PASSWORD を検索 | 期待: 見つからない | 優先: Critical

- B-SEC-005 | ファイルアップロード検証（もし実装あり） | 前提: ファイルアップロードエンドポイント | 手順: 危険な拡張子/大容量ファイルを送る | 期待: 拒否またはウィルススキャン、保存先の隔離 | 優先: High


## API エラー・フォールバック

- B-ERR-001 | 500 エラー時のユーザー向けメッセージ（API） | 前提: サーバ側が 500 を返すシナリオ | 手順: 500 を返すモックで API を呼び出す | 期待: 一貫したエラー形式（status/message）で返る | 優先: High

- B-ERR-002 | タイムアウトハンドリング | 前提: API がタイムアウトする状況 | 手順: 遅延応答をシミュレート | 期待: タイムアウトとして扱われ適切なエラーコードを返す/ログが記録される | 優先: Medium


## その他ユーティリティ / 保守性

- B-UTIL-001 | API ドキュメント整合性（もし swagger/出力があれば） | 前提: API ドキュメントが存在 | 手順: doc と実装の差分チェック | 期待: 重大差分は CI で検知 | 優先: Medium

- B-TEST-001 | テストカバレッジ閾値 | 前提: カバレッジ測定導入 | 手順: テスト実行でカバレッジを測る | 期待: 閾値（例: 70%）を達成 | 優先: Low


# フロントエンドテストケース

## 単体 / 統合テスト（Jest + Testing Library）

- F-UNIT-001 | Home コンポーネントがレンダリングされる | 前提: コンポーネントが存在 | 手順: shallow render / render | 期待: 主要要素が表示される | 優先: Medium

- F-UNIT-002 | StoreList コンポーネントが API 呼び出しを行う | 前提: API が mockable | 手順: API モックでレスポンス返却 | 期待: 受け取った店舗がリストに描画される | 優先: High

- F-UNIT-003 | フォーム入力バリデーション（Store 作成フォーム） | 前提: フォームコンポーネントがある | 手順: 必須フィールドを空にしてサブミット | 期待: エラーメッセージが表示される | 優先: High

- F-UNIT-004 | カスタムフック（useApi 等）のエラー分岐 | 前提: useApi が存在 | 手順: fetch を失敗させるモック | 期待: hook がエラー状態を返し、コンポーネントが適切に表示 | 優先: High

- F-UNIT-005 | localStorage ラッパーの単体テスト | 前提: localStorage ラッパがある | 手順: 単体で読み書きと削除を行う | 期待: 正常に値を格納・取得・削除できる | 優先: High


## E2E テスト（Playwright 推奨） — 主要フロー

- F-E2E-001 | メインフロー: 店舗一覧表示 → 詳細 → 行列操作
  - 前提: テスト用 API（モックまたはテスト DB）に店舗データ 3 件
  - 手順:
    1. アプリを起動
    2. /stores に移動
    3. 最初の店舗をクリック
    4. 行列ボタン（queue/join）を押す
    5. 結果のスナップショットを確認
  - 期待: 各画面遷移が成功、localStorage または API に状態が保存される
  - 優先: Critical

- F-E2E-002 | 購入 / 注文フロー（ある場合）
  - 前提: ストアに購入フローが実装
  - 手順: 商品を選びカートに追加→チェックアウト→成功画面
  - 期待: 注文ID が発行される、UI に成功メッセージ
  - 優先: Critical

- F-E2E-003 | 認証フロー E2E
  - 前提: ログインページ実装
  - 手順: 正常な資格情報でログイン→保護ページにアクセス
  - 期待: 保護ページへ遷移、Cookie/LocalStorage にトークン格納（必要な場合）
  - 優先: High

- F-E2E-004 | API 500 が返る場合の UX
  - 前提: API モックで 500 を返す
  - 手順: 問い合わせやリソース取得を実行
  - 期待: ユーザ向けエラートーストを表示、コンソールに重大なエラーを出力しない
  - 優先: High

- F-E2E-005 | ローカルストレージの悪意ある値での起動
  - 前提: localStorage に <script> 等の文字列を挿入可能
  - 手順: localStorage を書き換えてアプリをリロード
  - 期待: DOM に直接挿入されず、エスケープされること。スクリプトは実行されない。 | 優先: High


## フロント固有の検証

- F-FUNC-001 | API レスポンスの型変化検出
  - 前提: レスポンスの型に依存する処理がある
  - 手順: 型が変化したレスポンスをモック | 期待: エラーが throw されるかフェールセーフをとる | 優先: Medium

- F-ACCESS-001 | アクセシビリティ基礎チェック
  - 前提: 主要ページ
  - 手順: axe-core 等を用いた自動チェック | 期待: 重大なアクセシビリティ違反がない | 優先: Medium

- F-PERF-001 | 初回ロードの主要リソース応答時間（簡易）
  - 前提: DevServer / Production build
  - 手順: Lighthouse で簡易測定 | 期待: 主要リクエストが 1s 未満（目標） | 優先: Low


## セキュリティ関連（フロント）

- F-SEC-001 | XSS 表面化テスト（API → DOM）
  - 前提: 表示するデータが API から来る
  - 手順: API モックで <img src=x onerror=alert(1)> を含む文字列を返す | 期待: アラート実行されない、文字列はエスケープ | 優先: Critical

- F-SEC-002 | CSRF の検出（もしサーバが Cookie 認証を使う場合）
  - 前提: Cookie ベースのセッション認証がある場合
  - 手順: CSRF トークンが必要なエンドポイントに対してトークンなしでリクエスト | 期待: 403 / エラーで拒否 | 優先: High
