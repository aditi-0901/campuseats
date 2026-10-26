// db.js -- one shared MySQL connection pool (mysql2), used by every resolver.
// Connection settings come from environment variables, with local defaults,
// so no password is ever written into the source code.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'campuseats_graphql',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
