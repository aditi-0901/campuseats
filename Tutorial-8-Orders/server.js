const path = require("path");

const express = require("express");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
let orders = [
  {
    id: 1,
    item: "Paneer Thali",
    price: 120,
  },
  {
    id: 2,
    item: "Masala Dosa",
    price: 80,
  },
  {
    id: 3,
    item: "Veg Burger",
    price: 60,
  },
  {
    id: 4,
    item: "Cold Coffee",
    price: 90,
  },
];

let nextId = 5;

app.get("/orders", (req, res) => {
  res.json(orders);
});

app.get("/orders/:id", (req, res) => {
  const order = orders.find((o) => o.id === Number(req.params.id));

  if (!order) {
    return res.status(404).json({
      error: "Order not found",
    });
  }

  res.json(order);
});

app.post("/orders", (req, res) => {
  const { item, price } = req.body;

  if (!item) {
    return res.status(422).json({
      error: "Item name is required",
    });
  }

  const order = {
    id: nextId++,
    item: item,
    price: Number(price) || 0,
  };

  orders.push(order);

  res.status(201).json(order);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 3000;

app.put("/orders/:id", (req, res) => {
  const id = Number(req.params.id);

  const order = orders.find((o) => o.id === id);

  if (!order) {
    return res.status(404).json({
      error: "Order not found",
    });
  }

  const { item, price } = req.body;

  if (!item || price === undefined || !Number.isFinite(Number(price))) {
    return res.status(422).json({
      error: "Item name and a valid price are required",
    });
  }

  order.item = item;
  order.price = Number(price);

  res.json(order);
});

app.delete("/orders/:id", (req, res) => {
  const id = Number(req.params.id);

  const orderIndex = orders.findIndex((o) => o.id === id);

  if (orderIndex === -1) {
    return res.status(404).json({
      error: "Order not found",
    });
  }

  const deletedOrder = orders.splice(orderIndex, 1);

  res.json({
    message: "Order deleted successfully",
    order: deletedOrder[0],
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
