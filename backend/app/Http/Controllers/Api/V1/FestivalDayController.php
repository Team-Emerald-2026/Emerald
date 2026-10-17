<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FestivalSetting;

class FestivalDayController extends Controller
{
    public function show()
    {
        return response()->json([
            'data' => [
                'current_day' => FestivalSetting::currentDay(),
            ],
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }
}
