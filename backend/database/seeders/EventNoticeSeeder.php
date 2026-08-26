<?php

namespace Database\Seeders;

use App\Models\EventNotice;
use Illuminate\Database\Seeder;

class EventNoticeSeeder extends Seeder
{
    public function run(): void
    {
        EventNotice::query()->updateOrCreate(
            ['title' => '開会式'],
            [
                'body' => '体育館にて開会式を行います。来場者の皆さんは1階エントランスからお入りください。',
                'type' => 'event',
                'starts_at' => now()->startOfDay(),
                'ends_at' => now()->endOfDay(),
                'is_published' => true,
            ],
        );

        EventNotice::query()->updateOrCreate(
            ['title' => '呼び出し番号の見方'],
            [
                'body' => '各ブースの呼び出し番号はアプリの注文タブ、または校内モニターで確認できます。',
                'type' => 'notice',
                'starts_at' => now()->subDay(),
                'ends_at' => now()->addDay(),
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
