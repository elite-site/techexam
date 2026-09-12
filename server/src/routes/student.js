const express = require('express');
const { query } = require('../db');
const { requireStudent } = require('../auth');
const exam = require('../exam');
const { isDebugFixCorrect } = require('../debugCheck');

const router = express.Router();
router.use(requireStudent);

function round2Blocked(res) {
  return res.status(403).json({ error: 'This test is not available to you.' });
}

function attemptState(attempt, test) {
  const base = attempt
    ? {
        id: attempt.id,
        status: attempt.status,
        started_at: attempt.started_at,
        submitted_at: attempt.submitted_at,
        score: attempt.score,
      }
    : null;
  if (base && attempt.status === 'IN_PROGRESS') {
    base.remaining_seconds = exam.remainingSeconds(attempt, test);
    base.duration_seconds = Number(test.duration_seconds);
  }
  return base;
}

// Available tests for this student
router.get('/tests', async (req, res) => {
  try {
    const { rows: tests } = await query(
      `SELECT t.*, (SELECT COUNT(*)::int FROM questions q WHERE q.test_id = t.id) AS question_count
       FROM tests t ORDER BY t.id`
    );
    const { rows: attempts } = await query(
      `SELECT * FROM attempts WHERE student_id = $1`,
      [req.student.id]
    );
    const byTest = new Map(attempts.map((a) => [String(a.test_id), a]));
    const out = [];
    for (const t of tests) {
      if (exam.isRound2(t)) continue;
      const att = byTest.get(String(t.id));
      out.push({
        id: t.id,
        name: t.name,
        type: t.type,
        round: t.round,
        duration_seconds: Number(t.duration_seconds),
        status: t.status,
        started_at: t.started_at,
        question_count: t.question_count,
        attempt: attemptState(att, t),
      });
    }
    return res.json({ tests: out });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// Start a test attempt (only permitted when admin started the test)
router.post('/tests/:id/start', async (req, res) => {
  const testId = Number(req.params.id);
  if (!testId) return res.status(400).json({ error: 'Invalid test id.' });
  const test = await exam.getTest(testId);
  if (!test) return res.status(404).json({ error: 'Test not found.' });
  if (exam.isRound2(test) && !req.student.round2_winner) return round2Blocked(res);
  if (test.status !== 'ACTIVE') {
    return res.status(403).json({ error: 'This test is not active. Please wait for the administrator to start it.' });
  }
  const pool = require('../db').pool;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT * FROM attempts WHERE student_id = $1 AND test_id = $2',
      [req.student.id, testId]
    );
    if (rows.length) {
      const att = rows[0];
      await client.query('COMMIT');
      if (att.status === 'SUBMITTED' || att.status === 'EXPIRED') {
        return res.json({ already_completed: true, attempt: attemptState(att, test), test: { id: test.id, name: test.name, type: test.type, round: test.round, duration_seconds: Number(test.duration_seconds), status: test.status } });
      }
      const questions = await exam.getQuestions(testId, false, client.query.bind(client));
      const answers = await exam.getAnswerMap(att.id, client.query.bind(client));
      const answersObj = {};
      answers.forEach((v, k) => { answersObj[k] = v; });
      return res.json({ success: true, already_started: true, test: { id: test.id, name: test.name, type: test.type, round: test.round, duration_seconds: Number(test.duration_seconds), status: test.status }, attempt: attemptState(att, test), questions, answers: answersObj, server_time: Date.now() });
    }
    const attempt = await exam.createOrGetAttempt(client, req.student.id, testId);
    await client.query('COMMIT');
    const questions = await exam.getQuestions(testId, false, client.query.bind(client));
    return res.json({ success: true, test: { id: test.id, name: test.name, type: test.type, round: test.round, duration_seconds: Number(test.duration_seconds), status: test.status }, attempt: attemptState(attempt, test), questions, answers: {}, server_time: Date.now() });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e);
    return res.status(500).json({ error: 'Server error.' });
  } finally {
    client.release();
  }
});

