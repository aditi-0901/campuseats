// db.js -- one shared connection pool to MySQL
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? 'YOUR_MYSQL_PASSWORD', // <-- change this (or set DB_PASSWORD)
  database: process.env.DB_NAME || 'campuseats',
  decimalNumbers: true, // return DECIMAL columns (price) as numbers, not strings
});

module.exports = pool;
