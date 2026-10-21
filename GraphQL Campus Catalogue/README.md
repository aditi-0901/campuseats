# CampusEats Catalogue — GraphQL tutorial app

HTML/CSS → GraphQL (Node + Apollo) → MySQL, applied to the CampusEats Catalogue Service
(`outlets` 1 — many `menu_items`, as defined in Assignment 2, Task 5).

| Tutorial (authors/books) | CampusEats (this project) |
|---|---|
| `authors`, `books` | `outlets`, `menu_items` |
| `Query.authors` (with nested books) | `Query.outlets` (with nested `menuItems`) |
| `Mutation.addBook` | `Mutation.addMenuItem` |

## Run (one command)
Requires Node.js 18+, Python 3 and a running MySQL 8 server.
```
./run.sh
```
It asks for your MySQL root password, creates the database (first run only), installs
dependencies, starts the API on :4000 and the page on :5500, and opens the browser. Ctrl+C stops everything.
To skip the prompt: `DB_PASSWORD='yourpassword' ./run.sh`.
If you get "permission denied", run `chmod +x run.sh` once (or use `bash run.sh`).

## Test query (paste in Sandbox)
```graphql
query {
  outlets { name address menuItems { name price isAvailable } }
}
```

## Test mutation
```graphql
mutation {
  addMenuItem(outletId: 2, name: "Bun Maska", description: "Fresh, with butter", price: 25.5) {
    id name price outlet { name }
  }
}
```
