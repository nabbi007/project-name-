# AgroVoice Backend — Frontend Integration Guide

This document is the contract between the AgroVoice **backend** (`server/`) and the **React frontend** (`client/`). It describes every endpoint currently implemented, the response envelope, authentication, roles, enums, file uploads, and the AI-failure fallbacks.

> Status: All core phases (1–11) implemented — auth, farmers, voice/STT, listing extraction, vision, listing management/publication, TTS notifications, public marketplace, orders/inventory, and administration.

---

## 1. Base URL & conventions

- Base URL: `http://localhost:5000/api` (configurable via `VITE_API_URL`).
- All requests/responses are JSON, except file uploads (multipart/form-data) and audio downloads.
- **Resource IDs are UUID strings** (the `uuid` field), not numeric DB ids and not Mongo `_id`. Always use the `uuid` returned by the API in path params.
- Auth uses a **Bearer JWT**: `Authorization: Bearer <token>`.
- Dates are ISO-8601 strings. `availableDate` accepts `YYYY-MM-DD`.

### Response envelopes

Success:

```json
{ "success": true, "message": "Operation completed successfully", "data": { } }
```

Paginated (note: `data` is an array, `pagination` is a sibling of `data`):

```json
{
  "success": true,
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

Validation error (HTTP 422):

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": { "fieldName": ["Error message"] }
}
```

General error (HTTP 4xx/5xx):

```json
{ "success": false, "message": "Something went wrong", "code": "INTERNAL_ERROR" }
```

> The error envelope uses `message` + `code`. There is **no** top-level `error` string. Update the client `ErrorResponse` type accordingly (read `message`).

---

## 2. Authentication & roles

Roles: `ADMIN`, `FIELD_AGENT`, `BUYER`. User status: `ACTIVE`, `SUSPENDED` (suspended users cannot log in or use protected routes).

The login/register responses return `{ user, token }`. Store the token and send it as a Bearer header. Tokens expire per `JWT_EXPIRES_IN` (default 1 day).

A `user` object looks like:

```json
{
  "uuid": "…",
  "name": "Jane Buyer",
  "email": "jane@example.com",
  "phone": "+23320…",
  "role": "BUYER",
  "status": "ACTIVE",
  "createdAt": "…",
  "updatedAt": "…"
}
```

`passwordHash` is never returned.

---

## 3. Endpoint reference

Legend: 🔓 public · 🔑 authenticated · roles in (parentheses).

### 3.1 Health

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/health` | 🔓 | `{ success, message, data:{ uptime } }` |

### 3.2 Auth

| Method | Path | Access | Body | Returns |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | 🔓 | `{ name, email, password, phone? }` | `{ user, token }` (always BUYER) |
| POST | `/auth/login` | 🔓 | `{ email, password }` | `{ user, token }` |
| GET | `/auth/me` | 🔑 | — | `{ user }` |
| POST | `/auth/logout` | 🔑 | — | `{}` (client discards token) |

- Public registration **always** creates a `BUYER`; a `role` in the body is ignored.
- Login is by **email** (not phone). Suspended accounts get HTTP 403 `ACCOUNT_SUSPENDED`. Bad credentials get HTTP 401 `INVALID_CREDENTIALS`.

### 3.3 Admin — agent creation (auth + ADMIN)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/admin/agents` | `{ name, email, password, phone? }` | `{ agent }` (role FIELD_AGENT) |

> Full admin dashboard, moderation, complaints, and AI monitoring are in §3.14.

### 3.4 Farmers (auth + FIELD_AGENT/ADMIN)

Field agents only see/modify their own farmers; admins see all. Accessing another agent's farmer returns 404.

