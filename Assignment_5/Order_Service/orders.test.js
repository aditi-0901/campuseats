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

test('create order returns 201 with Location header', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: "captured" });
    const res = await request(app).post('/orders').send(BODY);
    expect(res.statusCode).toBe(201);
    expect(res.headers['location']).toBe(`/orders/${res.body.id}`);
});

test('same idempotency key returns original 200', async () => {
    paymentsClient.chargeWithRetry.mockResolvedValue({ status: "captured" });
    const headers = { 'Idempotency-Key': 'k-99' };
    const res1 = await request(app).post('/orders').send(BODY).set(headers);
    const res2 = await request(app).post('/orders').send(BODY).set(headers);
    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(200);
    expect(res1.body.id).toBe(res2.body.id);
});

test('unknown payment id returns 404', async () => {
    const res = await request(app).get('/orders/999');
    expect(res.statusCode).toBe(404);
});

test('malformed body is rejected with 400', async () => {
    const res = await request(app).post('/orders').send({ studentId: "not_an_int" });
    expect(res.statusCode).toBe(400);
});