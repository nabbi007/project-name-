# AgroVoice Backend — Frontend Integration Guide

This document is the contract between the AgroVoice **backend** (`server/`) and the **React frontend** (`client/`). It describes every endpoint currently implemented, the response envelope, authentication, roles, enums, file uploads, and the AI-failure fallbacks.

> Status: Phases 1–7 + 9 implemented (auth, farmers, voice/STT, listing extraction, vision, listing management/publication, public marketplace). Phases 8, 10, 11 (TTS, orders, administration) are in progress.

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

### Seeded test accounts

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | `admin@agrovoice.test` | `Admin123!` |
| FIELD_AGENT | `agent@agrovoice.test` | `Agent123!` |
| BUYER | `buyer@agrovoice.test` | `Buyer123!` |

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

### 3.3 Admin (auth + ADMIN)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/admin/agents` | `{ name, email, password, phone? }` | `{ agent }` (role FIELD_AGENT) |

> Only admins create field agents. (Full admin dashboard/moderation is Phase 11, not yet built.)

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

---

## 4. File uploads (multipart)

For `audio` and `image` uploads do **not** set `Content-Type` manually — let the browser set the multipart boundary. Example:

```ts
const form = new FormData();
form.append('questionType', 'CROP');
form.append('audio', fileBlob, 'answer.wav');
await apiClient.post(`/voice-sessions/${sessionId}/responses`, form);
```

Uploaded files are served read-only from `/uploads/...` (the API returns relative paths like `uploads/images/abc.png`). Prefix with the server origin to display, e.g. `http://localhost:5000/uploads/images/abc.png`.

---

## 5. Differences from the current `client/src/api/*` stubs (action items)

The current client stubs assume a different (Mongo-style) contract. Please reconcile:

| Client assumption | Actual backend | Action |
| --- | --- | --- |
| `POST /auth/register-buyer` with `{ name, phone, password }` | `POST /auth/register` with `{ name, email, password, phone? }` | Rename + send `email`; collect email at signup |
| Login `{ phone, password }` | Login `{ email, password }` | Login is by email |
| `error.response.data.error` | `message` + `code` | Read `message` (and `code` for branching) |
| Resource `_id` | `uuid` | Use `uuid` everywhere |
| `GET /listings` for buyers (auto PUBLISHED) | `/listings` is agent/admin only & requires auth | Use `/marketplace/listings` (§3.10, public) for buyers |
| Listing fields `crop`, `imageUrl`, `expiryDate`, `visionObservation` | `cropCategory.name`, `images[].imagePath`, `expiresAt`, `visualObservation` (string) + `visionDescription` | Map field names |
| Listing status `ANALYZING/NEEDS_HUMAN_REVIEW` | image `status` + `cropMatchStatus` separate enums | See §3.8 |
| Pagination `data.{listings,page,total}` | `data: []` + `pagination: { page, limit, total, totalPages }` | Read `pagination` |
| Orders `/orders/mine`, statuses `PLACED…`, `SIMULATED_MOMO` | Phase 10 (not built yet); backend statuses are `PENDING/CONFIRMED/…`, payment `SIMULATED_PAID/CASH_ON_DELIVERY/PAY_ON_PICKUP` | Align once Phase 10 lands |

When Phases 9–11 are implemented this guide will be extended with the marketplace, orders, and admin contracts.

---

## 6. Quick start for the frontend

1. Point `VITE_API_URL` at `http://localhost:5000/api`.
2. Auth: register/login → store `data.token` → send `Authorization: Bearer <token>`.
3. On 401, clear the token and route to login (already handled in `api-client.ts`).
4. Use `uuid` from responses for all path params.
5. For uploads, post `FormData` without a manual `Content-Type`.
6. Read errors from `message` (validation details live in `errors`).
