# CampusEats Menu — REST API (Node + Express)

**CS543 Web Services · Assignment 8** · Dr. Pramit Mazumdar · IIIT Vadodara

**How to run:** `npm install && node server.js`, then open <http://localhost:3000>.

## Team

| Roll No. | Name |
|---|---|
| 20251651008 | Aditi Garg |
| 20251651084 | Shivam Kumar Soni |
| 20251651064 | Neha Nupur |

## Demo

- Demonstration video: _paste Google Drive link here_
- Screenshots: [before the POST](screenshots/1-before-post.png) · [after the POST](screenshots/2-after-post.png)
- Raw `curl` output for every route: [screenshots/curl-output.txt](screenshots/curl-output.txt)

## Files

```
server.js          Express REST API (routes, validation, in-memory data)
package.json       express listed as a dependency
public/index.html  page that fetch()es the list and POSTs a new dish
public/style.css   styling
screenshots/       before / after the POST + curl transcript
```

## Answers

### 1. Which CampusEats service, and what are its routes?

The **Menu / Catalogue** service. Each dish has `id`, `name`, `price`, `available`. It is held in an in-memory array seeded with 4 dishes.

| Method | Path | Purpose |
|---|---|---|
| GET | `/items` | list the whole menu |
| GET | `/items/:id` | fetch one dish |
| POST | `/items` | create a dish (JSON body: `name`, `price`, optional `available`) |

### 2. Which status codes, and for which outcomes?

| Code | Outcome |
|---|---|
| **200 OK** | `GET /items` (list) and `GET /items/:id` when the dish exists |
| **201 Created** | `POST /items` succeeded; the body is the new dish with its generated `id` |
| **404 Not Found** | `GET /items/:id` for an id that does not exist (including non-numeric ids such as `/items/abc`) |
| **422 Unprocessable Entity** | `POST /items` with a missing or invalid required field: `name` missing/blank, or `price` missing / not a number / negative |
| 400 Bad Request | extra: `POST /items` with malformed JSON, returned as `{"error":"invalid JSON"}` |

### 3. Where are `req.params` and `req.body` used? Why does POST need `express.json()`?

- **`req.params.id`** is used in `GET /items/:id`. The `:id` part of the URL path is exposed as `req.params.id` (always a string, so it is converted with `Number()` before being compared with the numeric ids).
- **`req.body`** is used in `POST /items`. It holds the JSON the client sent (`name`, `price`, `available`).
- **Why `express.json()`:** an HTTP request body arrives as raw bytes in a stream, and Express does not read it by default. The `express.json()` middleware reads the body when the `Content-Type` is `application/json`, parses it, and puts the resulting object on `req.body`. Without it `req.body` is `undefined` and the route cannot read `name` or `price`. A `GET` has no body, so it only needs `req.params`.

## Quick test

```bash
curl localhost:3000/items
curl localhost:3000/items/2
curl -i localhost:3000/items/99                       # 404
curl -i -X POST localhost:3000/items -H "Content-Type: application/json" \
     -d '{"name":"Masala Dosa","price":60}'           # 201
curl -i -X POST localhost:3000/items -H "Content-Type: application/json" \
     -d '{"price":50}'                                # 422
```

Data is in memory, so it resets when the server restarts (a database comes in Lecture 10).
