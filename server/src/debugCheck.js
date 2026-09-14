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
    forbidden: ['num=num+i'],
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

// Sample stdin + expected-output fragments used by the interactive Run button.
// The submitted C program is compiled and executed with `input` on stdin; when
// its output contains every `contains` fragment the run counts as Correct,
// otherwise the run is reported as an error (the exact line is never shown).
const RUN_META = [
  { key: 'after swap', input: '5\n10\n', contains: ['After swap: 10 5'] },
  { key: 'palindrome', input: '123\n', contains: ['Not Palindrome'] },
  { key: 'average', input: '3\n1\n2\n3\n', contains: ['Sum = 6', 'Average = 2.000000'] },
  { key: 'num=num+i', input: '4\n', contains: ['7 8 9 10'] },
  { key: 'findmaxindex', input: '4\n5\n3\n8\n2\n', contains: ['Index of max element: 2'] },
  { key: 'int a[2][2], b[2][2]', input: '1\n2\n3\n4\n5\n6\n7\n8\n', contains: ['6 8', '10 12'] },
];

function debugRunMeta(question) {
  const text = String(question.question_text || '').toLowerCase();
  const hit = RUN_META.find((m) => text.includes(m.key));
  return hit;
}

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

module.exports = { isDebugFixCorrect, rubric, debugRunMeta };