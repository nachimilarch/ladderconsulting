require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST || 'localhost',
  port:               process.env.DB_PORT || 3306,
  database:           process.env.DB_NAME || 'ladder_consulting',
  user:               process.env.DB_USER || 'root',
  password:           process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
});

pool.getConnection()
  .then(conn => {
    console.log('✅ DB connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('❌ DB connection failed:', err.message);
    // Do not exit — let the server start; DB errors will surface per-request
  });

module.exports = pool;