// Current attempt state (resume after refresh, auto-submit on expiry)
router.get('/tests/:id/attempt', async (req, res) => {
  const testId = Number(req.params.id);
  const test = await exam.getTest(testId);
  if (!test) return res.status(404).json({ error: 'Test not found.' });
  if (exam.isRound2(test) && !req.student.round2_winner) return round2Blocked(res);
  const { rows } = await query(
    'SELECT * FROM attempts WHERE student_id = $1 AND test_id = $2',
    [req.student.id, testId]
  );
  if (!rows.length) return res.json({ no_attempt: true, test: { id: test.id, name: test.name, type: test.type, round: test.round, duration_seconds: Number(test.duration_seconds), status: test.status } });
  const att = rows[0];
  const expired = att.status === 'IN_PROGRESS' && exam.remainingSeconds(att, test) <= 0;
  if (expired) await exam.autoExpireIfNeeded(att, test);
  const fresh = (await query('SELECT * FROM attempts WHERE id = $1', [att.id])).rows[0];
  const questions = await exam.getQuestions(testId, false);
  const answers = await exam.getAnswerMap(att.id);
  const answersObj = {};
  answers.forEach((v, k) => { answersObj[k] = v; });
  return res.json({
    test: { id: test.id, name: test.name, type: test.type, round: test.round, duration_seconds: Number(test.duration_seconds), status: test.status },
    attempt: attemptState(fresh, test),
    questions,
    answers: answersObj,
    server_time: Date.now(),
  });
});

// Auto-save answers while the test is in progress (durability on refresh)
router.put('/tests/:id/answers', async (req, res) => {
  try {
    const testId = Number(req.params.id);
    const body = req.body && Array.isArray(req.body.answers) ? req.body.answers : [];
    const test = await exam.getTest(testId);
    if (!test) return res.status(404).json({ error: 'Test not found.' });
    if (exam.isRound2(test) && !req.student.round2_winner) return round2Blocked(res);
    if (test.status !== 'ACTIVE') return res.status(403).json({ error: 'Test is not active.' });
    const { rows } = await query(
      'SELECT * FROM attempts WHERE student_id = $1 AND test_id = $2',
      [req.student.id, testId]
    );
    if (!rows.length) return res.status(404).json({ error: 'No attempt found. Start the test first.' });
    const att = rows[0];
    if (att.status !== 'IN_PROGRESS') return res.status(403).json({ error: 'This attempt has already been submitted.' });
    if (body.length) {
      const valid = await exam.getQuestions(testId, false);
      const validIds = new Set(valid.map((q) => q.id));
      const params = [];
      const values = [];
      for (let i = 0; i < body.length; i++) {
        const a = body[i];
        const qid = Number(a.question_id);
        if (!qid || !validIds.has(qid)) continue;
        const answer = String(a.answer ?? '').trim();
        const base = i * 3;
        params.push(att.id, qid, answer);
        values.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
      }
      if (values.length) {
        await query(
          `INSERT INTO answers (attempt_id, question_id, student_answer)
           VALUES ${values.join(', ')}
           ON CONFLICT (attempt_id, question_id)
           DO UPDATE SET student_answer = EXCLUDED.student_answer, updated_at = now()`,
          params
        );
      }
    }
    return res.json({ saved: true });
  } catch (e) {
    console.error('[save answers]', e.message);
    return res.status(500).json({ error: 'Failed to save answers.' });
  }
});

