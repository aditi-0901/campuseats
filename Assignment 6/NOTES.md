# CampusEats — Order Service — Assignment 6 Notes

**Team ID:** Group 7

| Role | Name | Roll No |
|---|---|---|
| Group Leader | Aditi Garg | 20251651008 |
| Group Member | Neha Nupur | 20251651064 |
| Group Member | Shivam Kumar Soni | 20251651084 |

Built on **Assignment 5's Order Service** — same service, no new one. This
file covers all four parts (A, B, C, D) and the seven answers.

---

## What changed in this submission

| Part | Change | Where |
|---|---|---|
| **A2** | `DELETE /orders/{id}` returned `204` but never removed anything — a status that lied about the result. It now really deletes; a follow-up `GET` and a repeat `DELETE` are both `404`. | `app.js`, `store.js` (`remove`) |
| **A4** | `503 payments-unavailable` had no `Retry-After`. Now `Retry-After: 30`. (`429` already had `60`.) | `app.js` |
| **B1** | An unknown path or wrong method was answered by Express's own **HTML** page — not Problem Details. Now `404 route-not-found` / `405 method-not-allowed` (+ `Allow`). | `app.js`, `errors.js` |
| **B1** | `401` now carries `WWW-Authenticate: Bearer`. | `app.js` |
| **B1/C4** | Security + CORS headers moved above the body parser, so even a parse-failure response carries them. | `app.js` |
| **B2** | Catalogue gained `route-not-found`, `method-not-allowed`, `payload-too-large`. | `errors.js`, `openapi.yaml` |
| **B4** | Oversized body is a clean `413` (was falling into the generic handler); the `500` catch-all is now proven by a fault-injection test and a live capture. | `app.js`, tests, transcript |
| **Docs** | `openapi.yaml` rewritten with shared error responses; 13 new tests (30 total); transcript regenerated live (29 responses). | — |

Everything from Parts C and D stays as submitted, re-verified on this build.

### Why the examples don't match the assignment's wording literally

