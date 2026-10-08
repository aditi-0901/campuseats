// orders.test.js
const request = require('supertest');
const app = require('./app');
const store = require('./store');
const paymentsClient = require('./paymentsClient');

jest.mock('./paymentsClient');

beforeEach(() => {
    store._reset();
    app._resetRateLimit(); // see app.js's note next to _resetRateLimit
    jest.clearAllMocks();
});

const BODY = { studentId: 101, itemId: 5, qty: 2, paymentMethodId: "tok_good" };
const AUTH = { Authorization: 'Bearer test-token' };

// ---- carried over from Assignment 5, updated where behaviour changed ----

test('create order returns 201 with Location header', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: "captured" });
    const res = await request(app).post('/orders').set(AUTH).send(BODY);
    expect(res.statusCode).toBe(201);
    expect(res.headers['location']).toBe(`/orders/${res.body.id}`);
});

test('same idempotency key returns original 200 (C3, Assignment 5)', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: "captured" });
    const headers = { ...AUTH, 'Idempotency-Key': 'k-99' };
    const res1 = await request(app).post('/orders').set(headers).send(BODY);
    const res2 = await request(app).post('/orders').set(headers).send(BODY);
    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(200);
    expect(res1.body.id).toBe(res2.body.id);
    expect(paymentsClient.chargeWithRetry).toHaveBeenCalledTimes(1);
});

test('unknown order id returns 404', async () => {
    const res = await request(app).get('/orders/999').set(AUTH);
    expect(res.statusCode).toBe(404);
});

test('missing bearer token is rejected with 401', async () => {
    const res = await request(app).get('/orders/1');
    expect(res.statusCode).toBe(401);
});

test('conditional GET returns 304 when If-None-Match matches (C1, Assignment 5)', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: "captured" });
    const created = await request(app).post('/orders').set(AUTH).send(BODY);
    const first = await request(app).get(`/orders/${created.body.id}`).set(AUTH);
    const etag = first.headers['etag'];

    const second = await request(app)
        .get(`/orders/${created.body.id}`)
        .set(AUTH)
        .set('If-None-Match', etag);

    expect(second.statusCode).toBe(304);
    expect(second.body).toEqual({});
});

test('conditional cancel is rejected with 412 on a stale If-Match (C2, Assignment 5)', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: "captured" });
    const created = await request(app).post('/orders').set(AUTH).send(BODY);
    const staleEtag = `"order-${created.body.id}-placed-${new Date(0).toISOString()}"`;

    const res = await request(app)
        .post(`/orders/${created.body.id}/cancel`)
        .set(AUTH)
        .set('If-Match', staleEtag);

    expect(res.statusCode).toBe(412);
});

test('cancel with a matching If-Match succeeds (C2, Assignment 5)', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: "captured" });
    const created = await request(app).post('/orders').set(AUTH).send(BODY);
    const read = await request(app).get(`/orders/${created.body.id}`).set(AUTH);

    const res = await request(app)
        .post(`/orders/${created.body.id}/cancel`)
        .set(AUTH)
        .set('If-Match', read.headers['etag']);

    expect(res.statusCode).toBe(202);
    expect(res.body.status).toBe('cancelled');
});

test('cancelling an already-cancelled order returns 409 illegal-transition', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: "captured" });
    const created = await request(app).post('/orders').set(AUTH).send(BODY);
    await request(app).post(`/orders/${created.body.id}/cancel`).set(AUTH);

    const res = await request(app).post(`/orders/${created.body.id}/cancel`).set(AUTH);
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.text);
    expect(body.type).toBe('/errors/illegal-transition');
});

// ---- new for Assignment 6, Part C ----

test('C1/C2: one bad field returns 422 with a field-level errors[] entry', async () => {
    const res = await request(app).post('/orders').set(AUTH).send({ ...BODY, qty: 0 });
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.text);
    expect(body.type).toBe('/errors/validation-failed');
    expect(body.errors).toEqual([{ field: "qty", reason: "required integer, minimum 1" }]);
    expect(paymentsClient.chargeWithRetry).not.toHaveBeenCalled();
});

test('C2: two bad fields in one request are BOTH reported in a single 422 (NOTES.md Q4)', async () => {
    const res = await request(app)
        .post('/orders')
        .set(AUTH)
        .send({ studentId: "not-an-int", itemId: 5, qty: -3, paymentMethodId: "tok_good" });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.text);
    const fields = body.errors.map(e => e.field).sort();
    expect(fields).toEqual(["qty", "studentId"]);
    expect(paymentsClient.chargeWithRetry).not.toHaveBeenCalled();
});

test('C1: a missing field and a wrong-type field are reported together', async () => {
    const res = await request(app)
        .post('/orders')
        .set(AUTH)
        .send({ studentId: 101, qty: 2 }); // itemId missing, paymentMethodId missing

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.text);
    const fields = body.errors.map(e => e.field).sort();
    expect(fields).toEqual(["itemId", "paymentMethodId"]);
});

