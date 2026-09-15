const { query } = require('./db');

const STATUS = { ACTIVE: 'ACTIVE', STOPPED: 'STOPPED', IN_PROGRESS: 'IN_PROGRESS', SUBMITTED: 'SUBMITTED', EXPIRED: 'EXPIRED' };

function remainingSeconds(attempt, test) {
  const end = new Date(attempt.started_at).getTime() + Number(test.duration_seconds) * 1000;
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}

// Round 2 of any exam (Technical Quiz or Code Debugging) is locked behind
// admin-confirmed winners (students.round2_winner).
function isRound2(test) {
  return !!(test && Number(test.round) === 2);
}

async function getTest(id, exec) {
  const q = exec || query;
  const { rows } = await q('SELECT * FROM tests WHERE id = $1', [id]);
  return rows[0] || null;
}

// Returns the live effort map for an attempt (question_id -> student_answer)
async function getAnswerMap(attemptId, exec) {
  const q = exec || query;
  const { rows } = await q(
    'SELECT question_id, student_answer FROM answers WHERE attempt_id = $1',
    [attemptId]
  );
  return new Map(rows.map((r) => [Number(r.question_id), r.student_answer ?? '']));
}

// Deterministic per-student shuffle: a stable seed yields the same
// permutation on every call so a refresh/resume keeps the same order,
// while each student sees a unique arrangement of questions.
function seededShuffle(arr, seedStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function getQuestions(testId, includeCorrect = false, exec, opts = {}) {
  const q = exec || query;
  const cols = includeCorrect
    ? '*'
    : 'id, question_text, question_type, option_a, option_b, option_c, option_d, marks, question_order';
  const { rows } = await q(
    `SELECT ${cols} FROM questions WHERE test_id = $1 ORDER BY question_order ASC, id ASC`,
    [testId]
  );
  const out = rows.map((r) => ({ ...r, id: Number(r.id) }));
  // opts.seed (e.g. `${studentId}:${testId}`) jumbles the order per student.
  return opts.seed ? seededShuffle(out, opts.seed) : out;
}

// Finalize an attempt that has run out of time (or was force-submitted).
// Returns { attempt, answers, score } — no-op if already finalized.
async function finalizeAttempt(client, attempt, answerMap) {
  const { gradeAttempt } = require('./grading');
  const questions = await getQuestions(attempt.test_id, true, client.query.bind(client));
  const graded = gradeAttempt(questions, answerMap);
  // Persist per-question marks so every answer records what it earned.
  for (const [qid, marksAwarded] of graded.awarded) {
    await client.query(
      'UPDATE answers SET marks_awarded = $1 WHERE attempt_id = $2 AND question_id = $3',
      [marksAwarded, attempt.id, qid]
    );
  }
  await client.query(
    `UPDATE attempts
     SET status = $2, submitted_at = now(), score = $3, correct_count = $4, total_count = $5
     WHERE id = $1`,
    [attempt.id, STATUS.SUBMITTED, graded.score, graded.correct, graded.total]
  );
  return { score: graded.score, correct: graded.correct, total: graded.total, awarded: graded.awarded };
}

// If an in-progress attempt has hit zero time, finalize it (idempotent).
async function autoExpireIfNeeded(attempt, test) {
  if (attempt.status === STATUS.IN_PROGRESS && remainingSeconds(attempt, test) <= 0) {
    const client = await (await require('./db')).pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT * FROM attempts WHERE id = $1 AND student_id = $2 FOR UPDATE',
        [attempt.id, attempt.student_id]
      );
      if (rows.length && rows[0].status === STATUS.IN_PROGRESS) {
        const answerMap = await getAnswerMap(attempt.id, client.query.bind(client));
        await finalizeAttempt(client, rows[0], answerMap);
      }
      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  return false;
}

async function createOrGetAttempt(trx, studentId, testId) {
  const { rows } = await trx.query(
    `INSERT INTO attempts (student_id, test_id, started_at, status)
     VALUES ($1, $2, now(), 'IN_PROGRESS')
     ON CONFLICT (student_id, test_id)
     DO UPDATE SET status = attempts.status
     RETURNING *`,
    [studentId, testId]
  );
  return rows[0];
}

module.exports = { STATUS, remainingSeconds, isRound2, getTest, getAnswerMap, getQuestions, finalizeAttempt, autoExpireIfNeeded, createOrGetAttempt, seededShuffle };