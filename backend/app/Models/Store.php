<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Store extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'description',
        'ticket_prefix',
        'is_open',
        'is_visible',
        'current_wait_min',
        'current_queue_count',
    ];

    protected $casts = [
        'is_open' => 'boolean',
        'is_visible' => 'boolean',
    ];
}