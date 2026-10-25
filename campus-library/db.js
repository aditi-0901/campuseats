// db.js -- one shared connection pool to MySQL.
// Settings come from environment variables, with local-development defaults,
// so the password never has to be written into the source code.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'campus_library',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
