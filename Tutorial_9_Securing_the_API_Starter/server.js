// server.js -- the CampusEats Catalogue, now SECURED (Node + Express)
// Authentication (JWT) + Authorization (roles) on top of a plain REST service.

require("dotenv").config();

const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());

// The signing secret is loaded from the environment and never hardcoded.
const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  throw new Error("JWT_SECRET is required. Set it in your .env file.");
}

// Seed users -- passwords are hashed once at startup (never stored in plain text).
const users = [
  {
    id: 1,
    name: "Neha Nupur",
    email: "neha@campus.edu",
    role: "customer",
    hash: bcrypt.hashSync("neha123", 10),
  },
  {
    id: 2,
    email: "mealhub@campus.edu",
    role: "restaurant",
    hash: bcrypt.hashSync("resto123", 10),
  },
];

let items = [
  { id: 1, name: "Veg Thali", price: 90 },
  { id: 2, name: "Paneer Roll", price: 70 },
];
let nextId = 3;

// POST /login  -- verify the password, hand back a signed JWT.
app.post("/login", (req, res) => {
  const user = users.find((u) => u.email === req.body.email);
  if (!user || !bcrypt.compareSync(req.body.password, user.hash))
    return res.status(401).json({ error: "bad login" });
  const token = jwt.sign({ sub: user.id, role: user.role }, SECRET, {
    expiresIn: "1h",
  });
  res.json({ token });
});

// Authentication -- WHO are you? (verify the token, else 401)
function auth(req, res, next) {
  const token = (req.get("Authorization") || "").split(" ")[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "invalid or missing token" });
  }
}

// Authorization -- are you ALLOWED? (check the role, else 403)
function requireRole(...allowed) {
  return (req, res, next) =>
    allowed.includes(req.user.role)
      ? next()
      : res.status(403).json({ error: "forbidden" });
}

// GET /items  -- any authenticated user may read the menu.
app.get("/items", auth, (req, res) => res.json(items));

// POST /items -- only a restaurant (or admin) may add a dish.
app.post("/items", auth, requireRole("restaurant", "admin"), (req, res) => {
  const { name, price } = req.body;
  if (!name) return res.status(422).json({ error: "name required" });
  const item = { id: nextId++, name, price: Number(price) || 0 };
  items.push(item);
  res.status(201).json(item);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Secured Catalogue on http://localhost:${PORT}`),
);
