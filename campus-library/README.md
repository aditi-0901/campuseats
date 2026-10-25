# Campus Library: HTML/CSS -> GraphQL (Node + Apollo) -> MySQL

CS543 Web Services, GraphQL hands-on tutorial.

## Structure
    campus-library/
      schema.sql      MySQL database, tables, sample rows (safe to re-run)
      db.js           MySQL connection pool (settings from environment variables)
      server.js       GraphQL schema + resolvers + server start
      package.json
      screenshots/    4 screenshots (page, API response, MySQL rows)
      public/
        index.html    page: shelves, "Add a book" and "Add an author" forms
        style.css
        app.js        front-end logic (query + mutations via fetch)

## Run (macOS / Linux terminal)
1. Install Node.js (v18+), MySQL Community Server, VS Code with Live Server.
2. Create the database (enter your MySQL root password when asked):

       mysql -u root -p < schema.sql

3. Install libraries and start the API (use your own password):

       npm install
       MYSQL_PASSWORD='your_password' npm start

   Expected: `GraphQL API ready at http://0.0.0.0:4000/`
   (On Windows PowerShell: `$env:MYSQL_PASSWORD='your_password'; npm start`)
4. Open the page: in VS Code, right-click `public/index.html` -> "Open with Live Server".
   Alternative without VS Code: `npm run web`, then open http://127.0.0.1:5500

If MySQL root has no password, omit `MYSQL_PASSWORD`. If the page stays on
"Loading", the API is not running on port 4000.

## Try in the Apollo Sandbox (http://localhost:4000/)

    query { authors { name country books { title year } } }
    query { books(year: 2021) { title author { name } } }
    mutation { addBook(title: "GraphQL for Beginners", year: 2025, authorId: 3) { id title } }
    mutation { addAuthor(name: "Kavya Rao", country: "India") { id name } }
    mutation { deleteBook(id: 4) }

## What differs from the basic tutorial
- Extra operations: `addAuthor`, `deleteBook`, and a `books(year:)` filter.
- DataLoader batching: all books of all authors load in one SQL query (no N+1).
- Input validation and clear errors (empty title, bad year, unknown author, duplicates).
- Table constraints: unique author names, unique title per author, year range check.
- No password in source code (environment variables).
- Front-end builds the page with `textContent` (no HTML injection), fills the
  author dropdown from the API, shows errors and confirmations.