| Method | Path | Body / Query | Returns |
| --- | --- | --- | --- |
| POST | `/farmers` (FIELD_AGENT) | `{ fullName, displayName?, phone?, gender?, preferredLanguage?, region?, district?, community?, notes?, consentConfirmed? }` | `{ farmer }` |
| GET | `/farmers` | `?search=&status=&page=&limit=` | paginated farmers |
| GET | `/farmers/:farmerId` | — | `{ farmer }` |
| PATCH | `/farmers/:farmerId` | partial of create body | `{ farmer }` |
| PATCH | `/farmers/:farmerId/status` | `{ status: ACTIVE|INACTIVE|ARCHIVED }` | `{ farmer }` |

`consentConfirmed: true` records `consentConfirmedAt` (required before a listing can be published).

### 3.5 Voice sessions & Speech-to-Text (auth + FIELD_AGENT/ADMIN)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/farmers/:farmerId/voice-sessions` | `{ sessionReference? }` | `{ session }` |
| GET | `/voice-sessions/:sessionId` | — | `{ session }` (with `responses[]`) |
| POST | `/voice-sessions/:sessionId/responses` | **multipart**: `audio` (file) + `questionType`, `language?`, `transcript?` | `{ response }` |
| POST | `/voice-responses/:responseId/transcribe` | — | `{ response }` (calls Snwolley STT) |
| POST | `/voice-responses/:responseId/retry` | — | `{ response }` |
| PATCH | `/voice-responses/:responseId/transcript` | `{ transcript?, correctedTranscript? }` | `{ response }` |
| POST | `/voice-sessions/:sessionId/complete` | — | `{ session }` (sets status `COMPLETED`) |

- `questionType`: `CROP | QUANTITY | UNIT | AVAILABILITY_DATE | PRICE | ADDITIONAL_INFORMATION`.
- Audio upload: allowed types wav/mp3/m4a/aac/ogg/webm/3gp, max **25 MB**. Field name must be `audio`.
- **Manual fallback**: send a `transcript` text field (no audio needed) to record an answer manually; or use `PATCH …/transcript` after a failed transcription. STT failures return handled codes (`STT_NOT_CONFIGURED`, `STT_TIMEOUT`, `STT_RATE_LIMITED`, `STT_UNAVAILABLE`, `EMPTY_TRANSCRIPT`, …) — never a 500.
- `processingStatus`: `PENDING | PROCESSING | COMPLETED | FAILED`.

### 3.6 Listing extraction from voice (auth + FIELD_AGENT/ADMIN)

| Method | Path | Returns |
| --- | --- | --- |
| POST | `/voice-sessions/:sessionId/extract-listing` | `{ listing, extracted, incompleteFields, chatId }` |

- Combines the session's completed transcripts (prefers corrected), asks the Agents API for structured fields, and creates a **DRAFT** listing (never auto-published).
- `extracted`: `{ crop, quantity, unit, pricePerUnit, availableDate, description }` (nulls where unknown).
- `incompleteFields`: array of field names needing manual completion (complete them via `PATCH /listings/:id`).
- Requires the Snwolley platform key + agent id; if unset, returns `AGENT_NOT_CONFIGURED` (503) and you complete the listing manually.

### 3.7 Crop categories

| Method | Path | Access | Body | Returns |
| --- | --- | --- | --- | --- |
| GET | `/crop-categories` | 🔓 | — | `{ categories }` |
| POST | `/crop-categories` | 🔑 (ADMIN) | `{ name, description?, defaultUnit? }` | `{ category }` |

### 3.8 Listing images & Vision (auth + FIELD_AGENT/ADMIN)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/listings/:listingId/images` | **multipart**: `image` (file) + `isPrimary?` | `{ image }` |
| POST | `/listing-images/:imageId/analyse` | — | `{ image, observation, cropMatchStatus }` |
| POST | `/listing-images/:imageId/retry` | — | `{ image, observation, cropMatchStatus }` |
| PATCH | `/listing-images/:imageId/review` | `{ decision: APPROVE|REJECT, cropMatchStatus?, notes? }` | `{ image }` |

