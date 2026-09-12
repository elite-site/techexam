// Converts free-text questions (jumbled-word puzzles and "match the following")
// into standard selectable MCQ option fields so students pick an answer exactly
// like an MCQ question. Lives alongside the parser only — source files keep the
// original text, the DB keeps rendered options + the correct letter.

const JUMBLE_BANK = [
  'PYTHON',
  'COMPUTER',
  'KEYBOARD',
  'OBJECT ORIENTED',
  'COMPILATION',
  'MOUSE',
  'MONITOR',
  'PROGRAMMING',
  'DATABASE',
  'NETWORK',
  'ALGORITHM',
  'FUNCTION',
];
const LETTERS = ['A', 'B', 'C', 'D'];

function isMatchQuestion(question) {
  return /match\s+the\s+following/i.test(String(question.question_text || ''));
}

function shiftLetters(s) {
  return String(s || '').replace(/[A-D]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + 1) % 4) + 65));
}

function buildOptions(question) {
  const corr = String(question.correct_answer || '').trim();
  let variants;
  if (isMatchQuestion(question)) {
    const v1 = shiftLetters(corr);
    const v2 = shiftLetters(v1);
    const v3 = shiftLetters(v2);
    variants = [v1, v2, v3].filter((v, i, a) => v !== corr && a.indexOf(v) === i);
  } else {
    const bank = JUMBLE_BANK.filter((w) => w.toLowerCase() !== corr.toLowerCase());
    variants = bank.slice(0, 3);
  }
  while (variants.length < 3) variants.push('—');
  const order = [corr, variants[0], variants[1], variants[2]];
  const pos = Math.abs(Number(question.id) || 0) % 4;
  const tmp = order[0];
  order[0] = order[pos];
  order[pos] = tmp;
  return {
    option_a: order[0],
    option_b: order[1],
    option_c: order[2],
    option_d: order[3],
    correct_answer: LETTERS[pos],
  };
}

function toSelectable(question) {
  const o = buildOptions(question);
  return {
    option_a: o.option_a,
    option_b: o.option_b,
    option_c: o.option_c,
    option_d: o.option_d,
    correct_answer: o.correct_answer,
  };
}

module.exports = { toSelectable, isMatchQuestion };