test('truly malformed JSON (unparsable body) returns 400, not 422', async () => {
    const res = await request(app)
        .post('/orders')
        .set(AUTH)
        .set('Content-Type', 'application/json')
        .send('{"studentId": 101, "qty": '); // deliberately broken JSON

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.text);
    expect(body.type).toBe('/errors/malformed-json');
});

test('every Problem Details body is served as application/problem+json (B1)', async () => {
    const res = await request(app).get('/orders/999').set(AUTH);
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
});

test('C3: Accept: application/xml returns an XML representation of the order', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: "captured" });
    const created = await request(app).post('/orders').set(AUTH).send(BODY);

    const res = await request(app)
        .get(`/orders/${created.body.id}`)
        .set(AUTH)
        .set('Accept', 'application/xml');

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.text).toContain(`<id>${created.body.id}</id>`);
    expect(res.text).toContain('<status>placed</status>');
});

test('C3: Accept: application/json still returns JSON (the documented default)', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: "captured" });
    const created = await request(app).post('/orders').set(AUTH).send(BODY);

    const res = await request(app)
        .get(`/orders/${created.body.id}`)
        .set(AUTH)
        .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.id).toBe(created.body.id);
});

test('C3: an Accept the service cannot produce returns 406', async () => {
    const res = await request(app)
        .get('/orders/1')
        .set(AUTH)
        .set('Accept', 'text/html');

    expect(res.statusCode).toBe(406);
});

test('B4: a payments outage never leaks the raw transport error to the client', async () => {
    paymentsClient.chargeWithRetry.mockRejectedValue(
        new Error('connect ECONNREFUSED 127.0.0.1:8080')
    );
    const res = await request(app).post('/orders').set(AUTH).send(BODY);

    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.text);
    expect(body.detail).not.toMatch(/ECONNREFUSED/);
    expect(body.detail).not.toMatch(/127\.0\.0\.1/);
});

// =====================================================================
// Assignment 6 — Part A (status codes) and Part B (one error shape)
// =====================================================================

const PROBLEM_KEYS = ['type', 'title', 'status', 'detail'];
const isProblem = (res) =>
    /application\/problem\+json; charset=utf-8/.test(res.headers['content-type']) &&
    PROBLEM_KEYS.every(k => k in JSON.parse(res.text)) &&
    JSON.parse(res.text).status === res.statusCode;

// ---- A2: the status IS the result ----

test('A2: DELETE really deletes — 204, then the order is gone (404), and a repeat DELETE is 404', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: "captured" });
    const created = await request(app).post('/orders').set(AUTH).send(BODY);
    const id = created.body.id;

    expect((await request(app).delete(`/orders/${id}`).set(AUTH)).statusCode).toBe(204);
    expect((await request(app).get(`/orders/${id}`).set(AUTH)).statusCode).toBe(404);
    expect((await request(app).delete(`/orders/${id}`).set(AUTH)).statusCode).toBe(404);
});

test('A2: no failure is ever answered with a 2xx — every failure body has a 4xx/5xx status', async () => {
    const failures = [
        await request(app).get('/orders/999').set(AUTH),
        await request(app).get('/orders/1'),
        await request(app).post('/orders').set(AUTH).send({}),
        await request(app).get('/orders?page=0').set(AUTH),
        await request(app).get('/nope').set(AUTH),
    ];
    for (const res of failures) {
        expect(res.statusCode).toBeGreaterThanOrEqual(400);
        expect(JSON.parse(res.text).ok).toBeUndefined(); // never { "ok": false }
    }
});

// ---- A4: Retry-After on 429 / 503 ----

test('A4: 503 payments-unavailable carries Retry-After', async () => {
    paymentsClient.chargeWithRetry.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8080'));
    const res = await request(app).post('/orders').set(AUTH).send(BODY);
    expect(res.statusCode).toBe(503);
    expect(res.headers['retry-after']).toBe('30');
});

test('A4: 429 rate-limit-exceeded carries Retry-After', async () => {
    for (let i = 0; i < 10; i++) await request(app).get('/orders/999').set(AUTH);
    const res = await request(app).get('/orders/999').set(AUTH);
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBe('60');
    expect(JSON.parse(res.text).type).toBe('/errors/rate-limit-exceeded');
});

test('A4: 4xx client errors never carry Retry-After (retrying them unchanged is pointless)', async () => {
    const r422 = await request(app).post('/orders').set(AUTH).send({});
    const r404 = await request(app).get('/orders/999').set(AUTH);
    expect(r422.headers['retry-after']).toBeUndefined();
    expect(r404.headers['retry-after']).toBeUndefined();
});

// ---- B1: one shape, one content type — for EVERY failure ----

