#!/usr/bin/env node
// ---------------------------------------------------------------------
// Idempotent database seed:
//   1. create schema      2. seed tests + admin
//   3. import students    4. import questions from provided text files
// ---------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('./config');
const { query } = require('./db');
const { importStudents } = require('./importStudents');
const { parseQuizFile, parseDebug, extractOdtText, parseNewRound1, parseNewRound2, parseNewDebug, parseCodebuggingFile } = require('./importQuestions');
const { toSelectable } = require('./questionOptions');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '8', 10);
const FORCE = process.argv.includes('--force');

async function ensureSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(sql);
  // unique index so test upserts stay idempotent
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_tests_name_round ON tests(name, COALESCE(round, 0))`);
}

async function seedTests() {
  const defs = [
    { name: 'Code Debugging', type: 'debugging', round: 1, duration: 1800 },
    { name: 'Technical Quiz', type: 'quiz', round: 1, duration: 1800 },
    { name: 'Technical Quiz', type: 'quiz', round: 2, duration: 1800 },
    { name: 'Code Debugging', type: 'debugging', round: 2, duration: 1800 },
  ];
  const ids = {};
  for (const d of defs) {
    const { rows } = await query(
      `INSERT INTO tests (name, type, round, duration_seconds)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name, COALESCE(round, 0))
       DO UPDATE SET duration_seconds = EXCLUDED.duration_seconds
       RETURNING id`,
      [d.name, d.type, d.round, d.duration]
    );
    ids[d.type + '|' + String(d.round)] = rows[0].id;
  }
  return ids;
}

async function seedAdmin() {
  const hash = bcrypt.hashSync(config.adminPassword, BCRYPT_ROUNDS);
  await query(
    `INSERT INTO admins (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [config.adminUsername, hash]
  );
}

const ANSWER_OVERRIDES = [
  ['half-bitten fruit logo', 'B'],
  ['golden arches', 'C'],
  ['green mermaid', 'B'],
  ['multi-window logo', 'B'],
  ['check mark/tick-like', 'C'],
  ['four-ringed logo', 'B'],
  ['three-pointed star', 'A'],
  ['lion figure', 'B'],
  ['owl or open-book', 'A'],
  ['swoosh-like', 'A'],
  ['ctrl + shift + v', 'B'],
  ['what number should replace', 'C'],
  ['odd one out', 'C'],
  ['man is found dead', 'D'],
];

function applyOverrides(questions) {
  for (const q of questions) {
    if (q.question_type !== 'mcq') continue;
    const key = q.question_text.toLowerCase();
    for (const [needle, ans] of ANSWER_OVERRIDES) {
      if (key.includes(needle)) { q.correct_answer = ans; break; }
    }
  }
}

// Free-text jumble / matching questions become selectable MCQ options.
async function convertSelectableText(testId) {
  const { rows } = await query(
    `SELECT id, question_text, correct_answer FROM questions
     WHERE test_id = $1 AND question_type IN ('text', 'matching')
     ORDER BY id`,
    [testId]
  );
  for (const q of rows) {
    const o = toSelectable(q);
    await query(
      `UPDATE questions
       SET question_type = 'mcq', option_a = $1, option_b = $2, option_c = $3, option_d = $4, correct_answer = $5
       WHERE id = $6`,
      [o.option_a, o.option_b, o.option_c, o.option_d, o.correct_answer, q.id]
    );
    console.log(`   [selectable] q${q.id} -> mcq (correct ${o.correct_answer})`);
  }
}

