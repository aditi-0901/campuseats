process.env.JWT_SECRET = 'test-secret-for-automated-tests-only';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

let server;
let baseUrl;
let customerToken;
let restaurantToken;

test('start test server', async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test('protected catalogue read returns 401 without a token', async () => {
  const response = await fetch(`${baseUrl}/items`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'missing or invalid authorization token' });
});

test('login rejects incorrect credentials with 401', async () => {
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'customer', password: 'wrong-password' })
  });
  assert.equal(response.status, 401);
});

test('customer and restaurant can log in and receive role-bearing JWTs', async () => {
  const customerResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'customer', password: 'customer123' })
  });
  assert.equal(customerResponse.status, 200);
  const customer = await customerResponse.json();
  assert.ok(customer.token);
  assert.equal(customer.user.role, 'customer');
  customerToken = customer.token;

  const restaurantResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'restaurant', password: 'restaurant123' })
  });
  assert.equal(restaurantResponse.status, 200);
  const restaurant = await restaurantResponse.json();
  assert.ok(restaurant.token);
  assert.equal(restaurant.user.role, 'restaurant');
  restaurantToken = restaurant.token;
});

test('authenticated customer can read catalogue with 200', async () => {
  const response = await fetch(`${baseUrl}/items`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert.equal(response.status, 200);
  const items = await response.json();
  assert.equal(items.length, 4);
});

test('authenticated customer cannot create catalogue item and receives 403', async () => {
  const response = await fetch(`${baseUrl}/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${customerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: 'Customer Test Item', price: 45, available: true })
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'forbidden: insufficient role' });
});

test('restaurant can create catalogue item and receives 201', async () => {
  const response = await fetch(`${baseUrl}/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${restaurantToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: 'Test Masala Dosa', price: 65, available: true })
  });
  assert.equal(response.status, 201);
  const item = await response.json();
  assert.equal(item.id, 5);
  assert.equal(item.name, 'Test Masala Dosa');
});

test('stop test server', async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
