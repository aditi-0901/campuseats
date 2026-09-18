# CampusEats — Order Service — Assignment 5 Notes

**Team ID:** Group 7
| Role | Name | Roll No |
|---|---|---|
| Group Leader | Aditi Garg | 20251651008 |
| Group Member | Neha Nupur | 20251651064 |
| Group Member | Shivam Kumar Soni | 20251651084 |

---

# Part A — Methods & the Message

## A1: CampusEats Method Map

| Action | HTTP Method | URL | Success |
|---|---|---|---|
| Place a new order | POST | `/orders` | 201 |
| List / filter / sort / paginate orders | GET | `/orders?student={id}&page=&limit=&sort=&order=` | 200 |
| Read a single order | GET | `/orders/{id}` | 200 |
| Cancel an order | POST | `/orders/{id}/cancel` | 202 |
| Delete an order | DELETE | `/orders/{id}` | 204 |
| Discover allowed methods on `/orders` | OPTIONS | `/orders` | 204 |

GET reads, POST creates (or, on a sub-resource, performs a state change), DELETE removes. No verb leaks into a URL (no `/getOrder`, `/cancelOrder`, etc.).

## A2: Non-CRUD Action

Cancellation is not a plain create/read/update/delete action, so it is **not** modelled as `POST /cancelOrder`. It is a POST to a sub-resource:

```
POST /orders/{id}/cancel
```

This keeps the URL resource-oriented (`/orders/{id}` is still "the order") while the `/cancel` segment names the specific state transition being requested, exactly as the assignment's `checkout`/`setAvailability` examples do.

We deliberately did **not** map cancellation to `DELETE /orders/{id}`: an order is a financial record (it has already been charged), and deleting it would destroy the fact that the charge happened. `DELETE /orders/{id}` is kept in the API only as a literal verb-mapping exercise — it accepts the request and returns the correct status codes (204 / 401 / 404), but does not remove the order from the store, precisely because CampusEats never wants an order to actually disappear. Cancellation is the real "this order won't be fulfilled" operation, and it preserves the record while changing `status` to `cancelled`.

## A3: Safe and Idempotent

| Endpoint | Safe | Idempotent | Notes |
|---|:---:|:---:|---|
| `GET /orders` | Yes | Yes | Pure read, never touches store state |
| `GET /orders/{id}` | Yes | Yes | Pure read; supports `If-None-Match` → 304 |
| `POST /orders` | No | **No** (naturally) | Each call creates a new order by default; retry-safe *only* via `Idempotency-Key` (C3) |
| `DELETE /orders/{id}` | No | Yes | Repeating it lands on the same end state (still 204/404) — nothing further changes on retry |
| `POST /orders/{id}/cancel` | No | No (naturally) | A blind retry could act on a stale assumption about order state; made retry-safe via `If-Match` (C2), not via the idempotency-key mechanism |
| `OPTIONS /orders` | Yes | Yes | Metadata only, no store access |

`POST /orders` is the endpoint that is genuinely **neither safe nor idempotent**: a plain retry (network blip, double-click) would create a second order and charge the card twice. See C3 for how this is made safe to retry.

## A4: List, Filter, Sort and Paginate

`GET /orders` stays a pure read. Supported query parameters:

- `student` — filter to one student's orders
- `page` — default `1`
- `limit` — default `10`
- `sort` — `createdAt` (default) or `id`
- `order` — `asc` (default) or `desc`

Example: `GET /orders?student=101&page=1&limit=10&sort=createdAt&order=desc`

Invalid combinations (non-integers, `page < 1`, unknown `sort`/`order` values) return `400`. The endpoint never mutates state, regardless of which query parameters are supplied — see Q7 for when this would need to become a POST instead.

## A5: OPTIONS + Allow, and Override

`OPTIONS /orders` returns:

```
HTTP/1.1 204 No Content
Allow: GET, POST, OPTIONS
```

**Bug fixed while implementing Part C:** the generic CORS preflight middleware was written to answer *every* `OPTIONS` request with a bare 204 before Express ever reached the `app.options('/orders', ...)` route, so the `Allow` header above was never actually sent. Fixed by excluding `/orders` from the generic preflight responder so the resource-specific handler runs and sets `Allow`.

**X-HTTP-Method-Override:** documented as a fallback for constrained clients that cannot send `PUT`/`DELETE` directly. The Orders API does not depend on it in practice — its mutating endpoints are reached via `POST` (create, cancel) and a literal `DELETE` that any modern HTTP client can already send — so it is not wired into the middleware. If a genuinely constrained client needed it, it would be read only as a documented, opt-in override on top of the real method, never a substitute for it.