- Image upload: jpg/png/webp/heic, max **10 MB**, field name `image`.
- `observation`: `{ identifiedCrop, colour, maturity, visibleCondition, visibleIssues[], recommendation, warning }`.
- `cropMatchStatus`: `MATCH | MISMATCH | UNCLEAR | MANUAL_REVIEW_REQUIRED`. A human must always review (image `status`: `PENDING | ANALYSED | REVIEWED | REJECTED`).
- Vision results are visible-feature observations only — never present them as certified food-safety analysis.

### 3.9 Listing management & publication (auth + FIELD_AGENT/ADMIN)

| Method | Path | Body / Query | Returns |
| --- | --- | --- | --- |
| POST | `/listings` (FIELD_AGENT) | `{ farmerId, cropCategoryId?, title?, description?, quantity?, unit?, pricePerUnit?, availableDate?, region?, community? }` | `{ listing }` |
| GET | `/listings` | `?status=&cropCategoryId=&search=&page=&limit=` | paginated listings (agent's own / all for admin) |
| GET | `/listings/:listingId` | — | `{ listing }` (with farmer, category, images) |
| PATCH | `/listings/:listingId` | partial + `agentConfirmed?` | `{ listing }` (only editable while DRAFT/PROCESSING/PENDING_REVIEW/REJECTED) |
| POST | `/listings/:listingId/publish` | — | `{ listing }` |
| POST | `/listings/:listingId/unpublish` | — | `{ listing }` (back to DRAFT) |

- `farmerId`, `cropCategoryId` are **UUIDs**.
- `unit` must be one of: `KG, BAG, SACK, BASKET, CRATE, BOX, BUNCH, BUNDLE, PIECE, TUBER, BOWL, OLONKA`.
- `status`: `DRAFT | PROCESSING | PENDING_REVIEW | PUBLISHED | RESERVED | SOLD_OUT | EXPIRED | REJECTED`.
- **Publish requirements** — if unmet, returns 422 with `errors.publication: string[]`:
  active farmer · recorded consent · valid crop category · quantity > 0 · price > 0 · availability date · at least one crop image · agent-confirmed.
- This `GET /listings` is **agent/admin scoped and requires auth**. The public buyer marketplace is a separate set of endpoints under `/marketplace/*` (see §3.10).

### 3.10 Public marketplace (🔓 no auth)

Only `PUBLISHED`, in-stock (`availableQuantity > 0`), non-expired listings are exposed. **Farmer phone numbers are never included.**

| Method | Path | Query | Returns |
| --- | --- | --- | --- |
| GET | `/marketplace/listings` | `?crop=&region=&community=&minPrice=&maxPrice=&search=&sort=&page=&limit=` | paginated public listings |
| GET | `/marketplace/listings/:listingId` | — | `{ listing }` (404 if not publicly visible) |
| GET | `/marketplace/farmers/:farmerId` | — | `{ farmer, listings }` (public profile + their published listings) |

- `sort`: `newest` (default) · `price_asc` · `price_desc`.
- `crop` matches the crop category name/slug or listing title (case-insensitive). `region`/`community` are case-insensitive contains.
- Public listing/farmer payloads expose `farmer: { uuid, fullName, displayName, region, district, community }` only — no `phone`, no agent/internal fields.
- Images are limited to `ANALYSED`/`REVIEWED` ones, primary first.

### 3.11 Orders & inventory (🔑 auth)

Buyers place and cancel orders; field agents/admins fulfil them. Placing an order **reserves stock** (decrements `availableQuantity`); cancelling restores it. A listing flips to `SOLD_OUT` at zero stock and back to `PUBLISHED` when restocked (if not expired).

| Method | Path | Access | Body / Query | Returns |
| --- | --- | --- | --- | --- |
| POST | `/orders` | BUYER | `{ listingId, quantity, deliveryMethod?, deliveryLocation?, paymentMethod?, notes? }` | `{ order }` |
| GET | `/orders/mine` | BUYER | `?status=&page=&limit=` | paginated buyer orders |
| GET | `/orders` | FIELD_AGENT/ADMIN | `?status=&page=&limit=` | paginated managed orders (for the agent's listings) |
| GET | `/orders/:orderId` | any participant | — | `{ order }` (buyer=own, agent=their listings, admin=all) |
| PATCH | `/orders/:orderId/cancel` | BUYER | — | `{ order }` (only while PENDING/CONFIRMED) |
| POST | `/orders/:orderId/farmer-confirmation` | FIELD_AGENT/ADMIN | — | `{ order }` (PENDING → CONFIRMED) |
| PATCH | `/orders/:orderId/status` | FIELD_AGENT/ADMIN | `{ status, notes? }` | `{ order }` |

- `deliveryMethod`: `PICKUP` (default) · `DELIVERY`. `paymentMethod`: `PAY_ON_PICKUP` (default) · `CASH_ON_DELIVERY` · `SIMULATED_MOMO` (sets `paymentStatus=SIMULATED_PAID`).
- `status`: `PENDING | CONFIRMED | AWAITING_COLLECTION | READY_FOR_PICKUP | IN_TRANSIT | COLLECTED | DELIVERED | COMPLETED | CANCELLED | DISPUTED`.
- Allowed agent transitions: PENDING→CONFIRMED/CANCELLED; CONFIRMED→AWAITING_COLLECTION/READY_FOR_PICKUP/IN_TRANSIT/CANCELLED; AWAITING_COLLECTION|READY_FOR_PICKUP→COLLECTED/CANCELLED; IN_TRANSIT→DELIVERED/CANCELLED; COLLECTED|DELIVERED→COMPLETED/DISPUTED. Invalid jumps return 400 `INVALID_STATUS_TRANSITION`.
- An order is single-listing. `order.items[]` each carry `quantity`, `unitPrice`, `subtotal`, and the listing/farmer summary. `order.statusHistory[]` records every change. Farmer phone is not included.
- `POST /orders/:orderId/farmer-confirmation` records that the farmer acknowledged the order via the field agent. Only works while status is `PENDING`; idempotent if already `CONFIRMED`.
- Over-ordering returns 400 `INSUFFICIENT_STOCK`.

### 3.12 Complaints (🔑 auth)

| Method | Path | Access | Body | Returns |
| --- | --- | --- | --- | --- |
| POST | `/complaints` | BUYER | `{ orderId, message }` or `{ orderId, description, category? }` | `{ complaint }` |
| GET | `/admin/complaints` | ADMIN | `?status=&page=&limit=` | paginated complaints |
| PATCH | `/admin/complaints/:complaintId` | ADMIN | `{ status, resolution? }` | `{ complaint }` |

- `status`: `OPEN | IN_REVIEW | RESOLVED | REJECTED`. Resolving requires a `resolution` string.
- Buyers can only file complaints on their own orders. One open complaint per order (`COMPLAINT_EXISTS` if duplicate).
- Complaint payload includes `order: { uuid, orderNumber, status, totalAmount }` and `buyer: { uuid, name }`.

### 3.13 Generated audio / TTS notifications (auth + FIELD_AGENT/ADMIN)

Generates spoken (WAV) notifications for farmers via Snwolley TTS.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/listings/:listingId/audio` | `{ language? }` | `{ audio }` (LISTING_PUBLISHED) |
| POST | `/orders/:orderId/audio` | `{ messageType: NEW_ORDER\|ORDER_CANCELLED, language? }` | `{ audio }` |
| GET | `/generated-audio/:audioId` | — | `{ audio }` |
| PATCH | `/generated-audio/:audioId/played` | — | `{ audio }` (sets `playedAt`) |
| PATCH | `/generated-audio/:audioId/farmer-confirmed` | — | `{ audio }` (sets `farmerConfirmedAt`) |

- `audio`: `{ uuid, messageType, textContent, audioPath, processingStatus, playedAt, farmerConfirmedAt, createdAt }`.
- `processingStatus`: `PENDING | PROCESSING | COMPLETED | FAILED`. The WAV is at `audioPath` — a Cloudinary HTTPS URL (or a relative `uploads/generated-audio/<id>.wav` path in local-fallback mode). See "Media URLs (Cloudinary)" below.
- Buyers cannot access generated audio (farmer-facing). TTS failures return handled `TTS_*` codes, never a 500.

### 3.14 Administration (auth + ADMIN)

| Method | Path | Body / Query | Returns |
| --- | --- | --- | --- |
| POST | `/admin/agents` | `{ name, email, password, phone? }` | `{ agent }` (creates FIELD_AGENT) |
| GET | `/admin/stats` | — | dashboard aggregates |
| GET | `/admin/users` | `?role=&status=&search=&page=&limit=` | paginated users |
| PATCH | `/admin/users/:userId/status` | `{ status: ACTIVE\|SUSPENDED }` | `{ user }` |
| GET | `/admin/ai-runs` | `?apiType=&processingStatus=&page=&limit=` | paginated AI processing logs |
| POST | `/admin/ai-runs/:runId/retry` | — | `{ run }` (re-dispatches failed AI job) |
| GET | `/admin/complaints` | `?status=&page=&limit=` | paginated complaints (see §3.12) |
| PATCH | `/admin/complaints/:complaintId` | `{ status, resolution? }` | `{ complaint }` |
| PATCH | `/admin/listings/:listingId/moderate` | `{ decision: APPROVE\|REJECT, reason? }` | `{ listing }` |

- `/admin/stats` returns `{ users:{ total, byRole }, farmers:{ total, byStatus }, listings:{ total, byStatus }, orders:{ total, byStatus, completedRevenue }, ai:{ total, byStatus } }`.
- Admins cannot change their own status (400 `SELF_STATUS_CHANGE`). Suspended users cannot log in.
- Moderation: `REJECT` → `REJECTED`; `APPROVE` → `PUBLISHED` (admin override). `apiType`: `SPEECH_TO_TEXT | AGENT_CHAT | VISION | TEXT_TO_SPEECH`.
- AI retry re-invokes the original handler: STT → transcribe, VISION → analyse, AGENT_CHAT → extract listing, TTS → re-synthesise audio.

---

## 4. File uploads (multipart)

For `audio` and `image` uploads do **not** set `Content-Type` manually — let the browser set the multipart boundary. Example:

```ts
const form = new FormData();
form.append('questionType', 'CROP');
form.append('audio', fileBlob, 'answer.wav');
await apiClient.post(`/voice-sessions/${sessionId}/responses`, form);
```

### Media URLs (Cloudinary)

Uploaded audio/images and generated TTS audio are stored on **Cloudinary**. The API returns the full media reference in `imagePath` / `audioPath`:

- When Cloudinary is configured, this is an absolute HTTPS URL (e.g. `https://res.cloudinary.com/<cloud>/image/upload/.../agrovoice/images/abc.png`) — use it directly as `src`/`href`, no prefixing needed.
- As a fallback (when Cloudinary env vars are unset), the API returns a relative path like `uploads/images/abc.png`, served from the server origin (e.g. `http://localhost:5000/uploads/images/abc.png`).

Frontend rule of thumb: if the value starts with `http`, use it as-is; otherwise prefix with the server origin.

---

## 5. Quick start for the frontend

1. Point `VITE_API_URL` at `http://localhost:5000/api`.
2. Auth: register/login → store `data.token` → send `Authorization: Bearer <token>`.
3. On 401, clear the token and route to login (already handled in `api-client.ts`).
4. Use `uuid` from responses for all path params.
5. For uploads, post `FormData` without a manual `Content-Type`.
6. Read errors from `message` (validation details live in `errors`).
