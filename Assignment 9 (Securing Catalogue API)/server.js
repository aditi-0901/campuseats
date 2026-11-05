const path = require("path");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = "1h";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const users = [
  {
    id: 1,
    username: "customer",
    role: "customer",
    passwordHash:
      "$2b$10$VyqG8Q8OQA/dGjzulhYoZOHuyzZWYk6KdIdo22nlk6.oqd4hyEn8.",
  },
  {
    id: 2,
    username: "restaurant",
    role: "restaurant",
    passwordHash:
      "$2b$10$qV/P7d/.NStC8e3nH2i2NeCQg89yiW4TInVu/rsJiEBPEL5IvBXXC",
  },
];

let items = [
  { id: 1, name: "Veg Thali", price: 90, available: true },
  { id: 2, name: "Paneer Roll", price: 70, available: true },
  { id: 3, name: "Masala Chai", price: 15, available: true },
  { id: 4, name: "Chole Bhature", price: 80, available: false },
];
let nextId = 5;

function auth(req, res, next) {
  const authorization = req.get("Authorization") || "";
  const parts = authorization.split(" ");
  const token = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : null;

  if (!token) {
    return res
      .status(401)
      .json({ error: "missing or invalid authorization token" });
  }

  try {
    req.user = jwt.verify(token, SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "invalid or expired token" });
  }
}

const requireRole =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden: insufficient role" });
    }
    return next();
  };

app.post("/login", (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(401).json({ error: "invalid username or password" });
  }

  const user = users.find((entry) => entry.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "invalid username or password" });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });

  return res.json({
    message: "login successful",
    token,
    tokenType: "Bearer",
    expiresIn: TOKEN_EXPIRY,
    user: { id: user.id, username: user.username, role: user.role },
  });
});

app.get("/items", auth, (req, res) => {
  return res.status(200).json(items);
});

app.get("/items/:id", auth, (req, res) => {
  const item = items.find((entry) => entry.id === Number(req.params.id));
  if (!item) {
    return res.status(404).json({ error: "not found" });
  }
  return res.status(200).json(item);
});

app.post("/items", auth, requireRole("restaurant", "admin"), (req, res) => {
  const { name, price, available } = req.body || {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(422).json({ error: "name required" });
  }
  if (
    price === undefined ||
    price === null ||
    price === "" ||
    !Number.isFinite(Number(price)) ||
    Number(price) < 0
  ) {
    return res
      .status(422)
      .json({ error: "price required (a number, 0 or more)" });
  }

  const item = {
    id: nextId++,
    name: name.trim(),
    price: Number(price),
    available:
      available === undefined
        ? true
        : available === true || available === "true",
  };

  items.push(item);
  return res.status(201).json(item);
});

app.put("/items/:id", auth, requireRole("restaurant", "admin"), (req, res) => {
  const id = Number(req.params.id);
  const item = items.find((entry) => entry.id === id);

  if (!item) {
    return res.status(404).json({ error: "not found" });
  }

  const { name, price, available } = req.body || {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(422).json({ error: "name required" });
  }

  if (
    price === undefined ||
    price === null ||
    price === "" ||
    !Number.isFinite(Number(price)) ||
    Number(price) < 0
  ) {
    return res
      .status(422)
      .json({ error: "price required (a number, 0 or more)" });
  }

  item.name = name.trim();
  item.price = Number(price);

  if (available !== undefined) {
    item.available = available === true || available === "true";
  }

  return res.status(200).json({
    message: "item updated successfully",
    item,
  });
});

app.delete(
  "/items/:id",
  auth,
  requireRole("restaurant", "admin"),
  (req, res) => {
    const id = Number(req.params.id);
    const itemIndex = items.findIndex((entry) => entry.id === id);

    if (itemIndex === -1) {
      return res.status(404).json({ error: "not found" });
    }

    const deletedItem = items.splice(itemIndex, 1)[0];

    return res.status(200).json({
      message: "item deleted successfully",
      item: deletedItem,
    });
  },
);

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "invalid JSON" });
  }
  return res.status(500).json({ error: "internal server error" });
});

if (!SECRET) {
  throw new Error(
    "JWT_SECRET is missing. Create a .env file using .env.example.",
  );
}

if (require.main === module) {
  app.listen(PORT, () => {
    process.stdout.write(
      `CampusEats Catalogue API on http://localhost:${PORT}\n`,
    );
  });
}

module.exports = app;
