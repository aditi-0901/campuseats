// server.js -- Neha's Campus Library GraphQL API
// Implements the Tutorial 7 author/book queries, relationship resolvers and addBook mutation.
const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const { GraphQLError } = require('graphql');
const DataLoader = require('dataloader');
const pool = require('./db');

const PORT = Number(process.env.PORT) || 4000;

/* ---------- 1. Schema: what the API offers ---------- */
const typeDefs = `#graphql
  type Author {
    id: ID!
    name: String!
    country: String
    books: [Book!]!
  }

  type Book {
    id: ID!
    title: String!
    year: Int
    author: Author!
  }

  type Query {
    authors: [Author!]!
    author(id: ID!): Author
    "All books, optionally only those published in one year."
    books(year: Int): [Book!]!
  }

  type Mutation {
    addAuthor(name: String!, country: String): Author!
    addBook(title: String!, year: Int, authorId: ID!): Book!
    deleteBook(id: ID!): Boolean!
  }
`;

/* ---------- helpers ---------- */
function userError(message) {
  return new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

function parseId(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw userError(`${label} must be a positive whole number.`);
  return n;
}

function cleanText(value, label, max, { required }) {
  const text = (value ?? '').trim();
  if (required && !text) throw userError(`${label} must not be empty.`);
  if (text.length > max) throw userError(`${label} must be at most ${max} characters.`);
  return text || null;
}

function cleanYear(year) {
  if (year === null || year === undefined) return null;
  if (year < 1000 || year > 2100) throw userError('Year must be between 1000 and 2100.');
  return year;
}

/* Per-request loaders: many "books of author X" / "author of book Y" lookups
   made while resolving one request are merged into a single SQL query each,
   which avoids the N+1 query problem. */
function createLoaders() {
  return {
    booksByAuthor: new DataLoader(async (authorIds) => {
      const [rows] = await pool.query(
        'SELECT * FROM books WHERE author_id IN (?) ORDER BY year, id',
        [authorIds]
      );
      return authorIds.map((id) => rows.filter((b) => b.author_id === id));
    }),
    authorById: new DataLoader(async (ids) => {
      const [rows] = await pool.query('SELECT * FROM authors WHERE id IN (?)', [ids]);
      return ids.map((id) => rows.find((a) => a.id === id) || null);
    }),
  };
}

/* ---------- 2. Resolvers: how each field gets its data ---------- */
const resolvers = {
  Query: {
    authors: async () => {
      const [rows] = await pool.query('SELECT * FROM authors ORDER BY name');
      return rows;
    },
    author: async (_parent, { id }, { loaders }) => loaders.authorById.load(parseId(id, 'id')),
    books: async (_parent, { year }) => {
      const [rows] =
        year === undefined || year === null
          ? await pool.query('SELECT * FROM books ORDER BY year, id')
          : await pool.query('SELECT * FROM books WHERE year = ? ORDER BY id', [year]);
      return rows;
    },
  },

  // relationship fields
  Author: {
    books: (author, _args, { loaders }) => loaders.booksByAuthor.load(author.id),
  },
  Book: {
    author: (book, _args, { loaders }) => loaders.authorById.load(book.author_id),
  },

  Mutation: {
    addAuthor: async (_parent, { name, country }) => {
      const cleanName = cleanText(name, 'Name', 100, { required: true });
      const cleanCountry = cleanText(country, 'Country', 50, { required: false });
      try {
        const [result] = await pool.query(
          'INSERT INTO authors (name, country) VALUES (?, ?)',
          [cleanName, cleanCountry]
        );
        const [rows] = await pool.query('SELECT * FROM authors WHERE id = ?', [result.insertId]);
        return rows[0];
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') throw userError(`Author "${cleanName}" already exists.`);
        throw err;
      }
    },

    addBook: async (_parent, { title, year, authorId }) => {
      const cleanTitle = cleanText(title, 'Title', 200, { required: true });
      const validYear = cleanYear(year);
      const aid = parseId(authorId, 'authorId');
      try {
        const [result] = await pool.query(
          'INSERT INTO books (title, year, author_id) VALUES (?, ?, ?)',
          [cleanTitle, validYear, aid]
        );
        const [rows] = await pool.query('SELECT * FROM books WHERE id = ?', [result.insertId]);
        return rows[0];
      } catch (err) {
        if (err.code === 'ER_NO_REFERENCED_ROW_2') throw userError(`No author with id ${aid}.`);
        if (err.code === 'ER_DUP_ENTRY') throw userError('This author already has a book with that title.');
        throw err;
      }
    },

    deleteBook: async (_parent, { id }) => {
      const [result] = await pool.query('DELETE FROM books WHERE id = ?', [parseId(id, 'id')]);
      return result.affectedRows > 0;
    },
  },
};

/* ---------- 3. Start the server ---------- */
async function start() {
  await pool.query('SELECT 1'); // fail fast with a clear message if MySQL is unreachable
  const server = new ApolloServer({ typeDefs, resolvers });
  const { url } = await startStandaloneServer(server, {
    context: async () => ({ loaders: createLoaders() }),
    listen: { port: PORT },
  });
  console.log(`GraphQL API ready at ${url}`);
}

start().catch((err) => {
  console.error('Could not start the API:', err.message);
  process.exit(1);
});
