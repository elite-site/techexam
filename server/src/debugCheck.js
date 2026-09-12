// Rubric used by both the interactive Run button and submit-time grading for
// code-debugging questions.  A student's full corrected program is correct when
// every required fix-fragment is present and every forbidden (buggy) fragment is
// gone.  Required fragments are taken from the question's `correct_answer` (the
// expected corrected lines) when they look like code, and from per-question
// overrides where the source data is missing or garbled.
// This only ever answers Correct / Error — it never exposes the failing line.

function normLine(s) {
  return String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();
}

function isCodeish(line) {
  return /[=;()]/.test(line);
}

// keyed by a stable substring of question_text (survives re-seeding)
const CURATED = [
  {
    key: 'num=num+i',
    mode: 'override',
    required: ['scanf("%d",&n);'],
  },
  {
    key: 'findmaxindex',
    mode: 'override',
    required: ['if(arr[i]>max)', 'intindex=0;', 'returnindex;', 'for(inti=0;i<n;i++)'],
    forbidden: ['if(arr[i]>max);'],
  },
  {
    key: 'sum = 0;',
    mode: 'override',
    required: ['avg=(float)sum/n;'],
    forbidden: ['for(inti=0;i<=n;i++)'],
  },
  {
    key: 'int a[2][2], b[2][2]',
    mode: 'override',
    required: ['sum[i][j]=a[i][j]+b[i][j];'],
    forbidden: ['for(inti=0;i<=2;i++)', 'for(intj=0;j<=2;j++)', 'b[j][i]'],
  },
];

function rubric(question) {
  const text = String(question.question_text || '').toLowerCase();
  const curated = CURATED.filter((c) => text.includes(c.key));
  const override = curated.find((c) => c.mode === 'override');
  if (override) {
    return {
      required: (override.required || []).map(normLine),
      forbidden: (override.forbidden || []).map(normLine),
    };
  }
  const required = String(question.correct_answer || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter(isCodeish)
    .map(normLine);
  const forbidden = curated.flatMap((c) => (c.forbidden || []).map(normLine));
  return { required: [...new Set(required)], forbidden: [...new Set(forbidden)] };
}

function isDebugFixCorrect(question, studentCode) {
  const { required, forbidden } = rubric(question);
  if (!required.length && !forbidden.length) return false;
  const norm = normLine(studentCode);
  if (required.some((f) => !norm.includes(f))) return false;
  if (forbidden.some((f) => norm.includes(f))) return false;
  return true;
}

module.exports = { isDebugFixCorrect, rubric };