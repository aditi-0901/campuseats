const request = require('supertest');
const app = require('./app');
const store = require('./store');

beforeEach(() => {
    store._reset();
    jest.clearAllMocks();
});

const BODY = { orderId: 101, cardToken: "tok_good", amount: 2000, currency: "INR" };
const AUTH = { Authorization: 'Bearer test-token' };

test('create payment returns 201 with Location header', async () => {
    const res = await request(app).post('/payments').set(AUTH).send(BODY);
    expect(res.statusCode).toBe(201);
    expect(res.headers['location']).toBe(`/payments/${res.body.id}`);
});

test('same idempotency key returns original 200 (C3)', async () => {
    const headers = { ...AUTH, 'Idempotency-Key': 'pay-k-99' };
    const res1 = await request(app).post('/payments').set(headers).send(BODY);
    const res2 = await request(app).post('/payments').set(headers).send(BODY);
    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(200);
    expect(res1.body.id).toBe(res2.body.id);
});

test('unknown payment id returns 404', async () => {
    const res = await request(app).get('/payments/999').set(AUTH);
    expect(res.statusCode).toBe(404);
});

test('malformed body is rejected with 400', async () => {
    const res = await request(app).post('/payments').set(AUTH).send({ orderId: "not_an_int" });
    expect(res.statusCode).toBe(400);
});

test('missing bearer token is rejected with 401', async () => {
    const res = await request(app).get('/payments/1');
    expect(res.statusCode).toBe(401);
});

test('declined card returns 422 payment-declined', async () => {
    const declinedBody = { ...BODY, cardToken: "tok_declined" };
    const res = await request(app).post('/payments').set(AUTH).send(declinedBody);
    expect(res.statusCode).toBe(422);
    expect(res.body.type).toBe('/errors/payment-declined');
});

test('conditional GET returns 304 when If-None-Match matches (C1)', async () => {
    const created = await request(app).post('/payments').set(AUTH).send(BODY);
    const first = await request(app).get(`/payments/${created.body.id}`).set(AUTH);
    const etag = first.headers['etag'];

    const second = await request(app)
        .get(`/payments/${created.body.id}`)
        .set(AUTH)
        .set('If-None-Match', etag);

    expect(second.statusCode).toBe(304);
    expect(second.body).toEqual({});
});

test('conditional refund is rejected with 412 on a stale If-Match (C2)', async () => {
    const created = await request(app).post('/payments').set(AUTH).send(BODY);
    const staleEtag = `"payment-${created.body.id}-captured-${new Date(0).toISOString()}"`;

    const res = await request(app)
        .post(`/payments/${created.body.id}/refund`)
        .set(AUTH)
        .set('If-Match', staleEtag);

    expect(res.statusCode).toBe(412);
});

test('refund with a matching If-Match succeeds (C2)', async () => {
    const created = await request(app).post('/payments').set(AUTH).send(BODY);
    const read = await request(app).get(`/payments/${created.body.id}`).set(AUTH);

    const res = await request(app)
        .post(`/payments/${created.body.id}/refund`)
        .set(AUTH)
        .set('If-Match', read.headers['etag']);

    expect(res.statusCode).toBe(202);
    expect(res.body.status).toBe('refunded');
});
