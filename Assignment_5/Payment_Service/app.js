const express = require('express');
const store = require('./store');
const { problem } = require('./errors');

const app = express();
console.log("PAYMENT SERVICE LOADED");
app.use(express.json());

// ===============================
// B1/B2: Media Type Validation
// ===============================
app.use((req, res, next) => {
    const accept = req.headers.accept;

    if (
        accept &&
        !accept.includes('application/json') &&
        !accept.includes('*/*')
    ) {
        return problem(
            res,
            406,
            "not-acceptable",
            "Only application/json is supported"
        );
    }

    next();
});

// ===============================
// B7: Security & General Headers
// ===============================
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    next();
});

function etagFor(p) {
    return `"payment-${p.id}-${p.status}-${p.createdAt}"`;
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

// ===============================
// B6: CORS
// ===============================
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Accept, Idempotency-Key, If-Match, If-None-Match'
    );

    res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, DELETE, OPTIONS'
    );

    if (req.method === 'OPTIONS' && req.path !== '/payments') {
        return res.status(204).send();
    }

    next();
});

app.use(rateLimiter);

// ===============================
// B3: Bearer Token Auth
// ===============================
function requireBearer(req, res, next) {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith('Bearer ') || !auth.slice(7).trim()) {
        return problem(
            res,
            401,
            "unauthorized",
            "Bearer token required"
        );
    }

    next();
}

function validate(body) {
    const errors = [];
    if (!Number.isInteger(body.orderId)) errors.push(["orderId", "required integer"]);
    if (!body.cardToken || typeof body.cardToken !== 'string') errors.push(["cardToken", "required string"]);
    if (typeof body.amount !== 'number' || body.amount <= 0) errors.push(["amount", "positive number"]);
    return errors;
}



// ===============================
// POST /payments (Create payment)
// ===============================
app.post('/payments', requireBearer, (req, res) => {
    const errs = validate(req.body);
    if (errs.length > 0) return problem(res, 400, "invalid-request", "", errs);

    // C3: Idempotency Key check
    const key = req.headers['idempotency-key'];
    if (key) {
        const prior = store.findByKey(key);
        if (prior) return res.status(200).json(prior.asJson());
    }

    if (req.body.cardToken === "tok_declined") {
        return problem(res, 422, "payment-declined", "Card declined by bank");
    }

    const p = store.create(
        req.body.orderId,
        req.body.cardToken,
        req.body.amount,
        req.body.currency || "INR",
        "captured",
        key
    );

    res.setHeader('Location', `/payments/${p.id}`);
    res.setHeader('ETag', etagFor(p));
    return res.status(201).json(p.asJson());
});

// ===============================
// GET /payments/:id (Read single payment)
// ===============================
app.get('/payments/:id', requireBearer, (req, res) => {
    const p = store.find(parseInt(req.params.id));

    if (!p) {
        return problem(res, 404, "payment-not-found", `No payment ${req.params.id}`);
    }

    const etag = etagFor(p);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=60');

    // C1: Conditional GET
    let clientETag = req.get('If-None-Match');

    if (clientETag) {
        clientETag = clientETag.replace(/^W\//, '');

        if (clientETag === etag) {
            return res.status(304).end();
        }
    }

    return res.status(200).json(p.asJson());
});

// ===============================
// GET /payments (List, Filter, Sort, Paginate)
// ===============================
app.get('/payments', requireBearer, (req, res) => {
    const orderId = req.query.orderId
        ? Number(req.query.orderId)
        : null;

    const page = req.query.page
        ? Number(req.query.page)
        : 1;

    const limit = req.query.limit
        ? Number(req.query.limit)
        : 10;

    const sort = req.query.sort || 'createdAt';
    const order = req.query.order || 'asc';

    if (
        (orderId !== null && !Number.isInteger(orderId)) ||
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        !['createdAt', 'id'].includes(sort) ||
        !['asc', 'desc'].includes(order)
    ) {
        return problem(
            res,
            400,
            "invalid-request",
            "Invalid query parameters"
        );
    }

    let items = orderId !== null
        ? store.findByOrderId(orderId)
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

    return res.status(200).json(result.map(p => p.asJson()));
});

// ===============================
// DELETE /payments/:id (Verb mapping stub)
// ===============================
app.delete('/payments/:id', requireBearer, (req, res) => {
    const p = store.find(parseInt(req.params.id));

    if (!p) {
        return problem(res, 404, "payment-not-found");
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(204).send();
});

// ===============================
// POST /payments/:id/refund (Non-CRUD Action & Conditional Write C2)
// ===============================
app.post('/payments/:id/refund', requireBearer, (req, res) => {
    const p = store.find(parseInt(req.params.id));
    if (!p) return problem(res, 404, "payment-not-found");

    const ifMatch = req.get('If-Match');
    if (ifMatch) {
        const clientETag = ifMatch.replace(/^W\//, '');
        if (clientETag !== etagFor(p)) {
            return problem(
                res,
                412,
                "precondition-failed",
                "Payment has changed since you last read it; GET it again and retry with the new ETag"
            );
        }
    }

    if (p.status !== "captured") return problem(res, 409, "state-conflict", `status is ${p.status}`);

    p.status = "refunded";
    res.setHeader('ETag', etagFor(p));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(202).json({ id: p.id, status: p.status });
});

// ===============================
// OPTIONS /payments (A5)
// ===============================
app.options('/payments', (req, res) => {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(204).send();
});

module.exports = app;

if (require.main === module) {
    app.listen(8080, () => console.log('Payment Service running on 8080'));
}
