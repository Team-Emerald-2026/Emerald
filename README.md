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
docker compose exec backend php artisan migrate
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