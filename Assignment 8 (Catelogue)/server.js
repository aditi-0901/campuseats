// server.js -- CampusEats Menu service as a REST API (Node + Express)
// CS543 Web Services - Assignment 8
const express = require('express');
const app = express();

app.use(express.json());            // parse JSON request bodies into req.body
app.use(express.static('public'));  // serve public/index.html + style.css

// In-memory data: the source of truth (a real database comes in Lecture 10)
let items = [
  { id: 1, name: 'Veg Thali',    price: 90, available: true  },
  { id: 2, name: 'Paneer Roll',  price: 70, available: true  },
  { id: 3, name: 'Masala Chai',  price: 15, available: true  },
  { id: 4, name: 'Chole Bhature', price: 80, available: false },
];
let nextId = 5;

// GET /items -- list the whole menu -> 200
app.get('/items', (req, res) => {
  res.json(items);
});

// GET /items/:id -- one dish -> 200, or 404 if absent
app.get('/items/:id', (req, res) => {
  const item = items.find(i => i.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'not found' });
  res.json(item);
});

// POST /items -- create a dish -> 201, or 422 if a required field is missing/invalid
app.post('/items', (req, res) => {
  const { name, price, available } = req.body || {};   // req.body is undefined if no JSON was sent

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(422).json({ error: 'name required' });
  }
  if (price === undefined || price === null || price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) {
    return res.status(422).json({ error: 'price required (a number, 0 or more)' });
  }

  const item = {
    id: nextId++,
    name: name.trim(),
    price: Number(price),
    available: available === undefined ? true : (available === true || available === 'true'),
  };
  items.push(item);
  res.status(201).json(item);
});

// Malformed JSON in the request body -> 400 (instead of an HTML error page)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid JSON' });
  }
  next(err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CampusEats Menu API on http://localhost:${PORT}`));
