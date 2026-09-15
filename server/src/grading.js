const { scoreDebugFix } = require('./debugCheck');

function normalizeAnswer(s) {
  if (s == null) return '';
  return String(s).trim().replace(/\s+/g, ' ').toLowerCase();
}

function tryScore(question, studentAnswer) {
  const correct = question.correct_answer;
  const marks = Number(question.marks) || 0;
  if (correct == null || String(correct).trim() === '') return 0;
  if (question.question_type === 'mcq') {
    return normalizeAnswer(studentAnswer) === normalizeAnswer(String(correct).toLowerCase()) ? marks : 0;
  }
  if (question.question_type === 'code') {
    // Partial credit: fixing n of N issues earns n/N of the marks.
    return Math.round(marks * scoreDebugFix(question, studentAnswer) * 100) / 100;
  }
  return normalizeAnswer(studentAnswer) === normalizeAnswer(correct) ? marks : 0;
}

function gradeAttempt(questions, answerMap) {
  let score = 0;
  let correct = 0;
  const awarded = new Map(); // question_id -> marks awarded
  for (const q of questions) {
    const ans = answerMap.get(q.id);
    if (ans == null || String(ans).trim() === '') continue;
    const m = tryScore(q, ans);
    awarded.set(q.id, m);
    score += m;
    const full = Number(q.marks) || 0;
    if (full > 0 && m >= full) correct += 1;
  }
  return { score: Number(score.toFixed(2)), correct, total: questions.length, awarded };
}

module.exports = { gradeAttempt, tryScore, normalizeAnswer };