## A6: One Full Exchange

Servers: `node app.js` (port 8081) + `node dummy_bank.js` (port 8080).

```
> POST /orders HTTP/1.1
> Host: localhost:8081
> User-Agent: curl/8.5.0
> Accept: */*
> Content-Type: application/json
> Authorization: Bearer demo-token
> Idempotency-Key: demo-key-001
> Content-Length: 67
>
{"studentId":101,"itemId":5,"qty":2,"paymentMethodId":"tok_good"}

< HTTP/1.1 201 Created
< X-Powered-By: Express
< X-Content-Type-Options: nosniff
< Strict-Transport-Security: max-age=63072000; includeSubDomains
< Access-Control-Allow-Origin: *
< Access-Control-Allow-Headers: Content-Type, Authorization, Accept, Idempotency-Key, If-Match, If-None-Match
< Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
< X-RateLimit-Limit: 10
< X-RateLimit-Remaining: 9
< Location: /orders/1
< Content-Type: application/json; charset=utf-8
< Content-Length: 100
< ETag: W/"64-tRVuOjZd0fFBmgY08CTKP+Xe0gk"
< Date: Fri, 18 Sep 2026 18:26:56 GMT
<
{"id":1,"studentId":101,"itemId":5,"qty":2,"status":"placed","createdAt":"2026-09-18T18:26:56.472Z"}
```

(Full `-v` capture, including every scenario in Part D, is in `curl-transcript.txt`.)

---

# Part B — Headers on Every Message

Implemented in `app.js` / `errors.js`; each response includes what its route requires. Full endpoint × header breakdown is Part D2's table below, so this section only calls out the design choices:

- **B1** — `Content-Type: application/json` on every body; a `406` middleware runs first and rejects any `Accept` that excludes `application/json`/`*/*` before any route logic runs.
- **B2** — statuses follow the map in A1/A3 exactly; `Location` on 201 points at the new resource (see Q8 for how that differs from a 3xx `Location`).
- **B3** — `requireBearer` gates every route except the CORS preflight; missing/malformed tokens get `401` before any store access.
- **B4** — `GET /orders/{id}` sets `ETag` (`"order-{id}-{status}-{createdAt}"`) and `Cache-Control: private, max-age=60`. Because the ETag is built from `status` and `createdAt`, it necessarily changes the moment `cancel` changes `status` — which is what makes C1/C2 sound.
- **B5** — a 10-request-per-client budget (`X-RateLimit-Limit`/`X-RateLimit-Remaining` on every response; `429` + `Retry-After: 60` once exhausted).
- **B6** — `Access-Control-Allow-Origin: *` and a generic `OPTIONS` → `204` preflight reply on every route except `/orders` (which gets its `Allow`-bearing reply instead, A5).
- **B7** — `X-Content-Type-Options: nosniff` and `Strict-Transport-Security` are now set on every response (this was missing until this pass — added alongside the Part C work).

---

# Part C — Caching & Safe Retries

## C1: Conditional GET → 304

`GET /orders/{id}` reads `If-None-Match`, strips a leading `W/` if the client sent a weak comparison, and compares it against the current strong ETag. A match returns `304 Not Modified` with no body; anything else returns `200` with the full representation. Demonstrated in `curl-transcript.txt`, scenario 3b.

## C2: Conditional write → 412

`POST /orders/{id}/cancel` is the service's one "update" endpoint — it is the only operation that changes an existing order's state, so it is the one guarded by `If-Match`. If the caller supplies an `If-Match` header and it does **not** match the order's current ETag, the service returns `412 Precondition Failed` *before* even checking whether the order is in a cancellable state — a stale read is rejected on its own terms, not conflated with the business-rule conflict a valid-but-already-cancelled order would raise (that stays a `409`, checked second). `If-Match` is optional: a caller that never GETs first can still cancel, but a caller doing careful concurrency control can now detect a lost update. Demonstrated in `curl-transcript.txt`, scenarios 4 (stale → 412) and 4b (current → 202).

## C3: Idempotency key

`POST /orders` accepts an `Idempotency-Key` header. Before charging anything, the store is checked for that key; if it has already been used, the original order is returned as-is (`200`, not `201`) and `paymentsClient.chargeWithRetry` is never called a second time. Verified with a mocked payments client in `orders.test.js` (`toHaveBeenCalledTimes(1)` across two identical requests) and demonstrated live in `curl-transcript.txt`, scenarios 1–2.

