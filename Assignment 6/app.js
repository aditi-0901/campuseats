const express = require('express');
const store = require('./store');
const paymentsClient = require('./paymentsClient');
const { problem } = require('./errors');
const { validateOrderRequest, validateListQuery } = require('./validation');
const { sendOrder } = require('./representation');

const PAYMENTS_RETRY_AFTER_SECONDS = 30;

const app = express();

// ===============================
// Headers that belong on EVERY response — errors included (C4/B1).
// These sit above express.json() on purpose: if body-parser rejects a
// request (malformed JSON, body too large) it answers from the error
// handler at the bottom, and that response must still carry nosniff,
// HSTS and CORS exactly like any other.
// ===============================
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Documents intent for production; this dev server itself runs on plain HTTP.
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Accept, Idempotency-Key, If-Match, If-None-Match'
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

    // /orders has its own OPTIONS handler below that sets a resource-specific
    // Allow header (A5); everything else gets a generic CORS preflight reply.
    if (req.method === 'OPTIONS' && req.path !== '/orders') {
        return res.status(204).send();
    }
    next();
});

app.use(express.json());

app.use((req, res, next) => {
    const accept = req.headers.accept;

    // C3: accept both representations this service can actually produce.
    if (
        accept &&
        !accept.includes('application/json') &&
        !accept.includes('application/xml') &&
        !accept.includes('*/*')
    ) {
        return problem(
            res,
            406,
            "not-acceptable",
            "This service can produce application/json or application/xml."
        );
    }

    next();
});

function etagFor(o) {
    return `"order-${o.id}-${o.status}-${o.createdAt}"`;
}

// ===============================
// B5: Rate Limiting
// ===============================
const rateLimit = new Map();

function rateLimiter(req, res, next) {
    const client = req.ip || 'unknown';
    const limit = 10;

    let remaining = rateLimit.has(client)
        ? rateLimit.get(client)
        : limit;

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(remaining - 1, 0)
    );

    if (remaining <= 0) {
        res.setHeader('Retry-After', '60');

        return problem(
            res,
            429,
            "rate-limit-exceeded",
            "Too many requests"
        );
    }

    rateLimit.set(client, remaining - 1);
    next();
}

// Test-only hook: Assignment 5's rate limiter never reset between tests,
// so a long test file (or two full curl runs back to back) would start
// seeing spurious 429s from budget that earlier, unrelated requests had
// already spent — found while re-running the A5 checks for D4. store.js
// already has an equivalent `_reset()`; this is the same idea for the
// rate limiter's own state.
function _resetRateLimit() {
    rateLimit.clear();
}

app.use(rateLimiter);

function requireBearer(req, res, next) {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith('Bearer ') || !auth.slice(7).trim()) {
        // RFC 9110 §11.6.1: a 401 must say how to authenticate.
        res.setHeader('WWW-Authenticate', 'Bearer');
        return problem(
            res,
            401,
            "unauthorized",
            "Bearer token required"
        );
    }

    next();
}

// ===============================
// POST /orders — create
// ===============================
app.post('/orders', requireBearer, async (req, res) => {
    // C2: validate everything, collect every failure, before doing any
    // work (in particular, before ever calling out to payments).
    const errs = validateOrderRequest(req.body);
    if (errs.length > 0) {
        return problem(
            res,
            422,
            "validation-failed",
            "The request body failed validation.",
            errs
        );
    }

    const key = req.headers['idempotency-key'];
    if (key) {
        const prior = store.findByKey(key);
        if (prior) return sendOrder(req, res, 200, prior.asJson());
    }

    const tempId = store._nextId || Math.floor(Math.random() * 1000);
    const cost = req.body.qty * 1000;

    try {
        await paymentsClient.chargeWithRetry(tempId, req.body.paymentMethodId, cost);
    } catch (error) {
        if (error.name === 'CardDeclined') {
            // The bank's own decline reason is safe to show — it is about
            // the caller's card, not CampusEats' internals.
            return problem(res, 422, "payment-declined", error.message);
        }
        // B4: do NOT forward error.message here. For a PaymentsUnavailable
        // failure that message can be a raw transport error (e.g. an
        // "ECONNREFUSED 127.0.0.1:8080"-style string from axios) that
        // exposes where/how the payments integration is wired up. Log the
        // real detail server-side; return a clean, stable one to the
        // client. See NOTES.md Q6.
        console.error(`[orders] payments call failed (student ${req.body.studentId}, item ${req.body.itemId}): ${error.message}`);
        // A4: a 503 is transient by definition — tell the client when to retry.
        res.setHeader('Retry-After', String(PAYMENTS_RETRY_AFTER_SECONDS));
        return problem(
            res,
            503,
            "payments-unavailable",
            "The payments provider is currently unavailable. Please try again shortly."
        );
    }

    const o = store.create(req.body.studentId, req.body.itemId, req.body.qty, req.body.paymentMethodId, "placed", key);
    res.setHeader('Location', `/orders/${o.id}`);
    return sendOrder(req, res, 201, o.asJson());
});

