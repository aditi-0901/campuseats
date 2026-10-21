# CampusEats Catalogue Service — GraphQL (Assignment 7, CS543 Web Services)

One small CampusEats service exposed through a **GraphQL API**: one schema, queries and a
mutation, backed by **MySQL**, demonstrated on a plain **HTML/CSS** page.

**Team:** _(add team member names here)_ · **Roll numbers:** _(add roll numbers here)_

## Run it (one command)
Requires Node.js 18+ and a running MySQL 8 server.
```
./run.sh
```
It asks for the MySQL root password, creates the `campuseats` database and seed rows on the
first run, installs dependencies, starts the GraphQL API on **:4000** and the page on **:5500**,
then opens the browser. `Ctrl+C` stops everything. To skip the password prompt:
`DB_PASSWORD='yourpassword' ./run.sh`.

## What was picked (Answer 1)
The **Catalogue / Menu service** — the food outlets and the menu items they serve. It is modelled
as two tables, `outlets` (1) and `menu_items` (many), mirroring the tutorial's `authors` (1) /
`books` (many) pair. The **`MenuItem`** object is the required single entity: `id`, `name`,
`price`, `available`.

| Tutorial (Books & Authors) | CampusEats (this project) |
|---|---|
| `authors` / `books` | `outlets` / `menu_items` |
| `Query.authors` (nested books) | `Query.outlets` (nested `menuItems`) |
| `Query.book(id)` | `Query.outlet(id)` |
| `Mutation.addBook` | `Mutation.addMenuItem` |

## Schema (Answer 2 — the `!` sign)
The full SDL lives in [`schema.graphql`](schema.graphql). Non-null fields are marked with `!`.

- **A field a client CAN skip:** `description` on `MenuItem` (declared `String`, no `!`). A menu
  item does not have to carry a description, so the mutation omits it freely and the API may
  return `null`.
- **A field a client CANNOT skip:** `name` on `MenuItem` (declared `String!`). The `!` means
  non-null — GraphQL rejects the request before it even reaches the resolver if `name` is
  missing, and guarantees every returned `MenuItem` has a name.

`price: Float!` and the mutation's `outletId: ID!` work the same way: no price or no outlet, no
row.

## Mapping to SQL (Answer 3)
- **The `WHERE` clause** comes from the by-id part of the query. `Query.outlet(id: ID!)` takes the
  `id` argument and the resolver runs
  `SELECT ... FROM outlets WHERE outlet_id = ?` — the requested `id` becomes the `WHERE` value
  (bound as a `?` placeholder). The nested `menuItems` field does the same for the child rows:
  `... FROM menu_items WHERE outlet_id = ?`.
- **The `INSERT`** is run by the **`Mutation.addMenuItem`** resolver in [`server.js`](server.js):
  `INSERT INTO menu_items (outlet_id, name, description, price) VALUES (?, ?, ?, ?)`. It then
  re-selects the new row by its auto-increment id so the mutation can return the created
  `MenuItem`.

## Deliverables
- [`schema.graphql`](schema.graphql) — object types, `Query` (list + by-id) and `Mutation`.
- [`server.js`](server.js) + [`db.js`](db.js) — Apollo Server over MySQL via `mysql2`.
- [`schema.sql`](schema.sql) — table definitions and 4 seed rows.
- [`public/index.html`](public/index.html) — page that `fetch()`es the API, lists the data and
  has one button that fires the mutation.
- `screenshots/` — before / after the mutation, and this README.

## Try it yourself
Query (list dishes), in the Apollo Sandbox at http://localhost:4000/:
```graphql
query {
  outlets { id name menuItems { id name price isAvailable } }
}
```
Mutation (add a dish — fires the same `INSERT` the page's button does):
```graphql
mutation {
  addMenuItem(outletId: 1, name: "Paneer Roll", description: "Spicy, with chutney", price: 90) {
    id name price isAvailable
  }
}
```

## Screenshots
- [`screenshots/1-list-before-mutation.png`](screenshots/1-list-before-mutation.png) — the page
  listing the 4 seed dishes before any change.
- [`screenshots/2-after-mutation.png`](screenshots/2-after-mutation.png) — the same page after
  clicking **Add item** to insert *Paneer Roll (₹90)*; the new dish appears under *Main Canteen*.

## Notes
- Dr. Pramit Mazumdar · pramit.mazumdar@iiitvadodara.ac.in
- A demonstration video (Google Drive link) can be added here by the team before submission.