async function seedQuestions(testId, questions, defaultMarks) {
  const { rows } = await query('SELECT COUNT(*)::int AS c FROM questions WHERE test_id = $1', [testId]);
  if (rows[0].c > 0 && !FORCE) {
    console.log(`   [skip] test ${testId} already has ${rows[0].c} questions (use --force to re-seed)`);
    return rows[0].c;
  }
  if (FORCE && rows[0].c > 0) {
    await query('DELETE FROM questions WHERE test_id = $1', [testId]);
  }
  if (!questions.length) return 0;
  const params = [];
  const values = [];
  questions.forEach((q, idx) => {
    const base = idx * 9;
    params.push(
      testId,
      q.question_text,
      q.question_type || 'mcq',
      q.option_a || null,
      q.option_b || null,
      q.option_c || null,
      q.option_d || null,
      q.correct_answer ?? null,
      q.marks ?? defaultMarks
    );
    values.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, ${idx + 1})`
    );
  });
  await query(
    `INSERT INTO questions (test_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, marks, question_order)
     VALUES ${values.join(', ')}`,
    params
  );
  return questions.length;
}

function fileExists(p) {
  try { fs.accessSync(p); return true; } catch (e) { return false; }
}

// Prefer the uploaded NEW-*.odt question sets when present.
function sourcePack() {
  const r1 = config.resolveRel('../NEW-ROUND-1.odt');
  const r2 = config.resolveRel('../NEW-ROUND-2.odt');
  const dbg = config.resolveRel('../NEW-DEBUGGING.odt');
  const cb = config.resolveRel('../CODEBUGGING.txt');
  // Debugging Round 1 questions come from CODEBUGGING.txt when present.
  const debug = fileExists(cb)
    ? parseCodebuggingFile(fs.readFileSync(cb, 'utf8'))
    : fileExists(dbg) ? parseNewDebug(extractOdtText(dbg)) : [];
  // Debugging Round 2 questions come from NEW-DEBUGGING.odt when present.
  const debugR2 = fileExists(dbg) ? parseNewDebug(extractOdtText(dbg)) : [];
  if (fileExists(r1) && fileExists(r2)) {
    return {
      kind: fileExists(cb) ? 'odt+codebugging' : 'odt',
      round1: parseNewRound1(extractOdtText(r1)),
      round2: parseNewRound2(extractOdtText(r2)),
      debug,
      debugR2,
    };
  }
  return {
    kind: 'txt',
    round1: parseQuizFile(fs.readFileSync(config.quizRound1Path, 'utf8')).round1,
    round2: parseQuizFile(fs.readFileSync(config.quizRound1Path, 'utf8')).round2,
    debug: fileExists(cb) ? debug : parseDebug(fs.readFileSync(config.debugPath, 'utf8')),
    debugR2,
  };
}

async function main() {
  console.log('=== ELITE seed ===');
  await ensureSchema();
  console.log('[1/5] schema ready');

  // Renumber the legacy debugging test (round NULL) to Round 1 so Code
  // Debugging follows the same R1 -> R2 winner flow as the Technical Quiz.
  await query(`UPDATE tests SET round = 1 WHERE type = 'debugging' AND round IS NULL`);

  const ids = await seedTests();
  await seedAdmin();
  console.log('[2/5] tests + admin ready');

  const existing = await query('SELECT COUNT(*)::int AS c FROM students');
  if (existing.rows[0].c > 0 && !FORCE) {
    console.log(`[3/5] students already present (${existing.rows[0].c}), skipping import`);
  } else {
    const imp = await importStudents(config.excelPath);
    console.log(`[3/5] students imported -> processed ${imp.processed}, total in DB ${imp.total}`);
  }

  const src = sourcePack();
  if (src.kind.startsWith('odt')) console.log('[4/5] question source: NEW .odt files' + (src.kind.includes('codebugging') ? ' + CODEBUGGING.txt' : ''));
  else console.log('[4/5] question source: original .txt files');
  applyOverrides(src.round1);
  applyOverrides(src.round2);
  const nR1 = await seedQuestions(ids['quiz|1'], src.round1, 1);
  const nR2 = await seedQuestions(ids['quiz|2'], src.round2, 1);
  await convertSelectableText(ids['quiz|1']);
  await convertSelectableText(ids['quiz|2']);
  console.log(`[4/5] round1 questions=${src.round1.length} (seeded ${nR1}), round2 questions=${src.round2.length} (seeded ${nR2})`);

  const debugR1 = src.debug;
  const nDbg1 = await seedQuestions(ids['debugging|1'], debugR1, 5);
  await convertSelectableText(ids['debugging|1']);
  const debugR2 = src.debugR2;
  const nDbg2 = await seedQuestions(ids['debugging|2'], debugR2, 5);
  await convertSelectableText(ids['debugging|2']);
  console.log(`[5/5] debugging R1 questions=${debugR1.length} (seeded ${nDbg1}), R2 questions=${debugR2.length} (seeded ${nDbg2})`);

  const sums = await query(
    `SELECT t.id, t.name, t.round, t.status, COUNT(q.id)::int AS q
     FROM tests t LEFT JOIN questions q ON q.test_id = t.id
     GROUP BY t.id ORDER BY t.id`
  );
  const studs = await query('SELECT COUNT(*)::int AS c FROM students');
  console.log('---');
  for (const r of sums.rows) {
    console.log(`TEST id=${r.id} ${r.round ? `${r.name} R${r.round}` : r.name} | ${r.status} | questions: ${r.q}`);
  }
  console.log(`STUDENTS: ${studs.rows[0].c}`);
  console.log('=== seed complete ===');
  process.exit(0);
}

main().catch((e) => { console.error('SEED ERROR:', e); process.exit(1); });