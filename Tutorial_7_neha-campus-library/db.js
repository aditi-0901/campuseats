// db.js -- one shared connection pool to MySQL.
// Settings come from environment variables, with local-development defaults,
// so the password never has to be written into the source code.
const mysql = require('mysql2/promise');

const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'neha_library',
  waitForConnections: true,
  connectionLimit: 10,
});

if (process.env.USE_IN_MEMORY_DB === '1') {
  const authors = [
    { id: 1, name: 'Ananya Sharma', country: 'India' },
    { id: 2, name: 'Kabir Verma', country: 'India' },
    { id: 3, name: 'Mira Sen', country: 'India' },
  ];
  const books = [
    { id: 1, title: 'Foundations of Computing', year: 2021, author_id: 1 },
    { id: 2, title: 'Learning SQL Step by Step', year: 2023, author_id: 1 },
    { id: 3, title: 'Web Services in Practice', year: 2024, author_id: 2 },
  ];

  console.warn('Using the in-memory development database; data resets when the API restarts.');

  module.exports = {
    async query(sql, params = []) {
      if (sql === 'SELECT 1') return [[{ 1: 1 }], []];
      if (sql === 'SELECT * FROM authors ORDER BY name') {
        return [[...authors].sort((a, b) => a.name.localeCompare(b.name)), []];
      }
      if (sql === 'SELECT * FROM books ORDER BY year, id') {
        return [[...books].sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.id - b.id), []];
      }
      if (sql === 'SELECT * FROM books WHERE year = ? ORDER BY id') {
        return [books.filter((book) => book.year === params[0]).sort((a, b) => a.id - b.id), []];
      }
      if (sql === 'SELECT * FROM books WHERE author_id IN (?) ORDER BY year, id') {
        const ids = new Set(params[0]);
        return [[...books]
          .filter((book) => ids.has(book.author_id))
          .sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.id - b.id), []];
      }
      if (sql === 'SELECT * FROM authors WHERE id IN (?)') {
        const ids = new Set(params[0]);
        return [authors.filter((author) => ids.has(author.id)), []];
      }
      if (sql === 'SELECT * FROM authors WHERE id = ?') {
        return [authors.filter((author) => author.id === params[0]), []];
      }
      if (sql === 'SELECT * FROM books WHERE id = ?') {
        return [books.filter((book) => book.id === params[0]), []];
      }
      if (sql === 'INSERT INTO authors (name, country) VALUES (?, ?)') {
        if (authors.some((author) => author.name === params[0])) {
          const error = new Error('Duplicate author');
          error.code = 'ER_DUP_ENTRY';
          throw error;
        }
        const id = Math.max(0, ...authors.map((author) => author.id)) + 1;
        authors.push({ id, name: params[0], country: params[1] });
        return [{ insertId: id }, []];
      }
      if (sql === 'INSERT INTO books (title, year, author_id) VALUES (?, ?, ?)') {
        if (!authors.some((author) => author.id === params[2])) {
          const error = new Error('Missing author');
          error.code = 'ER_NO_REFERENCED_ROW_2';
          throw error;
        }
        if (books.some((book) => book.author_id === params[2] && book.title === params[0])) {
          const error = new Error('Duplicate book');
          error.code = 'ER_DUP_ENTRY';
          throw error;
        }
        const id = Math.max(0, ...books.map((book) => book.id)) + 1;
        books.push({ id, title: params[0], year: params[1], author_id: params[2] });
        return [{ insertId: id }, []];
      }
      if (sql === 'DELETE FROM books WHERE id = ?') {
        const index = books.findIndex((book) => book.id === params[0]);
        if (index === -1) return [{ affectedRows: 0 }, []];
        books.splice(index, 1);
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unsupported in-memory query: ${sql}`);
    },
  };
} else {
  module.exports = mysqlPool;
}