**Where a duplicate would do real damage:** the payment charge. `POST /orders` is the one endpoint on this service that has an external, money-moving side effect. A duplicate `POST /orders/{id}/cancel` is comparatively harmless — worst case it's a no-op 409 (or a 412 if the ETag is stale) — but a duplicate uncontrolled `POST /orders` means a second real charge on the student's card for a single meal.

## C4: The Safe-Retry Plan

| Endpoint | Safe? | Idempotent? | Retry mechanism | Why |
|---|:---:|:---:|---|---|
| `GET /orders` | Yes | Yes | *(none needed)* | Safe reads can always be retried freely |
| `GET /orders/{id}` | Yes | Yes | `If-None-Match` | Not strictly needed for safety, but avoids re-sending an unchanged body on retry |
| `POST /orders` | No | No | **Idempotency-Key** | Retrying a lost response must not create a second order or charge the card twice; the key lets the server recognise "this is the same attempt" |
| `POST /orders/{id}/cancel` | No | No (naturally) | **If-Match** | Retrying a lost response must not silently act on an order whose state the client never actually saw; a stale ETag surfaces that as a 412 instead of a false success |
| `DELETE /orders/{id}` | No | Yes | *(none needed)* | Already idempotent by construction — repeating it reaches the same end state |

The split above follows directly from A3: only the two endpoints that are **not naturally idempotent** (`POST /orders`, `POST /orders/{id}/cancel`) need an explicit retry-safety mechanism, and each gets the mechanism suited to what it protects — a *creation* gets a dedup key, a *conditional state change* gets a precondition header.

---

# Part D — Verify & Document

## D1: curl -v transcript

See `curl-transcript.txt` — captured live against `node app.js` + `node dummy_bank.js`, in order: successful create (201+Location) → idempotent repeat (200) → conditional GET (200, capturing the ETag) → conditional GET replay (304) → cancel with a stale If-Match (412) → cancel with the current If-Match (202) → malformed body (400) → unknown order (404) → missing Bearer token (401).

## D2: Headers Table

