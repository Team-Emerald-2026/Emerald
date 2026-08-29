<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\EventNoticeResource;
use App\Models\EventNotice;
use Illuminate\Http\Request;

class AdminEventController extends Controller
{
    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        $events = EventNotice::query()
            ->orderByDesc('id')
            ->get();

        return EventNoticeResource::collection($events)
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);

        $event = EventNotice::query()->create($this->validated($request));

        return EventNoticeResource::make($event)
            ->response()
            ->setStatusCode(201)
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function show(Request $request, string $id)
    {
        $this->authorizeAdmin($request);

        return EventNoticeResource::make(EventNotice::query()->findOrFail($id))
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function update(Request $request, string $id)
    {
        $this->authorizeAdmin($request);

        $event = EventNotice::query()->findOrFail($id);
        $event->fill($this->validated($request, false));
        $event->save();

        return EventNoticeResource::make($event->refresh())
            ->response()
            ->setEncodingOptions(JSON_UNESCAPED_UNICODE);
    }

    public function destroy(Request $request, string $id)
    {
        $this->authorizeAdmin($request);

        EventNotice::query()->findOrFail($id)->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request, bool $creating = true): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'title' => [$required, 'string', 'max:255'],
            'body' => [$required, 'string', 'max:5000'],
            'type' => [$required, 'string', 'in:event,notice'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_published' => ['sometimes', 'boolean'],
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        if (config('admin.public_access')) {
            return;
        }

        abort_unless($request->user()?->role === 'admin', 403, '管理者権限が必要です。');
    }
}
