const express = require('express');
const store = require('./store');
const paymentsClient = require('./paymentsClient'); // Corrected path
const { problem } = require('./errors');

const app = express();
console.log("C1 VERSION LOADED");
app.use(express.json());

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
// B7: Security & general headers
// ===============================
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Documents intent for production; this dev server itself runs on plain HTTP.
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
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

    // /orders has its own OPTIONS handler below that sets a resource-specific
    // Allow header (A5); everything else gets a generic CORS preflight reply.
    if (req.method === 'OPTIONS' && req.path !== '/orders') {
        return res.status(204).send();
    }

    next();
});

app.use(rateLimiter);
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
    if (!Number.isInteger(body.studentId)) errors.push(["studentId", "required integer"]);
    if (!Number.isInteger(body.itemId)) errors.push(["itemId", "required integer"]);
    if (!Number.isInteger(body.qty) || body.qty <= 0) errors.push(["qty", "positive integer"]);
    if (!body.paymentMethodId) errors.push(["paymentMethodId", "required"]);
    return errors;
}

app.post('/orders', requireBearer, async (req, res) => {
    const errs = validate(req.body);
    if (errs.length > 0) return problem(res, 400, "invalid-request", "", errs);

    const key = req.headers['idempotency-key'];
    if (key) {
        const prior = store.findByKey(key);
        if (prior) return res.status(200).json(prior.asJson());
    }

    const tempId = store._nextId || Math.floor(Math.random() * 1000);
    const cost = req.body.qty * 1000;

    try {
        await paymentsClient.chargeWithRetry(tempId, req.body.paymentMethodId, cost);
    } catch (error) {
        if (error.name === 'CardDeclined') return problem(res, 422, "payment-declined", error.message);
        return problem(res, 503, "payments-unavailable", error.message);
    }

    const o = store.create(req.body.studentId, req.body.itemId, req.body.qty, req.body.paymentMethodId, "placed", key);
    res.setHeader('Location', `/orders/${o.id}`);
    return res.status(201).json(o.asJson());
});

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

    return res.status(200).json(o.asJson());
});

app.get('/orders', requireBearer, (req, res) => {
    const student = req.query.student
        ? Number(req.query.student)
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
        (student !== null && !Number.isInteger(student)) ||
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

    return res.status(200).json(result.map(o => o.asJson()));
});

app.delete('/orders/:id', requireBearer, (req, res) => {
    const o = store.find(parseInt(req.params.id));

    if (!o) {
        return problem(res, 404, "order-not-found");
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(204).send();
});

// C2: Conditional write. This is the service's one "update" endpoint (it
// transitions order status), so it is the one guarded by If-Match: a client
// that read the order via GET /orders/:id and holds a stale ETag is told
// 412 rather than being allowed to blindly overwrite a state it hasn't seen.
app.post('/orders/:id/cancel', requireBearer, (req, res) => {
    const o = store.find(parseInt(req.params.id));
    if (!o) return problem(res, 404, "order-not-found");

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

    if (o.status !== "placed") return problem(res, 409, "state-conflict", `status is ${o.status}`);

    o.status = "cancelled";
    res.setHeader('ETag', etagFor(o));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(202).json({ id: o.id, status: o.status });
});

app.options('/orders', (req, res) => {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(204).send();
});

module.exports = app;

if (require.main === module) {
    app.listen(8081, () => console.log('Orders running on 8081'));
}