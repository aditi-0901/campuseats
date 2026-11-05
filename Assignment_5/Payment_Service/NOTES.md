# CampusEats — Payment Service — Assignment 5 Notes

**Team ID:** Group 7
| Role | Name | Roll No |
|---|---|---|
| Group Leader | Aditi Garg | 20251651008 |
| Group Member | Neha Nupur | 20251651064 |
| Group Member | Shivam Kumar Soni | 20251651084 |

---

# Part A — Methods & the Message

## A1: CampusEats Payment Method Map

| Action | HTTP Method | URL | Success |
|---|---|---|---|
| Process / charge payment | POST | `/payments` | 201 |
| List / filter / sort / paginate payments | GET | `/payments?orderId={id}&page=&limit=&sort=&order=` | 200 |
| Read a single payment | GET | `/payments/{id}` | 200 |
| Refund a payment | POST | `/payments/{id}/refund` | 202 |
| Delete a payment | DELETE | `/payments/{id}` | 204 |
| Discover allowed methods on `/payments` | OPTIONS | `/payments` | 204 |

GET reads, POST creates (or, on a sub-resource, performs a state change), DELETE removes. No verb leaks into a URL (no `/getPayment`, `/refundPayment`, etc.).

## A2: Non-CRUD Action

Refund is not a plain create/read/update/delete action, so it is **not** modelled as `POST /refundPayment`. It is a POST to a sub-resource:

```
POST /payments/{id}/refund
```

This keeps the URL resource-oriented (`/payments/{id}` is still "the payment") while the `/refund` segment names the specific state transition being requested.

We deliberately did **not** map refund to `DELETE /payments/{id}`: a payment transaction is an immutable financial ledger entry (it records a money movement), and deleting it would destroy audit history. `DELETE /payments/{id}` is kept in the API only as a verb-mapping exercise — it accepts the request and returns the correct status codes (204 / 401 / 404), but does not remove the payment from the store. Refund is the real "this charge is returned to the user" operation, preserving the transaction record while transitioning `status` to `refunded`.

## A3: Safe and Idempotent

| Endpoint | Safe | Idempotent | Notes |
|---|:---:|:---:|---|
| `GET /payments` | Yes | Yes | Pure read, never touches store state |
| `GET /payments/{id}` | Yes | Yes | Pure read; supports `If-None-Match` → 304 |
| `POST /payments` | No | **No** (naturally) | Each call creates a new payment charge by default; retry-safe *only* via `Idempotency-Key` (C3) |
| `DELETE /payments/{id}` | No | Yes | Repeating it lands on the same end state (still 204/404) — nothing further changes on retry |
| `POST /payments/{id}/refund` | No | No (naturally) | A blind retry could act on a stale assumption about payment state; made retry-safe via `If-Match` (C2) |
| `OPTIONS /payments` | Yes | Yes | Metadata only, no store access |

`POST /payments` is the endpoint that is naturally **neither safe nor idempotent**: a plain retry (network blip, double-click) would create a second payment charge and bill the user twice. See C3 for how this is made safe to retry.

## A4: List, Filter, Sort and Paginate

`GET /payments` stays a pure read. Supported query parameters:

- `orderId` — filter payments for a specific order ID
- `page` — default `1`
- `limit` — default `10`
- `sort` — `createdAt` (default) or `id`
- `order` — `asc` (default) or `desc`

Example: `GET /payments?orderId=101&page=1&limit=10&sort=createdAt&order=desc`

Invalid combinations (non-integers, `page < 1`, unknown `sort`/`order` values) return `400`. The endpoint never mutates state, regardless of query parameters supplied.

## A5: OPTIONS + Allow, and Override

1. **OPTIONS on `/payments`**: Returns status `204 No Content` with header:
   ```
   Allow: GET, POST, OPTIONS
   ```
   Tells clients which HTTP verbs are implemented on the resource collection.

2. **HTTP Method Override**: For clients or legacy firewalls restricted to `GET` and `POST`, method override can be signaled via the header:
   ```
   X-HTTP-Method-Override: DELETE
   ```
   The service inspects this header on `POST` requests and dispatches to the specified target method.

