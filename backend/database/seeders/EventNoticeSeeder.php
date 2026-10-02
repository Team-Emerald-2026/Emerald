<?php

namespace Database\Seeders;

use App\Models\EventNotice;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class EventNoticeSeeder extends Seeder
{
    private const DAY1 = '2026-10-24'; // 土曜 11:00〜16:30
    private const DAY2 = '2026-10-25'; // 日曜 11:00〜16:00

    public function run(): void
    {
        // 本番は起動のたびに db:seed が走るため、管理画面で編集した内容を
        // 上書きしないよう、データが1件でもあれば何もしない
        if (EventNotice::query()->exists()) {
            return;
        }

        // 時間割（イベント）
        $this->upsert('開会式', '体育館にて開会式を行います。', 'event', self::DAY1, '11:00');
        $this->upsert('スペシャルゲスト整理券配布', '正門前で整理券を配布します。', 'event', self::DAY1, '12:30');
        $this->upsert('スペシャルゲスト登壇！', 'メインステージにスペシャルゲストが登場します。', 'event', self::DAY1, '14:30');
        $this->upsert('ステージライブ', '軽音部によるライブ演奏です。', 'event', self::DAY2, '13:00');
        $this->upsert('閉会式', '体育館にて閉会式を行います。', 'event', self::DAY2, '15:30');

        // お知らせ（日にちなし＝両日共通）
        $this->upsert(
            '呼び出し番号の見方',
            '各ブースの呼び出し番号はアプリの呼び出しタブ、または校内モニターで確認できます。',
            'notice',
            null,
            null,
        );

        // お知らせ（日にち指定）
        $this->upsert('駐輪場について（10/24）', '自転車は北門横の駐輪場をご利用ください。', 'notice', self::DAY1, '00:00');
        $this->upsert('後夜祭のお知らせ（10/25）', '終了後、校庭で後夜祭を行います。', 'notice', self::DAY2, '00:00');

        $this->upsert('非公開のお知らせ', 'このお知らせは公開前です。', 'notice', self::DAY1, '00:00', false);
    }

    private function upsert(
        string $title,
        string $body,
        string $type,
        ?string $day,
        ?string $time,
        bool $published = true,
    ): void {
        $startsAt = $day && $time
            ? Carbon::parse("{$day} {$time}:00", 'Asia/Tokyo')->utc()
            : null;

        EventNotice::query()->updateOrCreate(
            ['title' => $title],
            [
                'body' => $body,
                'type' => $type,
                'starts_at' => $startsAt,
                'ends_at' => null,
                'is_published' => $published,
            ],
        );
    }
}
