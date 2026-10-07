# CampusEats — Order Service — Assignment 6 Notes

**Team ID:** Group 7

| Role | Name | Roll No |
|---|---|---|
| Group Leader | Aditi Garg | 20251651008 |
| Group Member | Neha Nupur | 20251651064 |
| Group Member | Shivam Kumar Soni | 20251651084 |

Built on top of **Assignment 5**'s Order Service — same service, no new one.
Assignment 5's own Part A/B design (method map, safe/idempotent split,
headers) is unchanged and is not repeated here; see that submission's
`NOTES.md` for it. This file covers what Assignment 6 adds.

---

## Note on scope

This submission completes **Part C (Request validation & formats)** and
**Part D (Prove it with curl)**, which is what was asked for. Two pieces of
Part A/B are touched anyway, because the Part C/D requirements depend on
them directly and the eight questions below ask about them by name:

- **B1** (`Content-Type: application/problem+json` on every failure) —
  Part C's 422 is a Problem Details body; it has to be served with the
  right content type for C4 ("Content-Type on every response, errors
  included") to actually be true.
- **B4** (don't leak internals) — directly asked about in Q6 below, and a
  real instance of it (the payments-outage path) was found while building
  Part C's error handling; fixing it is a two-line change, documented in
  Part C below.

Nothing else from Part A/B was touched. The status codes, the method map,
and the safe/idempotent analysis are exactly what Assignment 5 already
submitted.

### Why Part C doesn't literally follow the assignment's own wording

The assignment's own example for C1 is "items non-empty; each qty an
integer >= 1; address required" — a multi-item cart with a delivery
address. **CampusEats' Order Service has never had that shape, in this or
any prior assignment**: `POST /orders` takes `studentId`, `itemId`, `qty`,
`paymentMethodId` — one line item per order, no cart array, no address
field anywhere in `models.js` or `openapi.yaml`. Rather than inventing a
cart/address system that doesn't exist anywhere else in this project, Part
C below validates the fields CampusEats' Order Service actually has, with
each check commented against the assignment's own example so the mapping
is explicit (see `validation.js`). The same principle applies to B2's type
catalogue (Q2) and to C3's XML negotiation (applied to the one order
resource that exists, not an invented cart resource).

---

# Part C — Request validation & formats

## C1: Describe the body

`POST /orders`' body is described as explicit checks in `validation.js`
(the assignment allows either a JSON Schema or explicit checks; explicit
checks were chosen to match how Assignment 4/5 already validate bodies in
this project):

```js
function validateOrderRequest(body) {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        return [{ field: "(body)", reason: "request body must be a JSON object" }];
    }
    const errors = [];
    if (!Number.isInteger(body.studentId)) errors.push({ field: "studentId", reason: "required integer" });
    if (!Number.isInteger(body.itemId)) errors.push({ field: "itemId", reason: "required integer" });
    if (!Number.isInteger(body.qty) || body.qty < 1) errors.push({ field: "qty", reason: "required integer, minimum 1" });
    if (typeof body.paymentMethodId !== 'string' || !body.paymentMethodId.trim()) errors.push({ field: "paymentMethodId", reason: "required non-empty string" });
    return errors;
}
```

| Assignment's generic example | CampusEats' actual field | Why |
|---|---|---|
| `items` non-empty | `itemId` required integer | CampusEats orders are one line item each; "non-empty" becomes "an item was actually named" |
| each `qty` integer ≥ 1 | `qty` integer ≥ 1 | Identical requirement, verbatim |
| `address` required | `paymentMethodId` required, non-empty | No delivery-address field exists anywhere in this project; `paymentMethodId` is the one required, non-derivable identifier `POST /orders` actually carries |

`studentId` (required integer) has no equivalent in the assignment's
example and is included because it is required by the Order model itself
(`models.js`) — every order belongs to exactly one student.

## C2: Validate, then act

`validateOrderRequest()` always runs **every** check — it never returns on
the first failure — and `app.js`'s `POST /orders` handler calls it, and
checks the result, **before** touching `store.js` or calling
`paymentsClient.chargeWithRetry()`:

```js
const errs = validateOrderRequest(req.body);
if (errs.length > 0) {
    return problem(res, 422, "validation-failed", "The request body failed validation.", errs);
}
// ... only now: idempotency check, payment charge, store.create() ...
```

Invalid → one `422` with every bad field listed in `errors[]` (see Q4 for
a live two-field example). Valid → proceed. This also means a request that
fails validation **never reaches the payments call** — confirmed in
`orders.test.js` (`expect(paymentsClient.chargeWithRetry).not.toHaveBeenCalled()`
on both new validation tests).

## C3: Content negotiation

`GET /orders/{id}` honours `Accept`:

- `application/json`, or no `Accept` at all, or a wildcard that matches
  anything → `application/json` (the documented default).
- `application/xml` with no JSON alternative also accepted → an XML
  representation of the same order, built in `representation.js`.
- Anything else → `406 Not Acceptable` (this was already true from
  Assignment 5's B1; Assignment 6 only widens the accepted set from
  `{json}` to `{json, xml}`).

```js
function wantsXmlOnly(req) {
    const accept = req.headers.accept || '';
    return accept.includes('application/xml') && !accept.includes('application/json') && !accept.includes('*/*');
}
```

No XML library was added — the Order representation is five flat fields,
so a small hand-written serializer (`orderToXml()` in `representation.js`)
is enough; see Q7 for the live JSON-vs-XML comparison.

*Simplification acknowledged:* both representations are served under the
same `ETag` (computed from the order's state, not its serialised bytes).
A fully by-the-book implementation would vary the ETag per
representation and advertise that with `Vary: Accept` (which this service
does set) *and* per-format ETags; the single shared ETag was kept because
it still correctly identifies "this version of this order" regardless of
which format the caller asked for, and `If-None-Match`/`If-Match` are only
ever exercised against the JSON representation in this service's own
flows (C1/C2 of Assignment 5).

## C4: Label every body

`res.json()` (Express) sets `Content-Type: application/json; charset=utf-8`
by default — already true since Assignment 5. What Assignment 6 adds:

- XML responses are sent via `res.type('application/xml; charset=utf-8')`
  explicitly (`representation.js`).
- **Every** error response now goes through the same `problem()` helper,
  which sets `Content-Type: application/problem+json; charset=utf-8`
  (previously plain `application/json`) — B1. Confirmed in
  `orders.test.js` (`"every Problem Details body is served as
  application/problem+json (B1)"`) and visible on every error response in
  `curl-transcript.txt`.

---

# Part D — Prove it with curl

## D1: Success transcript

`curl-transcript.txt`, sections **D1-a** and **D1-b**: a `POST /orders`
that returns `201` with `Location: /orders/1` and the full JSON body, then
the identical request repeated with the same `Idempotency-Key` returning
`200` with the *original* order (same `id`, same `createdAt`) — proof
nothing was created twice.

## D2: Failure transcript

`curl-transcript.txt`, sections **D2-a** through **D2-i**, in order:

| Section | Failure driven | Status |
|---|---|---|
| D2-a | Two bad fields at once (`studentId` wrong type, `qty` ≤ 0) | `422` |
| D2-b | Two missing fields at once (`itemId`, `paymentMethodId`) | `422` |
| D2-c | Body that isn't valid JSON at all | `400` |
| D2-d | Unknown order id | `404` |
| D2-e | Card declined by the bank | `422` |
| D2-f | Missing Bearer token | `401` |
| D2-g | Cancelling an already-cancelled order | `409` |
| D2-h | Cancel with a stale `If-Match` | `412` |
| D2-i | Per-client budget exceeded (11th request in a window) | `429` with `Retry-After: 60` |

*(The assignment's own list — "empty cart, qty ≤ 0, unknown id, illegal
transition, rate limit" — is covered above with CampusEats' real
equivalents: there is no cart to be empty, so `qty ≤ 0` doubles as the
nearest valid-body domain-rule failure this service actually has.)*

A few sections in the transcript restart the service first (noted inline,
right above those sections). That's purely to give the per-client
rate-limit budget (B5, Assignment 5) a clean slate for each demo — the
budget is in-memory per process, so a fresh process is a fresh budget, the
same reset any real restart already gives every other piece of in-memory
state (`store.js`'s own `_reset()` does the same job for tests). Without
those restarts, the 10-request budget spent by the earlier sections in the
same run would make `D2-i`'s dedicated rate-limit demo (and everything
after it) show `429` instead of the status each section is actually
demonstrating.

## D3: Negotiation check

`curl-transcript.txt`, sections **D3-c**/**D3-d**: `GET /orders/1` with
`Accept: application/xml` returns the order as XML; the same request with
`Accept: application/json` (or no `Accept` override) returns it as JSON.
Section **D3-e**: `Accept: text/html` — a type this service cannot
produce — returns `406`.

## D4: No regressions

Re-ran `orders.test.js` (Assignment 5's checks plus the new Assignment 6
ones) — `jest-output.txt`: **17/17 passed**, including the Idempotency-Key
replay (`same idempotency key returns original 200`) and both ETag/timeout
checks (`conditional GET returns 304`, `conditional cancel is rejected
with 412 on a stale If-Match`).

**One real regression was found and fixed while doing this:** the rate
limiter's in-memory `Map` was never cleared between test runs (unlike
`store.js`, which already had `_reset()`). A long enough test file —
Assignment 6 added nine new tests on top of Assignment 5's eight — started
tripping spurious `429`s from budget that earlier, unrelated tests had
already spent, failing the two `If-Match` tests with the wrong status
code. Fixed by adding the equivalent hook, `app._resetRateLimit()`, called
from `orders.test.js`'s `beforeEach` alongside the existing
`store._reset()`.

---

# Answers

**1. Status map: every endpoint, its success status, and the status for
each failure — why.**

| Endpoint | Success | Failures (why) |
|---|---|---|
| `POST /orders` | `201` (new order) | `200` idempotent replay — not a failure, a deliberate dedup result; `400` malformed-json — body could not be parsed at all, before validation even runs; `401` unauthorized — no/bad Bearer token; `406` not-acceptable — Accept matches neither json nor xml; `422` validation-failed — parsed fine, failed field checks (C1/C2); `422` payment-declined — valid request, bank said no (a domain-meaning failure, same status as validation-failed but a different `type`); `429` rate-limit-exceeded — per-client budget spent; `503` payments-unavailable — payments provider unreachable after retries |
| `GET /orders` | `200` (list) | `400` invalid-query — unparseable/out-of-range query params, all reported together; `401` unauthorized |
| `GET /orders/{id}` | `200` (JSON or XML, C3) | `304` not-modified — If-None-Match matched (not really a failure, a cache hit); `401` unauthorized; `404` order-not-found; `406` not-acceptable |
| `DELETE /orders/{id}` | `204` | `401` unauthorized; `404` order-not-found |
| `POST /orders/{id}/cancel` | `202` (cancellation accepted) | `401` unauthorized; `404` order-not-found; `409` illegal-transition — order isn't in a cancellable state; `412` precondition-failed — stale `If-Match` |
| `OPTIONS /orders` | `204` | *(none — metadata only)* |

**2. Type catalogue: the stable string for each failure and what triggers it.**

| Type string | Triggered by |
|---|---|
| `malformed-json` | `POST /orders` body that `express.json()` cannot parse at all |
| `validation-failed` | `POST /orders` body that parses but fails one or more field checks (C1) |
| `invalid-query` | `GET /orders` with an unparseable/out-of-range query parameter |
| `payment-declined` | The dummy bank rejects the charge (`cardToken === "tok_declined"`) |
| `order-not-found` | `GET`/`DELETE`/`cancel` on an id that doesn't exist |
| `illegal-transition` | `POST /orders/{id}/cancel` on an order that isn't `"placed"` |
| `precondition-failed` | `If-Match` on cancel doesn't match the order's current ETag |
| `not-acceptable` | `Accept` matches neither `application/json` nor `application/xml` |
| `unauthorized` | Missing or malformed `Authorization: Bearer ...` |
| `rate-limit-exceeded` | Per-client request budget (10/window) exceeded |
| `payments-unavailable` | Payments provider unreachable after `chargeWithRetry`'s 3 attempts |
| `internal-error` | Anything genuinely unexpected (the catch-all handler's last resort, B4) |

Two strings from the assignment's own example list — `empty-cart` and
`item-unavailable` — are **not** in this catalogue, deliberately: there is
no cart (an order is one line item, so it can't be "empty" in the way a
multi-item cart can), and this service never checks live Catalogue Service
inventory before charging (that integration doesn't exist in this project;
inventing it would be assuming a feature nobody built). `illegal-transition`
replaces Assignment 5's `state-conflict` to match the assignment's own
vocabulary for the same 409 case.

**3. One Problem Details body, fields labelled.**

From `curl-transcript.txt`, section D2-d (`GET /orders/999`):

```json
{
  "type": "/errors/order-not-found",
  "title": "Order not found",
  "status": 404,
  "detail": "No order 999"
}
```

- `type` — the stable, machine-readable slug from the catalogue above (Q2); a client can branch on this without parsing `detail`.
- `title` — a short, human-readable summary of the `type`, same for every `order-not-found`.
- `status` — the HTTP status again, duplicated in the body so a consumer that only logs response bodies (not headers) still has it.
- `detail` — the one thing specific to *this* request: which id was missing.

(Field-level failures add a fifth key, `errors[]` — see Q4.)

**4. A field-level 422 that reports two bad fields at once.**

From `curl-transcript.txt`, section D2-a — `POST /orders` with
`{"studentId":"not-an-int","itemId":5,"qty":-3,"paymentMethodId":"tok_good"}`:

```json
{
  "type": "/errors/validation-failed",
  "title": "Request failed validation",
  "status": 422,
  "detail": "The request body failed validation.",
  "errors": [
    { "field": "studentId", "reason": "required integer" },
    { "field": "qty", "reason": "required integer, minimum 1" }
  ]
}
```

Both `studentId` (wrong type) and `qty` (out of range) are reported in the
same response, from the same request, because `validateOrderRequest()`
checks every field before returning rather than stopping at the first
failure (C2). Covered by its own test: `"C2: two bad fields in one
request are BOTH reported in a single 422"`.

**5. Which endpoints are safe to retry, and which status codes tell a client so?**

Unchanged from Assignment 5's A3/C4 (not re-derived here, since that
analysis already covers it): `GET /orders`, `GET /orders/{id}` and
`OPTIONS /orders` are safe outright. `DELETE /orders/{id}` is idempotent
by construction. The two endpoints that are genuinely neither safe nor
idempotent — `POST /orders` and `POST /orders/{id}/cancel` — are each made
retry-safe by a different mechanism: `Idempotency-Key` for the former,
`If-Match` for the latter (Assignment 5, C3/C2).

What Assignment 6 adds to this picture: `429` and `503` are the two status
codes that specifically *tell* a client a retry is reasonable — `429`
(with `Retry-After`) means "you, specifically, are over budget right now,
try again after that many seconds"; `503` means "the dependency is down,
try again shortly" (payments-unavailable). Neither code appears for a
request that was wrong on its own terms — `400`, `422` and `404` are never
retried unchanged, because retrying an already-known-bad request changes
nothing (the same principle Assignment 4's `order_client.py` already
applied to *outbound* retries, now true of what this service tells its
*own* callers too).

**6. Where did you map an internal error to a clean client error, and what did you hide from the caller?**

`app.js`'s `POST /orders` handler, in the `catch` block around
`paymentsClient.chargeWithRetry()`. Before Assignment 6, a payments outage
returned `problem(res, 503, "payments-unavailable", error.message)` —
and `error.message` for a `PaymentsUnavailable` thrown from
`paymentsClient.js`'s `_post()` can be the raw axios transport error, e.g.
`"connect ECONNREFUSED 127.0.0.1:8080"` — which tells any caller the
payments provider's literal host and port. Fixed to:

```js
console.error(`[orders] payments call failed (student ${req.body.studentId}, item ${req.body.itemId}): ${error.message}`);
return problem(res, 503, "payments-unavailable",
    "The payments provider is currently unavailable. Please try again shortly.");
```

**Hidden from the caller:** the raw transport error — hostname, port,
connection-refused/timeout wording, and anything else axios' error message
happens to contain. **Logged server-side instead**, so the actual cause is
still available for debugging. Covered by its own test (`"B4: a payments
outage never leaks the raw transport error to the client"`, asserting the
response `detail` contains neither `ECONNREFUSED` nor the IP). The
`CardDeclined` branch right above it is deliberately *not* changed —
`error.message` there is the bank's own decline reason, which is
information about the caller's card, not about CampusEats' internals, so
it's safe (and useful) to pass straight through.

**7. (If done) Same order as JSON and XML, and the Accept header that chose each.**

From `curl-transcript.txt`, sections D3-c/D3-d (same order, `id: 1`):

`Accept: application/json` →

```json
{"id":1,"studentId":101,"itemId":5,"qty":2,"status":"placed","createdAt":"2026-10-07T18:35:15.334Z"}
```

`Accept: application/xml` →

```xml
<?xml version="1.0" encoding="UTF-8"?>
<order>
  <id>1</id>
  <studentId>101</studentId>
  <itemId>5</itemId>
  <qty>2</qty>
  <status>placed</status>
  <createdAt>2026-10-07T18:35:15.334Z</createdAt>
</order>
```

No `Accept` header at all (curl's default `Accept: */*`) also returns
JSON — the documented default (C3).

---

## Files

- `app.js`, `errors.js`, `validation.js`, `representation.js`, `models.js`,
  `store.js`, `paymentsClient.js`, `dummy_bank.js` — implementation
  (`validation.js` and `representation.js` are new in Assignment 6;
  everything else is Assignment 5's, with the changes this file documents)
- `openapi.yaml` — updated contract (validated with
  `openapi-spec-validator`, see `openapi-validation.txt`): `application/problem+json`
  on every error response, the `errors[]` object shape, `application/xml`
  on `GET /orders/{id}`, and the renamed `illegal-transition` type
- `orders.test.js` — 17 tests (8 carried from Assignment 5, 9 new for Part
  C/B1/B4); see `jest-output.txt`
- `curl-transcript.txt` — full `curl -i`/`-v` transcript: D1's success
  path, every D2 failure, D3's negotiation check, and the one full `-v`
  exchange
