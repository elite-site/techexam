#!/usr/bin/env node
// ---------------------------------------------------------------------
// Destructive database reset:
//   1. wipe every table / sequence / view in the public schema
//   2. recreate the ELITE schema from schema.sql
// Use with care — this drops ALL data in the connected Supabase project.
// ---------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const { pool, query } = require('./db');

async function wipePublic() {
  const { rows: tables } = await query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  for (const r of tables) {
    await query(`DROP TABLE IF EXISTS "${r.tablename}" CASCADE`);
    console.log(`   [drop] table public.${r.tablename}`);
  }

  const { rows: sequences } = await query(
    `SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename`
  );
  for (const r of sequences) {
    await query(`DROP SEQUENCE IF EXISTS "${r.sequencename}" CASCADE`);
    console.log(`   [drop] sequence public.${r.sequencename}`);
  }

  const { rows: views } = await query(
    `SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname`
  );
  const { rows: matviews } = await query(
    `SELECT matviewname FROM pg_matviews WHERE schemaname = 'public' ORDER BY matviewname`
  );
  for (const r of views) {
    await query(`DROP VIEW IF EXISTS "${r.viewname}" CASCADE`);
    console.log(`   [drop] view public.${r.viewname}`);
  }
  for (const r of matviews) {
    await query(`DROP MATERIALIZED VIEW IF EXISTS "${r.matviewname}" CASCADE`);
    console.log(`   [drop] materialized view public.${r.matviewname}`);
  }
}

async function createSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(sql);
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_tests_name_round ON tests(name, COALESCE(round, 0))`
  );
}

async function main() {
  console.log('=== ELITE database reset ===');
  console.log('[1/3] connecting to Supabase…');
  const { rows: dbInfo } = await query(
    `SELECT current_database() AS db, current_user AS usr, inet_server_addr() AS host`
  );
  console.log(`       connected: db=${dbInfo[0].db} user=${dbInfo[0].usr} host=${dbInfo[0].host}`);

  console.log('[2/3] wiping public schema…');
  await wipePublic();

  console.log('[3/3] creating ELITE schema…');
  await createSchema();

  const { rows: remaining } = await query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  console.log('---');
  console.log(`TABLES: ${remaining.map((r) => r.table_name).join(', ')}`);
  console.log('=== reset complete ===');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('RESET ERROR:', e);
  try {
    await pool.end();
  } catch (_) {}
  process.exit(1);
});