// Submit the test (idempotent; duplicate submissions rejected)
router.post('/tests/:id/submit', async (req, res) => {
  const testId = Number(req.params.id);
  const test = await exam.getTest(testId);
  if (!test) return res.status(404).json({ error: 'Test not found.' });
  if (exam.isRound2(test) && !req.student.round2_winner) return round2Blocked(res);
  const pool = require('../db').pool;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT * FROM attempts WHERE student_id = $1 AND test_id = $2 FOR UPDATE',
      [req.student.id, testId]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No attempt found. Start the test first.' });
    }
    const att = rows[0];
    if (att.status !== 'IN_PROGRESS') {
      await client.query('ROLLBACK');
      return res.json({ already_submitted: true, attempt: attemptState(att, test) });
    }
    // persist any provided answers
    const body = req.body && Array.isArray(req.body.answers) ? req.body.answers : [];
    if (body.length) {
      const valid = await exam.getQuestions(testId, false, client.query.bind(client));
      const validIds = new Set(valid.map((q) => q.id));
      const params = [];
      const values = [];
      body.forEach((a, i) => {
        const qid = Number(a.question_id);
        if (!qid || !validIds.has(qid)) return;
        const answer = String(a.answer ?? '').trim();
        const base = i * 3;
        params.push(att.id, qid, answer);
        values.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
      });
      if (values.length) {
        await client.query(
          `INSERT INTO answers (attempt_id, question_id, student_answer)
           VALUES ${values.join(', ')}
           ON CONFLICT (attempt_id, question_id)
           DO UPDATE SET student_answer = EXCLUDED.student_answer, updated_at = now()`,
          params
        );
      }
    }
    const answerMap = await exam.getAnswerMap(att.id, client.query.bind(client));
    const result = await exam.finalizeAttempt(client, att, answerMap);
    const upd = (await client.query('SELECT * FROM attempts WHERE id = $1', [att.id])).rows[0];
    await client.query('COMMIT');
    return res.json({ submitted: true, attempt: attemptState(upd, test), score: result.score, correct: result.correct, total: result.total });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    return res.status(500).json({ error: 'Server error during submission.' });
  } finally {
    client.release();
  }
});

// Result for a completed attempt (score only, no answer key)
router.get('/tests/:id/result', async (req, res) => {
  const testId = Number(req.params.id);
  const test = await exam.getTest(testId);
  if (!test) return res.status(404).json({ error: 'Test not found.' });
  if (exam.isRound2(test) && !req.student.round2_winner) return round2Blocked(res);
  const { rows } = await query(
    'SELECT * FROM attempts WHERE student_id = $1 AND test_id = $2',
    [req.student.id, testId]
  );
  if (!rows.length) return res.status(404).json({ error: 'No attempt found.' });
  const att = rows[0];
  if (att.status === 'IN_PROGRESS') {
    return res.json({ status: 'IN_PROGRESS', message: 'This attempt is still in progress.' });
  }
  return res.json({
    result: {
      test_id: testId,
      test_name: test.name,
      test_type: test.type,
      round: test.round,
      status: att.status,
      submitted_at: att.submitted_at,
      started_at: att.started_at,
      score: Number(att.score),
      correct_count: Number(att.correct_count),
      total_count: Number(att.total_count),
    },
  });
});

// Interactive execution check for a debugging question. Responds with
// only Correct / Error — never with hints, the failing line, or details.
router.post('/tests/:id/run', async (req, res) => {
  try {
    const testId = Number(req.params.id);
    const test = await exam.getTest(testId);
    if (!test) return res.status(404).json({ error: 'Test not found.' });
    if (exam.isRound2(test) && !req.student.round2_winner) return round2Blocked(res);
    const qid = Number(req.body && req.body.question_id);
    const code = String((req.body && req.body.code) || '');
    const questions = await exam.getQuestions(testId, true);
    const q = questions.find((x) => x.id === qid);
    if (!q) return res.status(400).json({ error: 'Invalid question.' });
    if (q.question_type !== 'code') return res.status(400).json({ error: 'This question is not a debugging question.' });
    const { rows } = await query(
      'SELECT * FROM attempts WHERE student_id = $1 AND test_id = $2',
      [req.student.id, testId]
    );
    const att = rows[0];
    if (!att || att.status !== 'IN_PROGRESS') {
      return res.status(403).json({ error: 'Start the test before running code.' });
    }
    const ok = isDebugFixCorrect(q, code);
    return res.json({ result: ok ? 'Correct' : 'Error' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;