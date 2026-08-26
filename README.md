# 学園祭 来場者・店舗向けアプリ

## プロダクト概要

### KTC学園祭アプリ

来場者がブースを円滑に回り、店舗側が待ち時間・受付番号・売上を管理できるようにする学園祭向けサービス。

想定ユーザー：
- 学園祭に訪れた人
- 各ブースの学生

解決する課題：
- 来場者がブースの混雑状況、場所、呼び出し番号を確認できる
- 店舗側が受付番号、待ち時間、会計、売上を管理できる
- 運営側が店舗情報や集計データを確認・管理できる

MVPで作る機能:
1. ブースの作成 
2. ブースの待ち時間表示 
3. ブース詳細表示
4. 電子呼び出し番号表示
5. 校内マップ表示
6. 店舗側の売上入力・確認

今後の方針:
- モバイルオーダー、予約システムは一旦なくし、カミングスーン扱いにする
- 来場者向けナビは `ホーム` / `ブース` / `注文(呼び出し番号)` / `イベント(お知らせ)` / `マップ` にする
- 管理画面 `/admin` を追加し、店舗作成、総収益、店舗情報の閲覧・編集・削除、分析・可視化を行う
- 校内モニター向けに呼び出し番号一覧画面を作成する

外部APIの利用予定：
- プッシュ通知? 
- pusher?

### 技術構成

- frontend: React + Vite
- backend: Laravel
- db: MySQL

## セットアップ手順

```
docker compose build 
docker compose up -d
```
### npmが見つからないとき
```
docker compose run --rm frontend sh -c "npm install"
```

### `vendor/autoload.php` がないと言われるとき（artisan/migrate/HTTP 500）
原因: Composer 依存関係が未インストール。

```
docker compose exec backend composer install --no-interaction --prefer-dist --optimize-autoloader
```

設定を反映していない場合:

```
docker compose down
docker compose up --build -d
```

---

### `APPLICATION IN PRODUCTION` が出て `migrate` が止まるとき

```
docker compose exec backend php artisan migrate
```

---

### `tempnam()` エラー（HTTP 500）が出たとき
原因: `storage` / `bootstrap/cache` の書き込み権限がない。

```
docker compose exec backend sh -c "mkdir -p storage/framework/{views,cache,sessions} storage/logs bootstrap/cache && chown -R www-data:www-data storage bootstrap/cache && chmod -R 775 storage bootstrap/cache"
```

---

## `MissingAppKeyException`（APP_KEY 未設定）
原因: `.env` がない、または `APP_KEY` が未生成。

```
docker compose exec backend sh -c "test -f .env || cp .env.example .env"
docker compose exec backend php artisan key:generate
```

必要なら:

```
docker compose exec backend php artisan config:clear
```
```
docker compose exec backend composer install
docker compose exec backend php artisan migrate:fresh --seed
```

### 動かないときに確認
- 同名containerがあるか
- 使うportをすでに使用しているか

## APIが遅いと感じたとき
タイム計測できるのでやってみてください。
```
  docker compose exec frontend node tests/apitest.js
```

## チーム内の連絡

discordを使用

## 更新ルール

- mainは直接いじらない

## URL
- [企画・技術選定メモ](https://docs.google.com/document/d/1gPD1SgeKTg1AOocWIwHxVsb_DS3MqJdEwdij2L4ADd8/edit?tab=t.0#heading=h.egs1tme8qw2)
- [frontend](./docs/frontend.md)
- [backend](./docs/backend.md)
- [api](./docs/api.md)
- [database](./docs/database.md)
- [requirements](./docs/requirements.md)
