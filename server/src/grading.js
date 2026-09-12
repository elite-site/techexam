const { isDebugFixCorrect } = require('./debugCheck');

function normalizeAnswer(s) {
  if (s == null) return '';
  return String(s).trim().replace(/\s+/g, ' ').toLowerCase();
}

function tryScore(question, studentAnswer) {
  const correct = question.correct_answer;
  if (correct == null || String(correct).trim() === '') return 0;
  if (question.question_type === 'mcq') {
    return normalizeAnswer(studentAnswer) === normalizeAnswer(String(correct).toLowerCase())
      ? Number(question.marks) || 0
      : 0;
  }
  if (question.question_type === 'code') {
    return isDebugFixCorrect(question, studentAnswer) ? Number(question.marks) || 0 : 0;
  }
  return normalizeAnswer(studentAnswer) === normalizeAnswer(correct) ? Number(question.marks) || 0 : 0;
}

function gradeAttempt(questions, answerMap) {
  let score = 0;
  let correct = 0;
  for (const q of questions) {
    const ans = answerMap.get(q.id);
    if (ans == null || ans === '') continue;
    const m = tryScore(q, ans);
    score += m;
    if (m > 0) correct += 1;
  }
  return { score: Number(score.toFixed(2)), correct, total: questions.length };
}

module.exports = { gradeAttempt, tryScore, normalizeAnswer };