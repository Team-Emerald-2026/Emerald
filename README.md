# 学園際　来場者向けアプリ

## プロダクト概要

### KTC学園祭アプリ

さまよう人が、円滑に回れるようにするためのモバイルサービス。

想定ユーザー：
- 学園祭に訪れた人
- 各ブースの学生

解決する課題：ブースを円滑に回ることができる

MVPで作る機能:
1. ブースの作成 
2. ブースの待ち時間表示 
3. ブース受付番号表示

外部APIの利用予定：
- プッシュ通知? 
- pusher?

### 技術構成

- frontend: Next.js
- backend: Laravel
- db: MySQL

## セットアップ手順

```
docker compose build 
docker compose up -d
```
### npmが見つからないとき
```
docker compose run --rm frontend sh npm install
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

### 動かないときに確認
- 同名containerがあるか
- 使うportをすでに使用しているか


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