// ===============================
// GET /orders/:id — read one
// ===============================
app.get('/orders/:id', requireBearer, (req, res) => {
    const o = store.find(parseInt(req.params.id));

    if (!o) {
        return problem(res, 404, "order-not-found", `No order ${req.params.id}`);
    }

    const etag = etagFor(o);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=60');

    // Express helper req.get() handles header names case-insensitively
    let clientETag = req.get('If-None-Match');

    if (clientETag) {
        // Remove the weak prefix 'W/' if the client attached it
        clientETag = clientETag.replace(/^W\//, '');

        if (clientETag === etag) {
            return res.status(304).end();
        }
    }

    return sendOrder(req, res, 200, o.asJson());
});

// ===============================
// GET /orders — list / filter / sort / paginate
// ===============================
app.get('/orders', requireBearer, (req, res) => {
    const { errors, parsed } = validateListQuery(req.query);
    if (errors.length > 0) {
        return problem(res, 400, "invalid-query", "Invalid query parameters.", errors);
    }

    const { student, page, limit, sort, order } = parsed;

    let items = student !== null
        ? store.findByStudent(student)
        : store.findAll();

    items.sort((a, b) => {
        let value;

        if (sort === 'id') {
            value = a.id - b.id;
        } else {
            value = new Date(a.createdAt) - new Date(b.createdAt);
        }

        return order === 'asc' ? value : -value;
    });

    const start = (page - 1) * limit;
    const result = items.slice(start, start + limit);

    res.setHeader('Vary', 'Accept');
    return res.status(200).json(result.map(o => o.asJson()));
});

app.delete('/orders/:id', requireBearer, (req, res) => {
    const o = store.find(parseInt(req.params.id));

    if (!o) {
        return problem(res, 404, "order-not-found", `No order ${req.params.id}`);
    }

    // A2: 204 must mean "it is gone", so actually remove it. A second
    // DELETE of the same id therefore answers 404 order-not-found.
    store.remove(o.id);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(204).send();
});

// C2: Conditional write. This is the service's one "update" endpoint (it
// transitions order status), so it is the one guarded by If-Match: a client
// that read the order via GET /orders/:id and holds a stale ETag is told
// 412 rather than being allowed to blindly overwrite a state it hasn't seen.
app.post('/orders/:id/cancel', requireBearer, (req, res) => {
    const o = store.find(parseInt(req.params.id));
    if (!o) return problem(res, 404, "order-not-found", `No order ${req.params.id}`);

    const ifMatch = req.get('If-Match');
    if (ifMatch) {
        const clientETag = ifMatch.replace(/^W\//, '');
        if (clientETag !== etagFor(o)) {
            return problem(
                res,
                412,
                "precondition-failed",
                "Order has changed since you last read it; GET it again and retry with the new ETag"
            );
        }
    }

    if (o.status !== "placed") {
        return problem(res, 409, "illegal-transition", `Cannot cancel an order whose status is already '${o.status}'.`);
    }

    o.status = "cancelled";
    res.setHeader('ETag', etagFor(o));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(202).json({ id: o.id, status: o.status });
});

app.options('/orders', (req, res) => {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(204).send();
});

// ===============================
// B1: unknown route / wrong method. Without this, Express answers with its
// own HTML "Cannot GET /x" page — a failure that is NOT Problem Details.
// A path that exists but not for this verb is 405 + Allow; anything else
// is 404. The detail never echoes the caller's path back (nothing
// user-controlled is reflected into the body).
// ===============================
const KNOWN_PATHS = [
    [/^\/orders\/?$/, 'GET, POST, OPTIONS'],
    [/^\/orders\/[^/]+\/?$/, 'GET, DELETE'],
    [/^\/orders\/[^/]+\/cancel\/?$/, 'POST'],
];

app.use((req, res) => {
    const known = KNOWN_PATHS.find(([re]) => re.test(req.path));
    if (known) {
        res.setHeader('Allow', known[1]);
        return problem(res, 405, "method-not-allowed", `This endpoint supports: ${known[1]}.`);
    }
    return problem(res, 404, "route-not-found", "No such endpoint.");
});

// ===============================
// Catch-all error handler (4 args — Express recognises this as
// error-handling middleware and routes every next(err) / thrown error
// here, including body-parser failures from express.json() above).
// B4: the service's last line of defence against leaking internals —
// anything unexpected is logged with its real detail (stack included)
// server-side and answered with one clean, generic body.
// ===============================
app.use((err, req, res, next) => {
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
        return problem(res, 400, "malformed-json", "Request body is not valid JSON.");
    }
    if (err && err.type === 'entity.too.large') {
        return problem(res, 413, "payload-too-large", "Request body exceeds the size limit.");
    }
    console.error(`[orders] unhandled error: ${err && err.stack ? err.stack : err}`);
    return problem(res, 500, "internal-error", "Something went wrong on our end.");
});

module.exports = app;
module.exports._resetRateLimit = _resetRateLimit;

if (require.main === module) {
    app.listen(8081, () => console.log('Orders running on 8081'));
}
