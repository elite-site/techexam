const express = require('express');
const { query } = require('../db');
const { requireAdmin } = require('../auth');
const exam = require('../exam');
const { importStudents } = require('../importStudents');
const config = require('../config');
const multer = require('multer');

const router = express.Router();
router.use(requireAdmin);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// ---------------------------------------------------------------------
// Dashboard statistics
// ---------------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    const [studs, dbg, dbgSub, r1, r2] = await Promise.all([
      query('SELECT COUNT(*)::int AS c FROM students'),
      query(`SELECT COUNT(*)::int AS c FROM attempts a JOIN tests t ON t.id = a.test_id WHERE t.type = 'debugging' AND a.status IN ('IN_PROGRESS','SUBMITTED','EXPIRED')`),
      query(`SELECT COUNT(*)::int AS c FROM attempts a JOIN tests t ON t.id = a.test_id WHERE t.type = 'debugging' AND a.status IN ('SUBMITTED','EXPIRED')`),
      query(`SELECT COUNT(*)::int AS c FROM attempts a JOIN tests t ON t.id = a.test_id WHERE t.round = 1 AND a.status IN ('SUBMITTED','EXPIRED')`),
      query(`SELECT COUNT(*)::int AS c FROM attempts a JOIN tests t ON t.id = a.test_id WHERE t.round = 2 AND a.status IN ('SUBMITTED','EXPIRED')`),
    ]);
    const { rows: tests } = await query(
      `SELECT t.*, (SELECT COUNT(*)::int FROM questions q WHERE q.test_id = t.id) AS question_count,
              (SELECT COUNT(*)::int FROM attempts a WHERE a.test_id = t.id AND a.status IN ('IN_PROGRESS','SUBMITTED','EXPIRED')) AS attempt_count,
              (SELECT COUNT(*)::int FROM attempts a WHERE a.test_id = t.id AND a.status IN ('SUBMITTED','EXPIRED')) AS submitted_count,
              (SELECT COUNT(*)::int FROM attempts a WHERE a.test_id = t.id AND a.status = 'IN_PROGRESS') AS in_progress_count
       FROM tests t ORDER BY t.id`
    );
    return res.json({
      total_students: studs.rows[0].c,
      debugging_attempts: dbg.rows[0].c,
      debugging_submitted: dbgSub.rows[0].c,
      quiz_round1_submitted: r1.rows[0].c,
      quiz_round2_submitted: r2.rows[0].c,
      tests,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// All tests (config + status)
router.get('/tests', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT t.*, (SELECT COUNT(*)::int FROM questions q WHERE q.test_id = t.id) AS question_count FROM tests t ORDER BY t.id`
    );
    return res.json({ tests: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ---------------------------------------------------------------------
// Test lifecycle (start / stop / restart)
// ---------------------------------------------------------------------
async function setTestStatus(req, res, status) {
  const testId = Number(req.params.id);
  const test = await exam.getTest(testId);
  if (!test) return res.status(404).json({ error: 'Test not found.' });
  if (status === 'ACTIVE') {
    await query(
      `UPDATE tests SET status = 'ACTIVE', started_at = now(), stopped_at = NULL WHERE id = $1`,
      [testId]
    );
  } else if (status === 'STOPPED') {
    await query(
      `UPDATE tests SET status = 'STOPPED', stopped_at = now() WHERE id = $1`,
      [testId]
    );
  }
  const fresh = await exam.getTest(testId);
  return res.json({ test: fresh });
}

router.post('/tests/:id/start', async (req, res) => {
  try { await setTestStatus(req, res, 'ACTIVE'); } catch (e) { res.status(500).json({ error: 'Server error.' }); }
});
router.post('/tests/:id/stop', async (req, res) => {
  try { await setTestStatus(req, res, 'STOPPED'); } catch (e) { res.status(500).json({ error: 'Server error.' }); }
});

// Restart resets every attempt + answer for the test (students may retake).
router.post('/tests/:id/restart', async (req, res) => {
  const testId = Number(req.params.id);
  const test = await exam.getTest(testId);
  if (!test) return res.status(404).json({ error: 'Test not found.' });
  await query(
    `UPDATE tests SET status = 'STOPPED', started_at = NULL, stopped_at = NULL WHERE id = $1`,
    [testId]
  );
  await query('DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE test_id = $1)', [testId]);
  await query('DELETE FROM attempts WHERE test_id = $1', [testId]);
  return res.json({ test: await exam.getTest(testId), message: 'Test restarted. All attempts for this test have been reset.' });
});

// ---------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------
router.get('/students', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const params = [];
    let where = '';
    if (search) {
      where = `WHERE lower(roll_number) LIKE $1 OR lower(student_name) LIKE $1`;
      params.push(`%${search.toLowerCase()}%`);
    }
    const { rows } = await query(
      `SELECT id, roll_number, student_name, year, section, created_at FROM students
       ${where} ORDER BY id LIMIT 1000`,
      params
    );
    const total = (await query('SELECT COUNT(*)::int AS c FROM students')).rows[0].c;
    return res.json({ students: rows, total });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/students/import', upload.single('file'), async (req, res) => {
  try {
    const XLSX = require('xlsx');
    let wb;
    if (req.file && req.file.buffer) {
      wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    } else if (config.excelPath && require('fs').existsSync(config.excelPath)) {
      wb = XLSX.readFile(config.excelPath);
    } else {
      return res.status(400).json({ error: 'No Excel file provided.' });
    }
    const { parseStudentsFromWorkbook } = require('../importStudents');
    const students = parseStudentsFromWorkbook(wb);
    if (!students.length) return res.status(400).json({ error: 'No valid student rows found in the workbook.' });

    const bcrypt = require('bcryptjs');
    const chunkSize = 50;
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      const hashed = chunk.map((s) => bcrypt.hashSync(s.roll_number, 8));
      const params = [];
      const values = [];
      chunk.forEach((s, idx) => {
        const base = idx * 5;
        params.push(s.roll_number, s.student_name, s.year, s.section, hashed[idx]);
        values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
      });
      await query(
        `INSERT INTO students (roll_number, student_name, year, section, password_hash)
         VALUES ${values.join(', ')}
         ON CONFLICT (roll_number) DO UPDATE SET student_name = EXCLUDED.student_name, year = EXCLUDED.year, section = EXCLUDED.section`,
        params
      );
    }
    const total = (await query('SELECT COUNT(*)::int AS c FROM students')).rows[0].c;
    return res.json({ imported: students.length, total_students: total });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to import students: ' + e.message });
  }
});

// ---------------------------------------------------------------------
// Question management
// ---------------------------------------------------------------------
const qCols = 'id, test_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, marks, question_order';

router.get('/tests/:id/questions', async (req, res) => {
  const testId = Number(req.params.id);
  const test = await exam.getTest(testId);
  if (!test) return res.status(404).json({ error: 'Test not found.' });
  const { rows } = await query(
    `SELECT ${qCols} FROM questions WHERE test_id = $1 ORDER BY question_order ASC, id ASC`,
    [testId]
  );
  return res.json({ test, questions: rows });
});

function normalizeQuestion(body) {
  return {
    question_text: String(body.question_text ?? '').trim(),
    question_type: String(body.question_type ?? 'mcq').trim() || 'mcq',
    option_a: body.option_a == null ? null : String(body.option_a).trim(),
    option_b: body.option_b == null ? null : String(body.option_b).trim(),
    option_c: body.option_c == null ? null : String(body.option_c).trim(),
    option_d: body.option_d == null ? null : String(body.option_d).trim(),
    correct_answer: body.correct_answer == null || body.correct_answer === '' ? null : String(body.correct_answer).trim(),
    marks: Number(body.marks ?? 1),
    question_order: Number(body.question_order) || null,
  };
}

router.post('/tests/:id/questions', async (req, res) => {
  const testId = Number(req.params.id);
  const test = await exam.getTest(testId);
  if (!test) return res.status(404).json({ error: 'Test not found.' });
  const q = normalizeQuestion(req.body);
  if (!q.question_text) return res.status(400).json({ error: 'Question text is required.' });
  const order = q.question_order || (await query('SELECT COUNT(*)::int AS c FROM questions WHERE test_id = $1', [testId])).rows[0].c + 1;
  const { rows } = await query(
    `INSERT INTO questions (test_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, marks, question_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${qCols}`,
    [testId, q.question_text, q.question_type, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.marks, order]
  );
  return res.status(201).json({ question: rows[0] });
});

router.put('/tests/:id/questions/:qid', async (req, res) => {
  const { id, qid } = req.params;
  const test = await exam.getTest(Number(id));
  if (!test) return res.status(404).json({ error: 'Test not found.' });
  const q = normalizeQuestion(req.body);
  if (!q.question_text) return res.status(400).json({ error: 'Question text is required.' });
  const order = q.question_order;
  const { rows } = await query(
    `UPDATE questions SET
       question_text = $1, question_type = $2, option_a = $3, option_b = $4,
       option_c = $5, option_d = $6, correct_answer = $7, marks = $8,
       question_order = COALESCE($9, question_order)
     WHERE id = $10 AND test_id = $11 RETURNING ${qCols}`,
    [q.question_text, q.question_type, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.marks, order, qid, id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Question not found.' });
  return res.json({ question: rows[0] });
});

router.delete('/tests/:id/questions/:qid', async (req, res) => {
  const { id, qid } = req.params;
  const { rows } = await query('DELETE FROM questions WHERE id = $1 AND test_id = $2 RETURNING id', [qid, id]);
  if (!rows.length) return res.status(404).json({ error: 'Question not found.' });
  return res.json({ deleted: true });
});

// ---------------------------------------------------------------------
// Attempts + Leaderboards
// ---------------------------------------------------------------------
router.get('/attempts', async (req, res) => {
  const testId = req.query.testId ? Number(req.query.testId) : null;
  let q = `SELECT a.id, a.status, a.score, a.correct_count, a.total_count, a.started_at, a.submitted_at,
                  s.roll_number, s.student_name, t.name AS test_name, t.round
           FROM attempts a
           JOIN students s ON s.id = a.student_id
           JOIN tests t ON t.id = a.test_id`;
  const params = [];
  if (testId) { q += ' WHERE a.test_id = $1'; params.push(testId); }
  q += ' ORDER BY a.submitted_at DESC NULLS LAST, a.id DESC LIMIT 1000';
  const { rows } = await query(q, params);
  return res.json({ attempts: rows });
});

router.get('/leaderboard/:testId', async (req, res) => {
  const testId = Number(req.params.testId);
  const test = await exam.getTest(testId);
  if (!test) return res.status(404).json({ error: 'Test not found.' });
  const { rows } = await query(
    `SELECT s.id AS student_id, s.student_name, s.roll_number, s.year, s.section, s.round2_winner,
            a.score, a.correct_count, a.total_count, a.submitted_at, a.status
     FROM attempts a
     JOIN students s ON s.id = a.student_id
     WHERE a.test_id = $1 AND a.status IN ('SUBMITTED','EXPIRED')
     ORDER BY a.score DESC, a.submitted_at ASC NULLS LAST`,
    [testId]
  );
  return res.json({ test, leaderboard: rows });
});

// Admin promotes/removes a student as a Round 2 participant (only meaningful
// after Round 1 of the Technical Quiz). Backend flag gates Round 2 access.
router.post('/round2/winners/:studentId', async (req, res) => {
  try {
    const sid = Number(req.params.studentId);
    const winner = !!(req.body && req.body.winner === true);
    if (!sid) return res.status(400).json({ error: 'Invalid student id.' });
    const { rowCount } = await query('UPDATE students SET round2_winner = $1 WHERE id = $2', [winner, sid]);
    if (!rowCount) return res.status(404).json({ error: 'Student not found.' });
    return res.json({ ok: true, winner });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;