| Endpoint | Request headers it needs | Response headers it sets |
|---|---|---|
| `POST /orders` | `Content-Type: application/json`, `Authorization: Bearer …`, `Idempotency-Key` (optional), `Accept` (optional) | `Location` (201 only), `Content-Type`, `ETag`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` (429 only), `Access-Control-Allow-*`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Cache-Control: no-store` (error responses only) |
| `GET /orders` | `Authorization: Bearer …` | `Content-Type`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Access-Control-Allow-*`, `X-Content-Type-Options`, `Strict-Transport-Security` |
| `GET /orders/{id}` | `Authorization: Bearer …`, `If-None-Match` (optional) | `ETag`, `Cache-Control: private, max-age=60` (200) / `Cache-Control: no-store` (404), `Content-Type`, `X-RateLimit-*`, `Access-Control-Allow-*`, `X-Content-Type-Options`, `Strict-Transport-Security` |
| `DELETE /orders/{id}` | `Authorization: Bearer …` | `Cache-Control: no-store`, `X-RateLimit-*`, `Access-Control-Allow-*`, `X-Content-Type-Options`, `Strict-Transport-Security` |
| `POST /orders/{id}/cancel` | `Authorization: Bearer …`, `If-Match` (optional) | `ETag` (202 only), `Cache-Control: no-store`, `Content-Type`, `X-RateLimit-*`, `Access-Control-Allow-*`, `X-Content-Type-Options`, `Strict-Transport-Security` |
| `OPTIONS /orders` | *(none required)* | `Allow`, `Access-Control-Allow-*` |
| `OPTIONS <any other path>` | *(none required)* | `Access-Control-Allow-*` (generic preflight reply, no `Allow`) |

`X-RateLimit-*` and the `Access-Control-Allow-*` / `X-Content-Type-Options` / `Strict-Transport-Security` headers are set by shared middleware and therefore appear on *every* response, success or error, which is why they're repeated across every row above rather than called out per-endpoint.

## D3: Answers

**1. Method, success status, and the one response header that matters most, for three endpoints:**

- `POST /orders` → `201` → **`Location`**. It is the one piece of information the client cannot derive from the request body — the server-assigned order ID — and it is exactly what the client needs to immediately `GET` or `cancel` the thing it just created.
- `GET /orders/{id}` → `200` → **`ETag`**. Every other capability in Part C (304, and — via the cancel endpoint's own read‑before‑write use of the same value — 412) depends on the client having gotten hold of this value first.
- `POST /orders/{id}/cancel` → `202` → **`ETag`** (of the now-cancelled order). It hands the client the fresh precondition value it needs for whatever it does next, without forcing a second `GET` just to re-establish it.

**2. Safe / idempotent, and the retry-safety mechanism:**

See A3 and C4 in full. Safe: `GET /orders`, `GET /orders/{id}`, `OPTIONS /orders`. Idempotent: those three, plus `DELETE /orders/{id}` (idempotent but not safe). **Neither safe nor idempotent:** `POST /orders` — made retry-safe with the `Idempotency-Key` mechanism (C3), so a client that never learned whether its create succeeded can resend the identical request and get the original order back instead of a duplicate. (`POST /orders/{id}/cancel` shares the same "neither" status but is addressed separately with `If-Match`, C2/C4, since what it protects against — acting on stale state — is a different failure mode from double-creation.)

**3. One ETag, the request that returns 304, the write that returns 412:**

From `curl-transcript.txt`: `GET /orders/1` returns `ETag: "order-1-placed-2026-09-18T18:26:56.472Z"`. Repeating `GET /orders/1` with `If-None-Match` set to that exact value returns `304 Not Modified` with no body — this **saves bandwidth and re-serialisation work**, since the server can tell the client's cached copy is still current without re-sending an identical JSON body. Sending `POST /orders/1/cancel` with a **stale** `If-Match` (an ETag from before, or in our demo, a deliberately old one) returns `412 Precondition Failed` — this **prevents a lost update**: the client is stopped from blindly acting on a version of the order it hasn't actually seen, instead of silently overwriting whatever changed in between.

**4. 422 vs 400 — exact requests and the difference:**

- `400`: `POST /orders` with `{"studentId":"wrong_type"}` (missing/mistyped required fields) → the request itself is malformed against the schema; the server never gets far enough to attempt the operation.
- `422`: `POST /orders` with a syntactically valid, correctly-typed body whose `paymentMethodId` the bank declines (e.g. `tok_declined`) → the request was well-formed and understood, but the server could not carry it out because of what it *means* — a domain rule (the bank said no) that can only be evaluated by actually attempting the operation.

The difference is *when* the failure is discovered: `400` fails before processing starts (shape); `422` fails after processing starts, because of the content's meaning (semantics).

**5. Browser blocked, server logs show 200 — who blocked it, which header fixes it:**

The **browser** blocked it — same-origin policy prevented the calling JavaScript from reading a cross-origin response that arrived without permission, even though the server processed the request fine and returned 200. The fix is the **`Access-Control-Allow-Origin`** response header (set by the B6 middleware on every response, including the `OPTIONS` preflight), which tells the browser the response is allowed to be handed back to the page's script.

**6. One response that allows caching, one that must use no-store:**

- **Allows caching:** `GET /orders/{id}` → `Cache-Control: private, max-age=60`. It's a single, addressable, per-user resource read; `private` keeps it out of shared caches, and the short `max-age` plus the ETag/304 machinery (C1) means a stale hit is cheap to catch and correct.
- **Must use `no-store`:** every error/action response — `400`/`401`/`404`/`409`/`412`/`429` bodies and the `202` cancel result all set `Cache-Control: no-store` (see `errors.js`/`app.js`). These are one-off outcomes of a specific request, not reusable representations of a resource; caching a `412` or a "cancel succeeded" body and replaying it later would actively lie to the next caller.

**7. When would the search endpoint be POST instead of GET, and what do you give up:**

`GET /orders` would need to become a `POST` (conventionally to something like `/orders/search`) if the filter criteria stopped fitting cleanly in a query string — e.g. a large `IN`-style list of item IDs, nested/structured filters, or any parameter sensitive enough that it shouldn't sit in server access logs or browser history. Switching gives up exactly what makes `GET` valuable for a list endpoint: the URL stops being bookmarkable/shareable, intermediate and browser caches can no longer treat repeated identical searches as free safe reads, and the request is no longer something a crawler or prefetcher can safely issue on its own.

**8. `Location` on a 201 vs. on a 3xx:**

On `201 Created` (`POST /orders`), `Location` points at the resource that was **just created** — `/orders/{id}` — so the client can act on the thing it made. On a `3xx` redirect, `Location` points at a **different, already-existing resource** the client should request instead. Same header, opposite direction of meaning: "here is the new thing" vs. "go look over there."
