# Campus Library: HTML/CSS -> GraphQL (Node + Apollo) -> MySQL

CS543 Web Services, GraphQL hands-on tutorial.

## Structure

    neha-campus-library/
      schema.sql      MySQL database, tables, and sample rows (safe to re-run)
      db.js           MySQL connection pool (settings from environment variables)
      server.js       GraphQL schema, resolvers, and server start
      package.json
      public/
        index.html    Campus Library page and add-book/add-author forms
        style.css     Responsive editorial design
        app.js        Front-end logic (queries and mutations via fetch)

## Run on Windows PowerShell

1. Install Node.js (v18+), MySQL Community Server, and VS Code.
   The VS Code Live Server extension is optional.

2. Open PowerShell in this project directory and create the database.
   Enter your MySQL root password when prompted:

       cmd /c "mysql -u root -p < schema.sql"

3. Install the project libraries:

       npm install

4. Start the GraphQL API using your own MySQL password:

       $env:MYSQL_PASSWORD="your_password"
       npm start

   Expected:

       GraphQL API ready at http://localhost:4000/

   If your MySQL root account has no password, omit `MYSQL_PASSWORD`.
   Optional settings are `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`,
   `MYSQL_DATABASE`, and `PORT`.

5. Open the frontend. In VS Code, right-click `public/index.html` and choose
   **Open with Live Server**, then open:

       http://127.0.0.1:5500

   If Live Server is not installed, open a second PowerShell terminal and run:

       npm run web

       http://127.0.0.1:5500

Keep the API terminal running while using the web page. If the page stays on
"Opening the shelves...", make sure the API is running on port 4000 and that
the browser can reach it.

### Temporary Windows demo without MySQL

If MySQL is not available, the project includes an explicit in-memory mode for
testing the GraphQL API and frontend:

    $env:USE_IN_MEMORY_DB="1"
    npm start

This mode includes the sample rows and supports the app's queries and
mutations, but changes are lost when the API restarts. Use MySQL for persistent
data.

## Try in the Apollo Sandbox (http://localhost:4000/)

    query {
      authors {
        name
        country
        books {
          title
          year
        }
      }
    }

    query {
      books(year: 2021) {
        title
        author {
          name
        }
      }
    }

    mutation {
      addBook(title: "GraphQL for Beginners", year: 2025, authorId: 3) {
        id
        title
      }
    }

    mutation {
      addAuthor(name: "Kavya Rao", country: "India") {
        id
        name
      }
    }

    mutation {
      deleteBook(id: 4)
    }

## Check the MySQL rows

To see books together with their authors:

    mysql -u root -p neha_library

    SELECT
      b.id,
      b.title,
      b.year,
      a.name AS author
    FROM books AS b
    JOIN authors AS a ON a.id = b.author_id
    ORDER BY b.id;

You can also inspect the database structure:

    SHOW TABLES;
    SELECT * FROM authors;
    SELECT * FROM books;
