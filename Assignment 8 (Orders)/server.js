// CampusEats Orders Service — Assignment 8 (REST API with Express)
// Data is intentionally in-memory for this assignment; restarting resets the demo.
const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(express.json()); // Parses application/json request bodies into req.body.
app.use(express.static(path.join(__dirname, 'public')));

// Four seed records based on the Order entity used in the earlier CampusEats work.
let orders = [
  { id: 1, studentId: '20251651064', itemId: 2, qty: 1, status: 'placed', createdAt: '2026-10-28T09:15:00.000Z' },
  { id: 2, studentId: '20251651008', itemId: 5, qty: 2, status: 'preparing', createdAt: '2026-10-28T09:22:00.000Z' },
  { id: 3, studentId: '20251651084', itemId: 1, qty: 1, status: 'ready', createdAt: '2026-10-28T09:30:00.000Z' },
  { id: 4, studentId: '20251651064', itemId: 3, qty: 3, status: 'completed', createdAt: '2026-10-28T10:05:00.000Z' },
];
let nextId = Math.max(...orders.map((order) => order.id)) + 1;

// GET /orders — return the complete in-memory collection.
app.get('/orders', (req, res) => {
  res.status(200).json(orders);
});

// GET /orders/:id — return one order, or 404 when it does not exist.
app.get('/orders/:id', (req, res) => {
  const id = Number(req.params.id); // Route parameter comes from the URL.
  if (!Number.isInteger(id) || id < 1) {
    return res.status(404).json({ error: 'Order not found', message: `No order exists with id ${req.params.id}.` });
  }
  const order = orders.find((entry) => entry.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found', message: `No order exists with id ${id}.` });
  }
  return res.status(200).json(order);
});

// POST /orders — validate JSON, create an order, and return 201 + Location.
app.post('/orders', (req, res) => {
  const body = req.body || {}; // Parsed JSON payload is available as req.body.
  const errors = [];
  if (typeof body.studentId !== 'string' || !body.studentId.trim()) {
    errors.push({ field: 'studentId', message: 'studentId is required and must be a non-empty string.' });
  }
  if (!Number.isInteger(body.itemId) || body.itemId < 1) {
    errors.push({ field: 'itemId', message: 'itemId is required and must be a positive integer.' });
  }
  if (!Number.isInteger(body.qty) || body.qty < 1) {
    errors.push({ field: 'qty', message: 'qty is required and must be a positive integer.' });
  }
  if (errors.length) {
    return res.status(422).json({ error: 'Validation failed', details: errors });
  }

  const order = {
    id: nextId++,
    studentId: body.studentId.trim(),
    itemId: body.itemId,
    qty: body.qty,
    status: 'placed',
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  res.location(`/orders/${order.id}`);
  return res.status(201).json(order);
});

// Malformed JSON should also produce a clear client error (not an HTML stack trace).
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON', message: 'Send a valid JSON request body.' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`CampusEats Orders Service running at http://localhost:${PORT}`));
}

module.exports = { app };
