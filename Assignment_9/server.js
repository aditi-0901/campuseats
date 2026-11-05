const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SECRET = 'dev-secret-change-me'; // In real applications, use process.env.JWT_SECRET

// Two users with hashed passwords
const users = [
  {
    id: 1,
    email: 'shivam@campus.edu',
    role: 'customer',
    hash: bcrypt.hashSync('customer123', 10)
  },
  {
    id: 2,
    email: 'mealhub@campus.edu',
    role: 'restaurant',
    hash: bcrypt.hashSync('resto123', 10)
  }
];

// In-memory menu items
let items = [
  { id: 1, name: 'Veg Thali', price: 90, available: true },
  { id: 2, name: 'Paneer Roll', price: 70, available: true },
  { id: 3, name: 'Masala Chai', price: 15, available: true },
  { id: 4, name: 'Chole Bhature', price: 80, available: false }
];

let nextId = 5;

// Authentication middleware
function auth(req, res, next) {
  const token = (req.get('Authorization') || '').split(' ')[1];

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({
      error: 'invalid or missing token'
    });
  }
}

// Authorization middleware
function requireRole(...allowed) {
  return (req, res, next) => {
    if (allowed.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({
        error: 'forbidden'
      });
    }
  };
}

// POST /login -- verify password and return JWT
app.post('/login', (req, res) => {
  const user = users.find(u => u.email === req.body.email);

  if (!user || !bcrypt.compareSync(req.body.password, user.hash)) {
    return res.status(401).json({
      error: 'bad login'
    });
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    SECRET,
    { expiresIn: '1h' }
  );

  res.json({ token });
});

// GET /items -- list all menu items (authenticated users)
app.get('/items', auth, (req, res) => {
  res.json(items);
});

// GET /items/:id -- get one menu item
app.get('/items/:id', auth, (req, res) => {
  const item = items.find(i => i.id === Number(req.params.id));

  if (!item) {
    return res.status(404).json({
      error: 'not found'
    });
  }

  res.json(item);
});

// POST /items -- only restaurant users can add items
app.post('/items', auth, requireRole('restaurant'), (req, res) => {
  const { name, price, available } = req.body || {};

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(422).json({
      error: 'name required'
    });
  }

  if (
    price === undefined ||
    price === null ||
    price === '' ||
    !Number.isFinite(Number(price)) ||
    Number(price) < 0
  ) {
    return res.status(422).json({
      error: 'price required (a number, 0 or more)'
    });
  }

  const item = {
    id: nextId++,
    name: name.trim(),
    price: Number(price),
    available: available === undefined
      ? true
      : (available === true || available === 'true')
  };

  items.push(item);

  res.status(201).json(item);
});

// Handle invalid JSON requests
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'invalid JSON'
    });
  }

  next(err);
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`CampusEats Menu API on http://localhost:${PORT}`);
});
