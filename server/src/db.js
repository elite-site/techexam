const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 14, // keep under the Supabase pooler's 15-session cap; excess sockets are rejected (EMAXCONNSESSION)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[db] idle client error', err.message);
});

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };