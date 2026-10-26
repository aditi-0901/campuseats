# CampusEats Menu Service in GraphQL

CS543 · Web Services · Assignment 7 of 12 · Group 7

| Role | Name | Roll No. |
|---|---|---|
| Group Leader | Aditi Garg | 20251651008 |
| Group Member | Neha Nupur | 20251651064 |
| Group Member | Shivam Kumar Soni | 20251651084 |

## How to run

With Node.js 20+ and MySQL 8 running, in this folder (leave out `MYSQL_PASSWORD=...` if your MySQL root has no password):

```bash
mysql -u root -p < schema.sql && npm install && MYSQL_PASSWORD='your_password' npm start
```

Then open **http://localhost:4000**. One server serves both the page and the API (`/graphql`). Re-running `schema.sql` resets the demo data.

On Windows PowerShell run the three commands separately and set the password with `$env:MYSQL_PASSWORD='your_password'` before `npm start`.

## What is in this folder

| File | Purpose |
|---|---|
| `schema.graphql` | The `Dish` type, `AddDishInput`, the `Query` and the `Mutation` |
| `schema.sql` | `menu_items` table and 4 seed rows |
| `db.js` | `mysql2` connection pool (settings from environment variables) |
| `server.js` | Apollo Server and the resolvers that run the SQL |
| `public/index.html` | Plain HTML/CSS page that `fetch()`es the API: lists the dishes, one form button fires the mutation |

## Try it

```graphql
query    { dishes { id name price available } }
mutation { addDish(input: { name: "Paneer Roll", price: 90 }) { id name price } }
```

These can be run from the page, or in Apollo Sandbox at http://localhost:4000/graphql. A single dish: `{ dish(id: 2) { name price } }`.

## Demo

- Video: _add the Google Drive link here_

| Before the mutation | After the mutation |
|---|---|
| ![Before](screenshots/before.png) | ![After](screenshots/after.png) |

---

## Answers

### 1. Which CampusEats service did you pick?

The **Catalogue Service**, and within it the **Menu Item** entity. In GraphQL it is the `Dish` type (`id`, `name`, `price`, `available`), stored in the `menu_items` table. That is the same table as in our Assignment 2 schema (Task 5), cut down to the fields this assignment needs: `outlet_id` and `description` are left out so the demo stays one table.

| GraphQL field | MySQL column |
|---|---|
| `id` | `menu_item_id` (selected `AS id`) |
| `name` | `name` |
| `price` | `price` (`DECIMAL(10,2)`, returned as a number) |
| `available` | `is_available` (`BOOLEAN`, selected `AS available`) |

### 2. Name one field a client can skip and one it cannot (why we use the "!" sign).

In the `AddDishInput` that a client sends to `addDish`:

- **Can skip: `available`.** It is declared `available: Boolean = true`, with no `!`. The example `addDish(input: { name: "Paneer Roll", price: 90 })` leaves it out and the dish is created as available.
- **Cannot skip: `name`** (and likewise `price`). It is declared `name: String!`. If a client leaves it out, GraphQL rejects the request before any resolver or SQL runs:
  `Field "AddDishInput.name" of required type "String!" was not provided.`

`!` means non-null. We use it so that the schema itself states, and GraphQL itself enforces, what is mandatory. A request with a missing `name` or `price` never reaches MySQL, which matches the `NOT NULL` columns in `menu_items`. On the output side every field of `Dish` is `!` as well, because every column is `NOT NULL`: a client can rely on getting a real `id`, `name`, `price` and `available` without null checks. (Separately, a client may leave any field out of what it asks for, for example `{ dishes { name } }` returns only the names.)

### 3. Map it to SQL: which part of your query became the WHERE, and which resolver ran the INSERT?

**WHERE.** The list query `dishes { ... }` has no argument, so there is nothing to filter and its SQL has no `WHERE`:

```sql
SELECT menu_item_id AS id, name, price, is_available AS available FROM menu_items ORDER BY menu_item_id
```

The by-id query `dish(id: 2)` does: its **`id` argument became the WHERE clause**, with the value bound to the `?` placeholder:

```sql
SELECT menu_item_id AS id, name, price, is_available AS available FROM menu_items WHERE menu_item_id = ?
```

If no row matches, the resolver returns `null` and the client gets `{ "dish": null }`. The fields a client selects (`id name price available`) do not change the SQL; the resolver reads all four columns and GraphQL returns only the ones that were asked for.

**INSERT.** The **`Mutation.addDish` resolver in `server.js`** ran it:

```sql
INSERT INTO menu_items (name, price, is_available) VALUES (?, ?, ?)
```

It then read the new row back with `SELECT ... WHERE menu_item_id = ?` using `insertId`, so the response carries the id MySQL assigned (`5` for Paneer Roll on the seeded data). All values go in through `?` placeholders, never by joining strings, so a dish name such as `'; DROP TABLE menu_items;--` is stored as plain text.
