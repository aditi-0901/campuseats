const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../server');
const http = require('node:http');

let server;
let base;
before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => new Promise((resolve) => server.close(resolve)));

test('GET /orders returns the four seeded orders', async () => {
  const response = await fetch(`${base}/orders`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.length, 4);
  assert.equal(body[0].id, 1);
});
test('GET /orders/:id returns an existing order', async () => {
  const response = await fetch(`${base}/orders/2`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.studentId, '20251651008');
});
test('GET /orders/:id returns 404 when the order is absent', async () => {
  const response = await fetch(`${base}/orders/999`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'Order not found');
});
test('POST /orders creates an order with 201 and Location', async () => {
  const response = await fetch(`${base}/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: '20251651064', itemId: 7, qty: 2 }),
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('location'), `/orders/${body.id}`);
  assert.equal(body.status, 'placed');
  assert.equal(body.qty, 2);
});
test('POST /orders returns 422 and reports all invalid fields', async () => {
  const response = await fetch(`${base}/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: '', itemId: 0, qty: -1 }),
  });
  const body = await response.json();
  assert.equal(response.status, 422);
  assert.deepEqual(body.details.map((item) => item.field), ['studentId', 'itemId', 'qty']);
});
