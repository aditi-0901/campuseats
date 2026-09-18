// orders.test.js (Top of the file)
const request = require('supertest');
const app = require('./app');
const store = require('./store');
const paymentsClient = require('./paymentsClient'); // Both now point to the same folder

jest.mock('./paymentsClient'); // This must exactly match the require path above

beforeEach(() => {
    store._reset();
    jest.clearAllMocks();
});

const BODY = { studentId: 101, itemId: 5, qty: 2, paymentMethodId: "tok_good" };
const AUTH = { Authorization: 'Bearer test-token' };

test('create order returns 201 with Location header', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: "captured" });
    const res = await request(app).post('/orders').set(AUTH).send(BODY);
    expect(res.statusCode).toBe(201);
    expect(res.headers['location']).toBe(`/orders/${res.body.id}`);
});

test('same idempotency key returns original 200 (C3)', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: "captured" });
    const headers = { ...AUTH, 'Idempotency-Key': 'k-99' };
    const res1 = await request(app).post('/orders').set(headers).send(BODY);
    const res2 = await request(app).post('/orders').set(headers).send(BODY);
    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(200);
    expect(res1.body.id).toBe(res2.body.id);
    // no second charge attempt for the duplicated key
    expect(paymentsClient.chargeWithRetry).toHaveBeenCalledTimes(1);
});

test('unknown order id returns 404', async () => {
    const res = await request(app).get('/orders/999').set(AUTH);
    expect(res.statusCode).toBe(404);
});

test('malformed body is rejected with 400', async () => {
    const res = await request(app).post('/orders').set(AUTH).send({ studentId: "not_an_int" });
    expect(res.statusCode).toBe(400);
});

test('missing bearer token is rejected with 401', async () => {
    const res = await request(app).get('/orders/1');
    expect(res.statusCode).toBe(401);
});

test('conditional GET returns 304 when If-None-Match matches (C1)', async () => {
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

test('conditional cancel is rejected with 412 on a stale If-Match (C2)', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: "captured" });
    const created = await request(app).post('/orders').set(AUTH).send(BODY);
    const staleEtag = `"order-${created.body.id}-placed-${new Date(0).toISOString()}"`;

    const res = await request(app)
        .post(`/orders/${created.body.id}/cancel`)
        .set(AUTH)
        .set('If-Match', staleEtag);

    expect(res.statusCode).toBe(412);
});

test('cancel with a matching If-Match succeeds (C2)', async () => {
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