## A6: Full Raw HTTP Trace (POST /payments)

### Request:
```http
POST /payments HTTP/1.1
Host: localhost:8080
User-Agent: curl/8.21.0
Accept: */*
Authorization: Bearer test-token
Content-Type: application/json
Idempotency-Key: pay-demo-001
Content-Length: 68

{"orderId":101,"cardToken":"tok_good","amount":2000,"currency":"INR"}
```

### Response:
```http
HTTP/1.1 201 Created
X-Powered-By: Express
Location: /payments/1
Content-Type: application/json; charset=utf-8
Content-Length: 110
ETag: W/"68-9whKB57dhCZVgLXhPA8VCDGVOqA"
Date: Sat, 19 Sep 2026 07:05:00 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"orderId":101,"cardToken":"tok_good","amount":2000,"currency":"INR","status":"captured","createdAt":"2026-09-19T07:05:00.000Z"}
```

## A7: Complete RFC 7807 Problem JSON Trace (422 Payment Declined)

When a card is declined (`cardToken: "tok_declined"`):

### Request:
```http
POST /payments HTTP/1.1
Host: localhost:8080
Authorization: Bearer test-token
Content-Type: application/json
Content-Length: 72

{"orderId":101,"cardToken":"tok_declined","amount":2000,"currency":"INR"}
```

