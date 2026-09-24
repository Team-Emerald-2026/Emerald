<?php

namespace Database\Seeders;

use App\Models\EventNotice;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class EventNoticeSeeder extends Seeder
{
    public function run(): void
    {
        $today = Carbon::now('Asia/Tokyo')->toDateString();

        EventNotice::query()->updateOrCreate(
            ['title' => '開会式'],
            [
                'body' => '体育館にて開会式を行います。',
                'type' => 'event',
                'starts_at' => Carbon::parse("{$today} 10:00:00", 'Asia/Tokyo')->utc(),
                'ends_at' => null,
                'is_published' => true,
            ],
        );

        EventNotice::query()->updateOrCreate(
            ['title' => 'スペシャルゲスト'],
            [
                'body' => 'メインステージにてスペシャルゲストが登場します。',
                'type' => 'event',
                'starts_at' => Carbon::parse("{$today} 12:00:00", 'Asia/Tokyo')->utc(),
                'ends_at' => null,
                'is_published' => true,
            ],
        );

        EventNotice::query()->updateOrCreate(
            ['title' => 'ステージライブ'],
            [
                'body' => '軽音部によるライブ演奏です。',
                'type' => 'event',
                'starts_at' => Carbon::parse("{$today} 14:00:00", 'Asia/Tokyo')->utc(),
                'ends_at' => null,
                'is_published' => true,
            ],
        );

        EventNotice::query()->updateOrCreate(
            ['title' => '呼び出し番号の見方'],
            [
                'body' => '各ブースの呼び出し番号はアプリの呼び出しタブ、または校内モニターで確認できます。',
                'type' => 'notice',
                'starts_at' => null,
                'ends_at' => null,
                'is_published' => true,
            ],
        );

        EventNotice::query()->updateOrCreate(
            ['title' => '非公開のお知らせ'],
            [
                'body' => 'このお知らせは公開前です。',
                'type' => 'notice',
                'starts_at' => now(),
                'ends_at' => now()->addDay(),
                'is_published' => false,
            ],
        );
    }
}