test('B1: every failure path answers with the same Problem Details shape', async () => {
    paymentsClient.chargeWithRetry.mockRejectedValueOnce(Object.assign(new Error('Card declined'), { name: 'CardDeclined' }));
    const declined = await request(app).post('/orders').set(AUTH).send(BODY);

    const created = (paymentsClient.chargeWithRetry.mockResolvedValue({ status: 'captured' }),
        await request(app).post('/orders').set(AUTH).send(BODY));
    const id = created.body.id;
    await request(app).post(`/orders/${id}/cancel`).set(AUTH);

    const all = [
        declined,                                                                    // 422 payment-declined
        await request(app).post('/orders').set(AUTH).send({}),                       // 422 validation-failed
        await request(app).post('/orders').set(AUTH).set('Content-Type', 'application/json').send('{bad'), // 400
        await request(app).get('/orders?page=0').set(AUTH),                          // 400 invalid-query
        await request(app).get('/orders/1'),                                         // 401
        await request(app).get('/orders/999').set(AUTH),                             // 404 order-not-found
        await request(app).get('/nope').set(AUTH),                                   // 404 route-not-found
        await request(app).put('/orders').set(AUTH),                                 // 405
        (app._resetRateLimit(), await request(app).get(`/orders/${id}`).set(AUTH).set('Accept', 'text/html')), // 406 (budget reset: this test sends >10 requests)
        await request(app).post(`/orders/${id}/cancel`).set(AUTH),                   // 409 illegal-transition
        await request(app).post(`/orders/${id}/cancel`).set(AUTH).set('If-Match', '"stale"'), // 412
    ];
    const statuses = all.map(r => r.statusCode);
    expect(statuses).toEqual([422, 422, 400, 400, 401, 404, 404, 405, 406, 409, 412]);
    for (const res of all) expect(isProblem(res)).toBe(true);
});

test('B1: unknown route is a Problem Details 404 (not Express\'s HTML page)', async () => {
    const res = await request(app).get('/menu').set(AUTH);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.text).type).toBe('/errors/route-not-found');
    expect(res.text).not.toMatch(/<html|Cannot GET/i);
});

test('B1: wrong method on a real path is 405 with an Allow header', async () => {
    const res = await request(app).put('/orders/1').set(AUTH);
    expect(res.statusCode).toBe(405);
    expect(res.headers['allow']).toBe('GET, DELETE');
    expect(JSON.parse(res.text).type).toBe('/errors/method-not-allowed');
});

test('B1: 401 says how to authenticate (WWW-Authenticate: Bearer)', async () => {
    const res = await request(app).get('/orders/1');
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
});

test('B1/C4: even a body-parser failure carries the security + CORS headers', async () => {
    const res = await request(app).post('/orders').set(AUTH)
        .set('Content-Type', 'application/json').send('{bad');
    expect(res.statusCode).toBe(400);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).toBe('*');
});

// ---- B2: catalogue strings are stable ----

test('B2: each documented failure produces exactly its catalogue type', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: 'captured' });
    const created = await request(app).post('/orders').set(AUTH).send(BODY);
    const id = created.body.id;
    await request(app).post(`/orders/${id}/cancel`).set(AUTH);

    const type = async (p) => JSON.parse((await p).text).type;
    expect(await type(request(app).get('/orders/999').set(AUTH))).toBe('/errors/order-not-found');
    expect(await type(request(app).post(`/orders/${id}/cancel`).set(AUTH))).toBe('/errors/illegal-transition');
    expect(await type(request(app).post('/orders').set(AUTH).send({}))).toBe('/errors/validation-failed');
    expect(await type(request(app).get('/orders?limit=0').set(AUTH))).toBe('/errors/invalid-query');
});

// ---- B3 is covered by the three C1/C2 tests above (field-level 422) ----

// ---- B4: don't leak internals ----

test('B4: an unexpected exception becomes a clean 500 — no stack, no message', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: 'captured' });
    const spy = jest.spyOn(store, 'create').mockImplementation(() => {
        throw new Error('SQLITE_ERROR: no such table: orders at /srv/campuseats/db.js:42');
    });
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).post('/orders').set(AUTH).send(BODY);

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.text).type).toBe('/errors/internal-error');
    expect(res.text).not.toMatch(/SQLITE|no such table|\/srv\/|\.js:\d+|at .*\(/);
    // ...but the real detail WAS logged server-side
    expect(logged.mock.calls.flat().join(' ')).toMatch(/SQLITE_ERROR/);

    spy.mockRestore();
    logged.mockRestore();
});

test('B4: an oversized body is a clean 413, not a 500 or a parser error dump', async () => {
    const res = await request(app).post('/orders').set(AUTH)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ ...BODY, padding: 'x'.repeat(200 * 1024) }));
    expect(res.statusCode).toBe(413);
    expect(JSON.parse(res.text).type).toBe('/errors/payload-too-large');
});