### Response:
```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
Content-Length: 122

{
  "type": "/errors/payment-declined",


# Part B — Headers, Errors & Protection

## B1: Media Types
The service inspects the client's `Accept` header. If specified and it excludes `application/json` (and is not `*/*`), the server responds with `406 Not Acceptable`:
```json
{
  "type": "/errors/not-acceptable",
  "title": "Not acceptable",
  "status": 406,
  "detail": "Only application/json is supported"
}
```

## B2: Schema & Validation
Invalid payloads (e.g. string for `orderId`, missing `cardToken`, negative `amount`) return `400 Bad Request` containing an `errors` array of field-level details:
```json
{
  "type": "/errors/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "",
  "errors": [
    ["orderId", "required integer"],
    ["cardToken", "required string"],
    ["amount", "positive number"]
  ]
}
```

## B3: Authentication & Security
All endpoints require a Bearer token in the `Authorization` header (`Authorization: Bearer <token>`). Requests missing or sending malformed tokens return `401 Unauthorized`:
```json
{
  "type": "/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Bearer token required"
}
```

## B4: Consistent Errors
All error responses adhere to RFC 7807 problem details specifications, with standard fields: `type`, `title`, `status`, `detail`, and optional `errors`.

## B5: Rate Limiting & Throttling
Per-client IP rate limiting is applied to all incoming requests. Every response contains headers:
- `X-RateLimit-Limit`: `10`
- `X-RateLimit-Remaining`: Remaining request quota

If quota is exceeded, the server responds with `429 Too Many Requests` and header:
```
Retry-After: 60
```

## B6: Cross-Origin Resource Sharing (CORS)
The service returns CORS response headers on every response:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: Content-Type, Authorization, Accept, Idempotency-Key, If-Match, If-None-Match`
- `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`

Preflight `OPTIONS` requests receive immediate `204 No Content` responses.

## B7: Security Headers
All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains`

---

# Part C — State, Retries & Concurrency

## C1: Conditional Reads (ETag & If-None-Match)
Single-resource reads (`GET /payments/{id}`) include an `ETag` header formatted as:
```
ETag: "payment-{id}-{status}-{createdAt}"
Cache-Control: private, max-age=60
```
When a client passes `If-None-Match: "payment-1-captured-..."`, if the resource has not changed, the server responds with `304 Not Modified` without re-sending the JSON body, saving network bandwidth.

## C2: Conditional Writes (If-Match on Refund)
`POST /payments/{id}/refund` performs a state transition from `captured` to `refunded`. Clients submit `If-Match: <etag>`. If the payment was modified in the interim, the server returns `412 Precondition Failed`:
```json
{
  "type": "/errors/precondition-failed",


---

# Part D — Questions

**1. Difference between a URI, URL, and URN — provide a CampusEats Payment example of each:**

- **URI (Uniform Resource Identifier):** The overarching identifier scheme encompassing both URLs and URNs.
  - *Example:* `http://localhost:8080/payments/1` or `urn:campuseats:payment:1`
- **URL (Uniform Resource Locator):** Specifies where a resource is located and how to access/retrieve it.
  - *Example:* `http://localhost:8080/payments/1`
- **URN (Uniform Resource Name):** Identifies a resource by name in a given namespace, independent of location or protocol.
  - *Example:* `urn:campuseats:payment:txn-94021`

**2. Why does `POST /payments` return 201 Created while `POST /payments/{id}/refund` returns 202 Accepted?**

- `POST /payments` creates a new payment resource in the system. Returning `201 Created` indicates the resource creation is complete and returns its location via `Location: /payments/{id}`.
- `POST /payments/{id}/refund` initiates an asynchronous state transition (processing a refund with external banking systems). `202 Accepted` indicates the refund request has been accepted for processing, but completion/settlement may finish asynchronously.

**3. Contrast `If-None-Match` on GET with `If-Match` on POST — how does each protect client or server?**

- `If-None-Match` on `GET /payments/{id}` is a **conditional read** protecting client bandwidth. If the payment ETag matches, server returns `304 Not Modified`, saving serialization & transmission work.
- `If-Match` on `POST /payments/{id}/refund` is a **conditional write** protecting server state from lost updates. If the payment ETag has changed (another operator processed a refund or state change), server returns `412 Precondition Failed` to prevent overwriting unseen state.

**4. 422 vs 400 — exact requests and the difference:**

- `400 Bad Request`: `POST /payments` with `{"orderId": "invalid_type"}`. The request shape/syntax violates schema rules; the server rejects it before attempting processing.
- `422 Unprocessable Entity`: `POST /payments` with valid syntax (`{"orderId": 101, "cardToken": "tok_declined", "amount": 2000}`) where the card is declined by the bank. The request is well-formed, but semantic domain rules prevent execution.

**5. Browser blocked, server logs show 200 — who blocked it, which header fixes it?**

The **browser** blocked it due to Same-Origin Policy (SOP). The fix is the **`Access-Control-Allow-Origin: *`** response header set by CORS middleware, permitting browser scripts to consume cross-origin responses.

**6. One response that allows caching, one that must use no-store:**

- **Allows caching:** `GET /payments/{id}` → `Cache-Control: private, max-age=60`. Single resource representation safe for per-user caching with ETag validation.
- **Must use `no-store`:** Error bodies (`400`/`401`/`404`/`409`/`412`/`429`/`422`) and refund action results set `Cache-Control: no-store`. These represent point-in-time outcomes that must never be served stale from cache.

**7. When would the list/search endpoint be POST instead of GET, and what do you give up?**

`GET /payments` would become `POST /payments/search` if search criteria exceed URL size limits or contain sensitive financial data (e.g. multi-card hashes, complex range filters). Switching gives up cacheability, bookmarkability, and idempotency guarantees inherent to standard HTTP `GET`.

**8. `Location` on a 201 vs. on a 3xx:**

- On `201 Created` (`POST /payments`), `Location` points to the **newly created resource** (`/payments/{id}`).
- On a `3xx` redirect, `Location` points to a **different target resource** where the client should re-issue its request.

  "title": "Payment was modified since you last read it",
  "status": 412,
  "detail": "Payment has changed since you last read it; GET it again and retry with the new ETag"
}
```

## C3: Idempotent Retry Strategy
Clients include an `Idempotency-Key` header on `POST /payments`. If a request with the same `Idempotency-Key` is received again (e.g. network timeout retry), the Payment Service looks up the prior payment in its store and returns `200 OK` with the original payment payload, avoiding duplicate charges.

  "title": "Payment declined",
  "status": 422,
  "detail": "Card declined by bank"
}
```
