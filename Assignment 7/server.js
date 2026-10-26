// server.js -- CampusEats Menu service: GraphQL API (Apollo Server) over MySQL.
// One process serves both the API (POST /graphql) and the demo page (public/).
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express5');
const { GraphQLError } = require('graphql');
const pool = require('./db');

const PORT = Number(process.env.PORT) || 4000;

/* ---------- 1. Schema: read from schema.graphql, so the file that is
   submitted is exactly the file that runs ---------- */
const typeDefs = fs.readFileSync(path.join(__dirname, 'schema.graphql'), 'utf8');

/* ---------- 2. SQL <-> GraphQL naming ----------
   The table keeps the Assignment 2 column names (menu_item_id, is_available);
   the schema uses shorter field names (id, available). The AS aliases below
   are the whole mapping. */
const DISH_COLUMNS = 'menu_item_id AS id, name, price, is_available AS available';

// MySQL hands back DECIMAL as a string and BOOLEAN as 0/1; convert them so the
// resolvers return exactly what the schema promises (Float!, Boolean!).
function toDish(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    available: Boolean(row.available),
  };
}

/* ---------- input checks (sanity only, no business rules) ---------- */
function userError(message) {
  return new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

function parseId(value) {
  const text = String(value);
  if (!/^[1-9]\d{0,9}$/.test(text)) throw userError('id must be a positive whole number.');
  return Number(text);
}

function cleanName(value) {
  const name = value.trim();
  if (!name) throw userError('name must not be empty.');
  if (name.length > 100) throw userError('name must be at most 100 characters.');
  return name;
}

function cleanPrice(value) {
  if (!Number.isFinite(value) || value < 0) throw userError('price must be a number, 0 or more.');
  if (value > 99999999.99) throw userError('price is too large.');
  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) > 1e-6) throw userError('price can have at most 2 decimal places.');
  return cents / 100;
}

/* ---------- 3. Resolvers: each one runs the SQL for its field ---------- */
const resolvers = {
  Query: {
    // list -> no filter, so no WHERE
    dishes: async () => {
      const [rows] = await pool.query(
        `SELECT ${DISH_COLUMNS} FROM menu_items ORDER BY menu_item_id`
      );
      return rows.map(toDish);
    },

    // by id -> the `id` argument becomes the WHERE clause
    dish: async (_parent, { id }) => {
      const [rows] = await pool.query(
        `SELECT ${DISH_COLUMNS} FROM menu_items WHERE menu_item_id = ?`,
        [parseId(id)]
      );
      return rows.length ? toDish(rows[0]) : null;
    },
  },

  Mutation: {
    // add -> this resolver runs the INSERT
    addDish: async (_parent, { input }) => {
      const name = cleanName(input.name);
      const price = cleanPrice(input.price);
      const available = input.available ?? true; // skipped (or null) -> available

      const [result] = await pool.query(
        'INSERT INTO menu_items (name, price, is_available) VALUES (?, ?, ?)',
        [name, price, available]
      );
      // read the new row back so the client gets what MySQL actually stored
      const [rows] = await pool.query(
        `SELECT ${DISH_COLUMNS} FROM menu_items WHERE menu_item_id = ?`,
        [result.insertId]
      );
      return toDish(rows[0]);
    },
  },
};

/* ---------- 4. Start the server ---------- */
async function start() {
  // fail fast, with a useful hint, if MySQL is down or schema.sql was not loaded
  try {
    await pool.query('SELECT 1 FROM menu_items LIMIT 1');
  } catch (err) {
    throw new Error(`${err.message}\n  -> Is MySQL running, and did you load schema.sql? (mysql -u root -p < schema.sql)`);
  }

  // no stack traces in error responses: clients get the message, not file paths
  const apollo = new ApolloServer({ typeDefs, resolvers, includeStacktraceInErrorResponses: false });
  await apollo.start();

  const app = express();
  app.use('/graphql', cors(), express.json(), expressMiddleware(apollo));
  app.use(express.static(path.join(__dirname, 'public')));

  // Express 5 passes a start-up failure (e.g. port taken) to this callback
  app.listen(PORT, (err) => {
    if (err) {
      console.error(
        err.code === 'EADDRINUSE'
          ? `Port ${PORT} is already in use. Stop the other server or run with PORT=<another port>.`
          : `Server error: ${err.message}`
      );
      process.exit(1);
    }
    console.log(`Page:        http://localhost:${PORT}/`);
    console.log(`GraphQL API: http://localhost:${PORT}/graphql`);
  });
}

start().catch((err) => {
  console.error('Could not start the API:', err.message);
  process.exit(1);
});
