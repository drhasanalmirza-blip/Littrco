# LITTR Classifier — Phase 0 & Phase 1

Vision-based classifier for vape recycling drops. Decides whether a captured
image is a `vape`, `thc_vape`, `not_a_vape`, or `uncertain`, then applies the
bin's reject policy to produce a verdict.

## Critical rule: when the classifier runs

The classifier is invoked **only** from `processCapture` in
`server/classifier/worker.ts`, which is **only** triggered from the
`POST /api/bin-module/drop-capture` route when a capture arrives for the
`after` or `crop` image role.

It does **NOT** run on:
- server boot / deploy
- page load
- cron / scheduled jobs
- listing or polling endpoints
- baseline image uploads

## Environment

| Var | Default | Meaning |
|---|---|---|
| `CLASSIFIER_PROVIDER` | `off` | `off` = Phase 0 pass-through; `anthropic` = Phase 1 vision |
| `ANTHROPIC_API_KEY` | unset | required when provider=anthropic; without it, falls back to pass-through |
| `CLASSIFIER_MODEL` | `claude-haiku-4-5-20251001` | Anthropic vision model id |
| `CLASSIFIER_DAILY_BUDGET_USD` | `5` | daily USD spend cap; over the cap → pass-through fallback |

The app must run with none of these set. Default is **Phase 0 pass-through**.

## Phase 0 — Pass-through

When `CLASSIFIER_PROVIDER=off` (or key missing, or budget exceeded, or image
unreadable), the worker returns:

```
label = "uncertain"
confidence = 0.5
version = "pass_through:1"
costMicros = 0
```

Verdict: **accepted**, `reviewNeeded=true`, `reason = auto_accepted`. The drop
appears in `/admin/review` for human labeling. (Per spec, `reviewNeeded` is
always true for pass-through versions regardless of confidence.)

## Phase 1 — Anthropic vision

When `CLASSIFIER_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` is set:

1. **pHash dedupe** — compute a perceptual hash; if a prior image with the same
   pHash already has a classifier result, reuse it at $0.
2. **Daily budget check** — sum `classifier_cost_log.cost_micros` for today; if
   it's over `CLASSIFIER_DAILY_BUDGET_USD`, fall back to pass-through.
3. **Prompt caching** — the system prompt is sent with `cache_control:
   ephemeral` so repeated calls within ~5 min only pay the cache-read rate.
4. Call Anthropic Messages API with the JPEG (base64).
5. Cost math (micro-dollars): `ceil((inTok - cachedInTok) * 1.00 + cachedInTok * 0.10 + outTok * 5.00)`
   — Haiku 4.5 list pricing per Mtok input/cached/output.
6. Persist `classifier_label / confidence / version / costMicros / phash` on
   `drop_images`, and log to `classifier_cost_log`.

## Verdict rules

Given the classifier result and the bin's `rejectNonVapes` / `rejectThcVapes`
flags:

| Condition | accepted | reason | reviewNeeded |
|---|---|---|---|
| `confidence < 0.55` | true | `low_confidence` | true |
| `label == not_a_vape` and bin rejects non-vapes | false | `not_a_vape` | true |
| `label == thc_vape` and bin rejects THC | false | `thc_vape` | true |
| `label == uncertain` | true | `uncertain` | true |
| `confidence < 0.7` | true | `<label>` | true |
| `version` starts with `pass_through` | true | `<label>` | true |
| otherwise | true | `<label>` | false |

The drop row is updated with `verdictReady=true`, `verdictAccepted`,
`verdictReason`, `verdictDecidedAt`, `verdictReviewNeeded`.

## Bin module integration

### `POST /api/bin-module/drop-capture`

Header: `X-Module-Token: <token>`

Body (preferred):
```json
{
  "eventId": "evt_abc123",
  "imageRole": "after",
  "imageBase64": "<jpeg base64>"
}
```

- Does **not** auto-create the drop. If a `drops` row with this `eventId`
  exists, the capture is linked to it; otherwise the capture is stored with
  `dropId = null` and queued by `eventId` until the drop arrives.
- Idempotent on `(eventId, imageRole)` — re-POSTs return the existing image.
- For `imageRole` in `{after, crop}`, schedules `processCapture` via
  `queueMicrotask` **only when the drop already exists**. When firmware
  later POSTs the drop via `/api/drops/start` (with `eventId`) or
  `/api/drops/:dropId/submit`, the server links the orphan captures and
  triggers `processCapture` then — guaranteeing `verdictReady` is set.
  Other roles (`baseline`, `debug`) skip the classifier.

### `GET /api/bin-module/drop-verdict?eventId=evt_abc123`

Returns:
```json
{ "ok": true, "data": {
  "eventId": "evt_abc123",
  "ready": true, "accepted": true, "reason": "vape",
  "reviewNeeded": false, "decidedAt": "..."
}}
```

The bin module polls this until `ready=true`, then displays the verdict.

## Admin review

`GET /api/admin/review?page=1&limit=50` — paginated list of drops with
`verdictReviewNeeded=true`, newest first. Response includes
`pagination: { page, limit, total, totalPages }`.
`POST /api/admin/review/:dropId/correct` — submit
`{ correctedLabel, notes?, imageId? }`. Recorded in `classifier_corrections`;
clears the review flag and, if reward not yet claimed, adjusts the drop's
verdict + `pointsAwarded`.

Frontend: `/admin/review` (staff role) — accessible from the Drop Review tab in
the staff dashboard.

`GET /api/admin/review/budget` — today's spend, cap, provider, key presence.

## Out of scope (Phase 2)

- Fine-tuning on `classifier_corrections`
- Real-time WebSocket verdict push (module currently polls)
- Image storage on S3 / object store (currently local `uploads/`)
- Multi-image fusion (currently classifies a single `after`/`crop` image)
