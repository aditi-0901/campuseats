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
