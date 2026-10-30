# CampusEats — Orders Service (REST API)

**CS543 · Web Services · Assignment 8 of 12 · Group 7**

| Role         | Name              | Roll No.    |
| ------------ | ----------------- | ----------- |
| Group Leader | Aditi Garg        | 20251651008 |
| Group Member | Neha Nupur        | 20251651064 |
| Group Member | Shivam Kumar Soni | 20251651084 |

## Run the project

**Requirements:** Node.js 18 or newer and npm.

```bash
npm install
npm start
```

Open **http://localhost:4000** in your browser. The same Express server hosts the page from `public/` and the REST API. Stop it with `Ctrl + C`. The data is intentionally stored in memory, so newly created orders reset when the server restarts.

## What was built

This assignment implements the **Orders Service** of CampusEats as a small REST API using Node.js and Express. The Order fields follow the Order entity used in the earlier CampusEats Orders work: `id`, `studentId`, `itemId`, `qty`, and `status`, with `createdAt` added for display. Four sample orders are loaded at startup.

### REST routes

| Method | Path          | Purpose                   | Success / failure                                                                                                      |
| ------ | ------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/orders`     | List all orders           | `200 OK` with a JSON array                                                                                             |
| `GET`  | `/orders/:id` | Fetch one order by its ID | `200 OK`; `404 Not Found` if absent or invalid                                                                         |
| `POST` | `/orders`     | Create an order           | `201 Created` with the new order and a `Location: /orders/{id}` header; `422 Unprocessable Content` for invalid fields |

### Example requests

List orders:

```bash
curl -i http://localhost:4000/orders
```

Fetch order 1:

```bash
curl -i http://localhost:4000/orders/1
```

Create an order:

```bash
curl -i -X POST http://localhost:4000/orders \
  -H "Content-Type: application/json" \
  -d '{"studentId":"20251651064","itemId":2,"qty":2}'
```

Try a missing order and a validation failure:

```bash
curl -i http://localhost:4000/orders/999
curl -i -X POST http://localhost:4000/orders \
  -H "Content-Type: application/json" \
  -d '{"studentId":"","itemId":0,"qty":-1}'
```

## Assignment answers

### 1. Which CampusEats service did you pick, and what are its routes (method + path)?

We picked the **Orders Service**, which owns campus food orders and their basic details/status. Its routes are:

- `GET /orders` — list all orders.
- `GET /orders/:id` — fetch one order using its ID.
- `POST /orders` — create a new order.

### 2. Which status codes did you return, and for which outcomes (200 / 201 / 404 / 422)?

- **200 OK:** The order list or a requested existing order is returned successfully.
- **201 Created:** A valid order is added to the in-memory collection. The response includes the created order and a `Location` header pointing to `/orders/{id}`.
- **404 Not Found:** The requested order ID is invalid or no order with that ID exists.
- **422 Unprocessable Content:** The JSON is syntactically valid, but required order fields are missing or invalid. The response identifies each invalid field.

Malformed JSON is additionally handled as `400 Bad Request`.

### 3. Where did you use `req.params` and where `req.body`? Why does POST need `express.json()`?

- **`req.params`:** In `GET /orders/:id`, `req.params.id` reads the ID embedded in the URL path. It tells the server which order to find.
- **`req.body`:** In `POST /orders`, `req.body` contains the submitted `studentId`, `itemId`, and `qty` values. The handler validates these values before creating an order.
- **`express.json()`:** The browser sends the new order as JSON with `Content-Type: application/json`. `express.json()` parses that JSON request stream and makes the resulting JavaScript object available as `req.body`. Without the middleware, the handler would not receive the parsed object.

## Project structure

```text
Assignment 8 (Orders)/
├── server.js              # Express app, seed data, three REST routes, validation
├── package.json           # Express dependency and run/test scripts
├── package-lock.json      # Locked dependency versions
├── public/
│   ├── index.html         # Orders dashboard and create-order form
│   ├── style.css          # Responsive page styling
│   └── app.js             # fetch() list/create logic and UI refresh
├── tests/
│   └── orders.test.js     # Route and validation tests
├── screenshots/
│   ├── before.png         # UI preview with the four seed orders
│   └── after.png          # UI preview with a fifth order
├── tests/
│   └── orders.test.js     # Route and validation tests
└── transcript.txt         # HTTP verification transcript
```

## Front-end behaviour

The plain HTML/CSS/JavaScript page is served using `express.static('public')`. On page load, `fetch('/orders')` gets and displays the seed records. The form sends a JSON `POST /orders`; after a successful `201`, the page fetches the list again so the newly created record and summary counts appear without reloading the browser. The page also displays validation errors returned by the API.

## Verification

Run automated tests with:

```bash
npm test
```

The tests cover listing the seeded orders, fetching an existing order, returning 404 for a missing order, creating an order with 201 and a Location header, and rejecting invalid input with 422. All five automated tests passed during preparation of this ZIP. See `transcript.txt` for request/response examples and `screenshots/` for before/after UI preview images. The execution environment used to prepare this ZIP did not provide a working headless browser capture, so these are illustrative page previews rather than live-browser screenshots. For the exact screenshot requirement, open the app locally, create an order, and replace them with your own browser captures.

## Demo video

Google Drive demonstration video: **[https://drive.google.com/file/d/1WbYqdZWsX3LVTI3CDWy0mWqTCsOg0CHt/view?usp=drive_link]**