The assignment's examples assume a **multi-item cart with a delivery
address** (`empty-cart`, `item-unavailable`, "items non-empty … address
required"). CampusEats' `POST /orders` has never had that shape: it takes
`studentId`, `itemId`, `qty`, `paymentMethodId` — one line item per order,
no cart array, no address anywhere in `models.js` or `openapi.yaml`, and no
live inventory check against the Catalogue Service at order time. Rather
than invent features nobody built, every part below uses CampusEats' real
fields and real failures, and says explicitly where it maps to the
assignment's wording. Likewise the assignment's `PATCH`: CampusEats has no
`PATCH /orders` — its one state change is `POST /orders/{id}/cancel`.

---

# Part A — Status codes

## A1: Map every outcome

See **Answer 1** for the full table. In one line each: `POST /orders` →
`201`; `GET /orders` and `GET /orders/{id}` → `200`; `DELETE /orders/{id}` →
`204`; `POST /orders/{id}/cancel` → `202`. Every failure has its own
specific `4xx`/`5xx`, never a generic one.

## A2: Fix responses (if any)

Audit of every handler for "a 2xx that really is a failure":

| Check | Result |
|---|---|
| Any `200` carrying `{ "ok": false }`-style failure bodies? | **None.** Every failure goes through `problem()` and a `4xx`/`5xx`. |
| `POST /orders` replay returns `200` — a hidden failure? | **No.** It is a deliberate dedup result: the order exists, nothing was charged twice. Documented in `openapi.yaml`. |
| `GET /orders/{id}` → `304` | Not a failure — a cache hit. |
| `DELETE /orders/{id}` → `204` | **Was a lie.** It answered `204` while the order still existed. **Fixed** (`store.remove`). |

After the fix, `204` means the order is gone: `GET` → `404`, repeat
`DELETE` → `404 order-not-found`. Proven by test
(`A2: DELETE really deletes …`) and live (transcript **D2-o**). A second
test (`A2: no failure is ever answered with a 2xx`) loops over five
different failures and asserts each is `>= 400` and none has an `ok` field.

## A3: Set Location on create

`POST /orders` → `201 Created` with `Location: /orders/{id}` pointing at the
new order — test `create order returns 201 with Location header`; live in
transcript **D1-a** (`Location: /orders/1`).

## A4: Retry-safety

- `429 rate-limit-exceeded` → `Retry-After: 60`.
- `503 payments-unavailable` → `Retry-After: 30` (**added**).
- `4xx` client errors never carry `Retry-After` — retrying them unchanged is
  pointless (test `A4: 4xx client errors never carry Retry-After`).
- Which endpoints are safe to retry: **Answer 5**.

---

# Part B — One error shape

## B1: Standardise on Problem Details

Every failure — including ones Express would otherwise answer itself —
goes through one helper, `problem()` in `errors.js`:
`type` / `title` / `status` / `detail` [/ `errors`], with
`Content-Type: application/problem+json; charset=utf-8` and
`Cache-Control: no-store`. The paths that previously escaped it are now
covered: unknown route (`404`), wrong method (`405` + `Allow`), body-parser
failures (`400`/`413`), and the final catch-all (`500`). One test sends
eleven different failures and asserts every one has the same four keys, the
right content type, and a body `status` equal to the HTTP status
(`B1: every failure path answers with the same Problem Details shape`).

## B2: Type catalogue

Stable strings, documented in **Answer 2** and enumerated in the
`Problem.type` schema in `openapi.yaml`. From the assignment's example list
we keep `payment-declined`, `order-not-found`, `illegal-transition`. We do
**not** include `empty-cart` or `item-unavailable` — see the explanation at
the top.

## B3: Field-level validation errors

Validation failures are one `422` with `errors[]` of `{field, reason}`;
**Answer 4** shows two bad fields at once. (`GET /orders` query problems
use the same `errors[]` shape under `400 invalid-query`.)

## B4: Don't leak internals

Three layers, all in `app.js`: the payments `try/catch` (→ clean `503`), the
body-parser mapping (→ `400`/`413`), and the final error handler (→ clean
`500`, real error + stack logged server-side). Details in **Answer 6**.

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

Invalid → one `422` with every bad field listed in `errors[]` (see Answer 4 for
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
is enough; see Answer 7 for the live JSON-vs-XML comparison.

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
- **Every** error response goes through the same `problem()` helper,
  which sets `Content-Type: application/problem+json; charset=utf-8` — B1. Confirmed in
  `orders.test.js` (`"every Problem Details body is served as
  application/problem+json (B1)"`) and visible on every error response in
  `transcript.txt`.

---

---

# Part D — Prove it with curl

All evidence is in `transcript.txt`, captured live against the real
service and the dummy bank (`curl -i`, every status + body).

| Req | Sections | What it shows |
|---|---|---|
| **D1** Success | D1-a, D1-b | `POST /orders` → `201` + `Location` + JSON body; same `Idempotency-Key` again → `200`, original order, nothing re-charged |
| **D2** Failures | D2-a … D2-o | every row of the table below |
| **D3** Negotiation | D3-c, D3-d, D3-e | `Accept: application/xml` → XML; `application/json` → JSON; `text/html` → `406` |
| **D4** No regressions | D3-a/b, D4 | idempotency replay and `304` re-demonstrated live; full suite re-run: **30/30** |

| Section | Failure driven | Status |
|---|---|---|
| D2-a | Two bad fields at once (`studentId` wrong type, `qty` ≤ 0) | `422` |
| D2-b | Two missing fields at once | `422` |
| D2-c | Body that isn't valid JSON | `400` |
| D2-d | Unknown order id | `404` |
| D2-e | Card declined by the bank | `422` |
| D2-f | Missing Bearer token (+ `WWW-Authenticate`) | `401` |
| D2-g | Cancel an already-cancelled order (illegal transition) | `409` |
| D2-h | Cancel with a stale `If-Match` | `412` |
| D2-i | 11th request in a window | `429` + `Retry-After: 60` |
| D2-j | Unknown route | `404` |
| D2-k | Wrong method on a real path (+ `Allow`) | `405` |
| D2-l | Payments provider down | `503` + `Retry-After: 30` |
| D2-m | 200 KB request body | `413` |
| D2-n | Unexpected exception (fault injected) | `500`, internals hidden |
| D2-o | `DELETE` really deletes | `204` → `404` → `404` |

The assignment's own list — "empty cart, qty ≤ 0, unknown id, illegal
transition, rate limit" — is covered with CampusEats' real equivalents:
there is no cart, so `qty ≤ 0` is the nearest domain-rule failure.

**Restarts.** The service is restarted between some groups (noted inline in
the transcript) purely to give each demo a clean 10-request rate-limit
budget — the budget is in-memory, so a fresh process is a fresh budget.
D2-l runs with the dummy bank stopped; D2-n runs with a fault injected
(`store.create()` made to throw a database-looking error), because an
unexpected exception can't be triggered by a normal request.

**D4 — regression.** `orders.test.js` carries all of Assignment 5's checks
(idempotency replay, `304`, `If-Match`/`412`, 409) plus Assignment 6's:
`jest-output.txt` → **30/30 passed**. Earlier in this assignment we also
found and fixed one real regression: the rate limiter's in-memory map never
reset between tests, causing spurious `429`s; `app._resetRateLimit()` now
runs in `beforeEach`.

---

# Answers

**1. Status map — every endpoint, its success status, and each failure (and why).**

| Endpoint | Success | Failures — and why |
|---|---|---|
| `POST /orders` | `201` + `Location` | `200` idempotent replay (not a failure: the order already exists, nothing re-charged) · `400 malformed-json` body can't be parsed at all · `401 unauthorized` no/bad Bearer token · `406 not-acceptable` Accept matches neither JSON nor XML · `413 payload-too-large` body over the size limit · `422 validation-failed` parsed fine but failed field checks · `422 payment-declined` valid request, bank said no (same status as above, different `type`) · `429 rate-limit-exceeded` client over budget · `500 internal-error` unexpected fault on our side · `503 payments-unavailable` provider unreachable after retries |
| `GET /orders` | `200` | `400 invalid-query` bad/out-of-range query params, all listed together · `401` · `429` · `500` |
| `GET /orders/{id}` | `200` (JSON or XML) | `304` cache hit (`If-None-Match` matched) · `401` · `404 order-not-found` · `406` · `429` · `500` |
| `DELETE /orders/{id}` | `204` (really deleted) | `401` · `404 order-not-found` (also on a repeat delete) · `429` · `500` |
| `POST /orders/{id}/cancel` | `202` | `401` · `404 order-not-found` · `409 illegal-transition` order isn't `placed` · `412 precondition-failed` stale `If-Match` · `429` · `500` |
| `OPTIONS /orders` | `204` | — (metadata only) |
| *any other path* | — | `404 route-not-found` no such endpoint · `405 method-not-allowed` real path, unsupported verb (+ `Allow`) |

**2. Type catalogue — the stable string for each failure and what triggers it.**

| Type (`/errors/…`) | Status | Triggered by |
|---|---|---|
| `malformed-json` | 400 | `POST /orders` body `express.json()` cannot parse |
| `validation-failed` | 422 | body parses but fails one or more field checks |
| `invalid-query` | 400 | `GET /orders` with an unparseable/out-of-range parameter |
| `payment-declined` | 422 | the bank rejects the charge (`tok_declined`) |
| `order-not-found` | 404 | `GET` / `DELETE` / `cancel` on an id that doesn't exist |
| `illegal-transition` | 409 | cancel on an order whose status isn't `placed` |
| `precondition-failed` | 412 | `If-Match` on cancel doesn't match the current ETag |
| `not-acceptable` | 406 | `Accept` matches neither `application/json` nor `application/xml` |
| `unauthorized` | 401 | missing/malformed `Authorization: Bearer …` |
| `rate-limit-exceeded` | 429 | per-client budget (10 / window) exceeded |
| `payments-unavailable` | 503 | payments provider unreachable after 3 attempts |
| `payload-too-large` | 413 | request body over the size limit *(new)* |
| `route-not-found` | 404 | path that no endpoint serves *(new)* |
| `method-not-allowed` | 405 | known path, unsupported method *(new)* |
| `internal-error` | 500 | anything unexpected — the catch-all's last resort |

`empty-cart` and `item-unavailable` (from the assignment's example list) are
deliberately absent: an order is one line item so it can't be an "empty
cart", and this service never checks live Catalogue inventory before
charging — that integration doesn't exist in this project.
`illegal-transition` replaces Assignment 5's `state-conflict`.

**3. One Problem Details body, fields labelled.**

From transcript **D2-d** (`GET /orders/999`):

```json
{
  "type": "/errors/order-not-found",
  "title": "Order not found",
  "status": 404,
  "detail": "No order 999"
}
```

- `type` — the stable machine-readable slug from the catalogue; clients branch on this, never on `detail`.
- `title` — short human-readable summary; identical for every `order-not-found`.
- `status` — the HTTP status repeated in the body, so a consumer that only logs bodies still has it.
- `detail` — the one thing specific to *this* request (which id was missing).

Field-level failures add a fifth key, `errors[]` (Answer 4).

**4. A field-level 422 reporting two bad fields at once.**

Transcript **D2-a** — `POST /orders` with
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

`studentId` (wrong type) and `qty` (out of range) arrive in one response
because `validateOrderRequest()` runs every check before returning instead
of stopping at the first failure (C2). It also runs before any payment call
— a request that fails validation never reaches the bank (asserted in the
tests).

**5. Which endpoints are safe to retry, and which status codes tell a client so?**

| Endpoint | Safe to retry? | Why / how |
|---|---|---|
| `GET /orders`, `GET /orders/{id}`, `OPTIONS /orders` | **Yes, always** | read-only |
| `DELETE /orders/{id}` | **Yes** | the end state is the same; a retry after success gets `404` — the client should read that as "already done" |
| `POST /orders` | **Yes, with `Idempotency-Key`** | the same key returns the original order (`200`) instead of creating and charging again; **without** a key it is *not* safe |
| `POST /orders/{id}/cancel` | **Yes, with `If-Match`** | a retry after success finds the order already cancelled → `409`, not a second cancel |

Status codes that **tell the client a retry is reasonable** — transient
only:

- `429` — you are over budget; retry after `Retry-After` (60 s).
- `503` — the dependency is down; retry after `Retry-After` (30 s), with the same `Idempotency-Key`.

Status codes that mean **do not retry unchanged**: `400`, `401`, `404`,
`405`, `406`, `409`, `412`, `413`, `422` — the request itself is wrong, so
resending it can't succeed. `500` says nothing either way: retry only the
safe/idempotent requests above.

*Known limit (carried over from Assignment 5, not new):* the service's own
call to the bank uses a fresh internal idempotency key per client request.
So if the bank captured a charge but every reply timed out, a later client
retry could charge again. Deriving the bank's key from the client's
`Idempotency-Key` would close that; we kept Assignment 5's design and are
noting it rather than hiding it.

**6. Where did you map an internal error to a clean client error, and what did you hide?**

Three places, all in `app.js`, each proven by a test **and** a live capture:

1. **Payments failure → `503`** (the `catch` around `chargeWithRetry()`;
   transcript **D2-l**). The client gets a fixed message —
   *"The payments provider is currently unavailable. Please try again
   shortly."* — plus `Retry-After`. **Hidden:** the internal failure text
   and anything a transport error can carry (host, port,
   connection-refused/timeout wording). Through the real client that text is
   `Gave up after 3 attempts` (and `connect ECONNREFUSED 127.0.0.1:8080`
   would surface if the retry wrapper ever changed); the transcript shows
   the server log recording it while the response body stays generic. The
   sibling `CardDeclined` branch is deliberately passed through unchanged —
   that message is the bank's reason about the caller's *own card*, not
   about CampusEats' internals.
2. **Anything unexpected → `500`** (the final error handler; transcript
   **D2-n**). With `store.create()` made to throw
   `SQLITE_ERROR: no such table: orders (at /srv/campuseats/db.js:42)`, the
   client receives only `{"type":"/errors/internal-error", … "detail":
   "Something went wrong on our end."}`. **Hidden:** the database error
   text, the table name, the file path and line number, and the whole stack
   trace — all logged server-side only. The test
   (`B4: an unexpected exception becomes a clean 500`) asserts none of
   `SQLITE`, `no such table`, a file path or a stack frame appears in the
   response, *and* that the real error was logged.
3. **Body-parser failures → `400` / `413`** (transcripts **D2-c**,
   **D2-m**). **Hidden:** the parser's own error object (its message
   quotes the offending JSON position and an internal stack); an oversized
   body no longer falls through to a `500`.

**7. (Done) The same order as JSON and as XML, and the Accept header that chose each.**

Transcript **D3-c/D3-d** (same order, `id: 1`):

`Accept: application/json` → `Content-Type: application/json; charset=utf-8`

```json
{"id":1,"studentId":101,"itemId":5,"qty":2,"status":"placed","createdAt":"2026-10-07T19:45:20.288Z"}
```

`Accept: application/xml` → `Content-Type: application/xml; charset=utf-8`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<order>
  <id>1</id>
  <studentId>101</studentId>
  <itemId>5</itemId>
  <qty>2</qty>
  <status>placed</status>
  <createdAt>2026-10-07T19:45:20.288Z</createdAt>
</order>
```

No `Accept` header at all (curl's default `*/*`) also returns JSON — the
documented default. `Accept: text/html` → `406 not-acceptable` (**D3-e**).

---

## Files

| File | Purpose |
|---|---|
| `app.js`, `errors.js`, `validation.js`, `representation.js`, `models.js`, `store.js`, `paymentsClient.js`, `dummy_bank.js` | the service (built on Assignment 5) |
| `openapi.yaml` | contract: status codes, `Retry-After`/`Allow`/`WWW-Authenticate`/`Location` headers, and the Problem Details schema with the type catalogue (validated — `openapi-validation.txt`) |
| `orders.test.js` / `jest-output.txt` | 30 tests, all passing |
| `transcript.txt` | live `curl -i` capture: success, every failure, negotiation, regression |
| `NOTES.md` | this file |
| `package.json` | dependencies and `npm test` |
