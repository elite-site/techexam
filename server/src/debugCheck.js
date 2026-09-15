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

// whitespace-stripped but case-PRESERVED (for case-sensitive fixes like a[I] -> a[i])
function stripWS(s) {
  return String(s == null ? '' : s).replace(/\s+/g, '');
}

function isCodeish(line) {
  return /[=;()]/.test(line);
}

// keyed by a stable substring of question_text (survives re-seeding)
const CURATED = [
  // --- CODEBUGGING.txt set (must precede older keys)
  {
    key: 'second largest',
    mode: 'override',
    required: ['scanf("%d", &a[i]);', 'for(i = 0; i < 5; i++)', 'else if(a[i] > second && a[i] != largest)', 'printf("Second largest = %d", second);'],
    forbidden: ['for(i = 0; i <= 5; i++)', 'scanf("%d", a[i]);', 'else if(a[i] < second)', 'second", second)printf("Thank'],
  },
  {
    key: 'armstrong',
    mode: 'override',
    required: ['#include <stdio.h>', 'int n, temp, digit, sum = 0;', 'scanf("%d", &n);', 'while(temp > 0)', 'sum = sum + digit * digit * digit;', 'if(sum == n)', 'printf("Sum = %d\\n", sum);'],
    forbidden: ['#include <stdo.h>', 'sum = 1;', 'scanf("%d", n);', 'while(temp >= 0)', 'sum = sum + digit * digit;', 'if(sum = n)'],
  },
  {
    key: 'matrix a:',
    mode: 'override',
    required: ['scanf("%d", &b[i][j]);', 'c[i][j] = 0;', 'c[i][j] += a[i][k] * b[k][j];'],
    requiredCS: ['scanf("%d", &a[i][j]);'],
    forbidden: ['scanf("%d", b[i][j]);', 'c[i][j] = 1;', 'c[i][j] = a[i][k] * b[k][j];', 'for(i = 0; i <= 3; i++)', 'for(j = 0; j <= 3; j++)'],
  },
  {
    key: 'binary search',
    mode: 'override',
    required: ['if(a[j] > a[j + 1])', 'high = n - 1;', 'else if(a[mid] > key)', 'high = mid - 1;', 'low = mid + 1;', 'if(found == 1)', 'printf("Element found at position %d\\n", mid + 1);'],
    forbidden: ['if(a[j] < a[j + 1])', 'high = n;', 'low = mid - 1;', 'high = mid + 1;', 'if(found = 1)', 'a[mid] < key'],
  },
  {
    key: 'struct student',
    mode: 'override',
    required: ['memcpy(&copy, &s[highest], sizeof(struct Student));', 'if(strcmp(s[highest].name, copy.name) == 0)', '%p'],
    forbidden: ['memcpy(&copy, s, sizeof(s));', 's[highest].average = s[highest].average / 3;', 's[i].average > 100', 'printf("Address of top student: %d', 'free(s);printf("Top student: %s'],
  },
  {
    key: 'findlargest',
    mode: 'override',
    required: ['if(a[n - 1] > largest)', 'largest = a[n - 1];', 'return a[n - 1] + findSum(a, n - 1);', '(float)sum / n);', 'printf("\\nNumber of elements = %d\\n", n);', 'int *ptr = a + n - 1;'],
    forbidden: ['if(a[n] > largest)', 'largest = a[n];', 'return a[n] + findSum(a, n - 1);', '(float)sum / (n - 1));', 'sizeof(a));'],
  },
  // --- NEW .odt debugging set (must precede old keys; several old keys
  // --- like "sum = 0;", "palindrome", "average" also substring-match new texts)
  {
    key: 'sum += i;',
    mode: 'override',
    required: ['scanf("%d",&n);'],
    forbidden: ['scanf("%d",n);'],
  },
  {
    key: 'arr[5] = {10',
    mode: 'override',
    required: ['for(inti=0;i<5;i++)'],
    forbidden: ['for(inti=0;i<=5;i++)'],
  },
  {
    key: 'reversed = 0, remainder',
    mode: 'override',
    required: ['intoriginal=n;', 'if(original==reversed)'],
    forbidden: ['printf("reversed number = %d\\n", n);', 'if(n==reversed)'],
  },
  {
    key: 'int arr[10], n;',
    mode: 'override',
    required: ['largest=arr[0];', 'smallest=arr[0];'],
    forbidden: ['largest=0;', 'smallest=0;'],
  },
  {
    key: 'temp = arr[j];',
    mode: 'override',
    required: [],
    forbidden: ['for(i=0;i<=n;i++)'],
  },
  {
    key: 'duplicate elements:',
    mode: 'override',
    required: ['for(j=i+1;j<n;j++)'],
    forbidden: ['for(j=0;j<n;j++)', 'if(count>1)'],
  },
  // --- original txt-based debugging set
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

// Sample stdin + expected-output reference for the interactive Run button.
// The submitted C program is compiled and executed with `input` on stdin.
// When `canonical` is given, the reference program is run with the same input
// and the normalized outputs are compared for equality.  Otherwise the run is
// Correct only when the output contains every `contains` fragment.
const FIXED = {
  sum: [
    '#include <stdio.h>',
    'int main() {',
    'int n, sum = 0;',
    'printf("Enter n: ");',
    'scanf("%d", &n);',
    'for(int i = 1; i <= n; i++) {',
    'sum += i;',
    '}',
    'printf("Sum = %d\\n", sum);',
    'return 0;',
    '}',
  ].join('\n'),
  avg: [
    '#include <stdio.h>',
    'int main() {',
    'int arr[5] = {10, 20, 30, 40, 50};',
    'int sum = 0;',
    'for(int i = 0; i < 5; i++) {',
    'sum += arr[i];',
    '}',
    'printf("Average = %.2f\\n", sum / 5.0);',
    'return 0;',
    '}',
  ].join('\n'),
  palin: [
    '#include <stdio.h>',
    'int main() {',
    'int n, reversed = 0, remainder;',
    'printf("Enter a number: ");',
    'scanf("%d", &n);',
    'int original = n;',
    'while(n != 0) {',
    'remainder = n % 10;',
    'reversed = reversed * 10 + remainder;',
    'n = n / 10;',
    '}',
    'printf("Reversed number = %d\\n", reversed);',
    'if(original == reversed)',
    'printf("Palindrome\\n");',
    'else',
    'printf("Not Palindrome\\n");',
    'return 0;',
    '}',
  ].join('\n'),
  minmax: [
    '#include <stdio.h>',
    'int main() {',
    'int arr[10], n;',
    'int largest, smallest;',
    'printf("Enter number of elements: ");',
    'scanf("%d", &n);',
    'printf("Enter elements:\\n");',
    'for(int i = 0; i < n; i++) {',
    'scanf("%d", &arr[i]);',
    '}',
    'largest = arr[0];',
    'smallest = arr[0];',
    'for(int i = 1; i < n; i++) {',
    'if(arr[i] > largest)',
    'largest = arr[i];',
    'if(arr[i] < smallest)',
    'smallest = arr[i];',
    '}',
    'printf("Largest = %d\\n", largest);',
    'printf("Smallest = %d\\n", smallest);',
    'return 0;',
    '}',
  ].join('\n'),
  sort: [
    '#include <stdio.h>',
    'int main() {',
    'int arr[50], n;',
    'int i, j, temp;',
    'printf("Enter number of elements: ");',
    'scanf("%d", &n);',
    'printf("Enter elements:\\n");',
    'for(i = 0; i < n; i++) {',
    'scanf("%d", &arr[i]);',
    '}',
    'for(i = 0; i < n; i++) {',
    'for(j = 0; j < n - 1; j++) {',
    'if(arr[j] < arr[j + 1]) {',
    'temp = arr[j];',
    'arr[j] = arr[j + 1];',
    'arr[j + 1] = temp;',
    '}',
    '}',
    '}',
    'printf("Sorted array:\\n");',
    'for(i = 0; i < n; i++) {',
    'printf("%d ", arr[i]);',
    '}',
    'printf("\\n");',
    'return 0;',
    '}',
  ].join('\n'),
  dups: [
    '#include <stdio.h>',
    'int main() {',
    'int arr[50], n;',
    'int i, j;',
    'printf("Enter number of elements: ");',
    'scanf("%d", &n);',
    'printf("Enter elements:\\n");',
    'for(i = 0; i < n; i++) {',
    'scanf("%d", &arr[i]);',
    '}',
    'printf("Duplicate elements:\\n");',
    'for(i = 0; i < n; i++) {',
    'for(j = i + 1; j < n; j++) {',
    'if(arr[i] == arr[j]) {',
    'printf("%d ", arr[i]);',
    'break;',
    '}',
    '}',
    '}',
    'printf("\\n");',
    'return 0;',
    '}',
  ].join('\n'),
};

const FIXED_CB = {
  seclargest: "#include <stdio.h>\n\nint main() {\n    int a[5], i;\n    int largest, second;\n\n    printf(\"Enter 5 elements:\\n\");\n\n    for(i = 0; i < 5; i++)\n        scanf(\"%d\", &a[i]);\n\n    largest = a[0];\n    second = a[1];\n\n    for(i = 1; i < 5; i++) {\n        if(a[i] > largest) {\n            second = largest;\n            largest = a[i];\n        }\n        else if(a[i] > second && a[i] != largest) {\n            second = a[i];\n        }\n    }\n\n    printf(\"Second largest = %d\", second);\n\n    printf(\"Thank you!\");\n\n    return 0;\n}",
  armstrong: "#include <stdio.h>\n\nint main() {\n    int n, temp, digit, sum = 0;\n\n    printf(\"Enter a 3-digit number: \");\n    scanf(\"%d\", &n);\n\n    temp = n;\n\n    while(temp > 0) {\n        digit = temp % 10;\n        sum = sum + digit * digit * digit;\n        temp = temp / 10;\n    }\n\n    if(sum == n)\n        printf(\"Armstrong number\\n\");\n    else\n        printf(\"Not an Armstrong number\\n\");\n\n    printf(\"Sum = %d\\n\", sum);\n\n    return 0;\n}",
  matmul: "#include <stdio.h>\n\nint main() {\n    int a[3][3], b[3][3], c[3][3];\n    int i, j, k;\n\n    printf(\"Enter elements of Matrix A:\\n\");\n\n    for(i = 0; i < 3; i++) {\n        for(j = 0; j < 3; j++) {\n            scanf(\"%d\", &a[i][j]);\n        }\n    }\n\n    printf(\"Enter elements of Matrix B:\\n\");\n\n    for(i = 0; i < 3; i++) {\n        for(j = 0; j < 3; j++) {\n            scanf(\"%d\", &b[i][j]);\n        }\n    }\n\n    for(i = 0; i < 3; i++) {\n        for(j = 0; j < 3; j++) {\n\n            c[i][j] = 0;\n\n            for(k = 0; k < 3; k++) {\n                c[i][j] += a[i][k] * b[k][j];\n            }\n        }\n    }\n\n    printf(\"\\nResultant Matrix:\\n\");\n\n    for(i = 0; i < 3; i++) {\n        for(j = 0; j < 3; j++) {\n            printf(\"%d \", c[i][j]);\n        }\n        printf(\"\\n\");\n    }\n\n    printf(\"Matrix multiplication completed\\n\");\n\n    return 0;\n}",
  bubblesearch: "#include <stdio.h>\n\nint main() {\n    int a[7], n, i, j, temp;\n    int key, low, high, mid, found = 0;\n\n    printf(\"Enter number of elements: \");\n    scanf(\"%d\", &n);\n\n    printf(\"Enter %d elements:\\n\", n);\n\n    for(i = 0; i < n; i++)\n        scanf(\"%d\", &a[i]);\n\n    /* Bubble Sort */\n    for(i = 0; i < n - 1; i++) {\n        for(j = 0; j < n - i - 1; j++) {\n\n            if(a[j] > a[j + 1]) {\n                temp = a[j];\n                a[j] = a[j + 1];\n                a[j + 1] = temp;\n            }\n        }\n    }\n\n    printf(\"\\nSorted Array:\\n\");\n\n    for(i = 0; i < n; i++)\n        printf(\"%d \", a[i]);\n\n    printf(\"\\nEnter element to search: \");\n    scanf(\"%d\", &key);\n\n    low = 0;\n    high = n - 1;\n\n    while(low <= high) {\n        mid = (low + high) / 2;\n\n        if(a[mid] == key) {\n            found = 1;\n            break;\n        }\n        else if(a[mid] > key) {\n            high = mid - 1;\n        }\n        else {\n            low = mid + 1;\n        }\n    }\n\n    if(found == 1) {\n        printf(\"Element found at position %d\\n\", mid + 1);\n    }\n    else {\n        printf(\"Element not found\\n\");\n    }\n\n    printf(\"Search completed.\\n\");\n\n    return 0;\n}",
  students: "#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\nstruct Student {\n    char name[30];\n    int marks[3];\n    float average;\n};\n\nint main() {\n    int n, i, j;\n    float total;\n    struct Student *s;\n\n    printf(\"Enter number of students: \");\n    scanf(\"%d\", &n);\n\n    s = (struct Student *)malloc(n * sizeof(struct Student));\n\n    if (s == NULL) {\n        printf(\"Memory allocation failed\\n\");\n        return 1;\n    }\n\n    for (i = 0; i < n; i++) {\n        printf(\"\\nEnter name: \");\n        scanf(\"%29s\", s[i].name);\n\n        total = 0;\n\n        printf(\"Enter 3 marks: \");\n        for (j = 0; j < 3; j++) {\n            scanf(\"%d\", &s[i].marks[j]);\n            total += s[i].marks[j];\n        }\n\n        s[i].average = total / 3;\n    }\n\n    for (i = 0; i < n; i++) {\n        if (s[i].average < 0) {\n            s[i].average = 0;\n        }\n    }\n\n    int highest = 0;\n\n    for (i = 1; i < n; i++) {\n        if (s[i].average > s[highest].average) {\n            highest = i;\n        }\n    }\n\n    printf(\"\\nTop Student: %s\\n\", s[highest].name);\n    printf(\"Average: %.2f\\n\", s[highest].average);\n\n    struct Student copy;\n\n    memcpy(&copy, &s[highest], sizeof(struct Student));\n\n    printf(\"\\nCopied Student: %s\\n\", copy.name);\n\n    s[highest].average = s[highest].average;\n\n    if (strcmp(s[highest].name, copy.name) == 0)\n        printf(\"Names are same\\n\");\n    else\n        printf(\"Names are different\\n\");\n\n    printf(\"Address of top student: %p\\n\", (void *)&s[highest]);\n\n    printf(\"Top student: %s\\n\", s[highest].name);\n\n    free(s);\n    s = NULL;\n\n    return 0;\n}",
  recurse: "#include <stdio.h>\n\nint findLargest(int a[], int n) {\n    if (n == 1)\n        return a[0];\n\n    int largest = findLargest(a, n - 1);\n\n    if (a[n - 1] > largest) {\n        largest = a[n - 1];\n    }\n\n    return largest;\n}\n\nint findSum(int a[], int n) {\n    if (n == 0)\n        return 0;\n\n    return a[n - 1] + findSum(a, n - 1);\n}\n\nvoid displayArray(int a[], int n) {\n    if (n == 0)\n        return;\n\n    printf(\"%d \", a[n - 1]);\n    displayArray(a, n - 1);\n}\n\nint main() {\n    int a[] = {12, 45, 7, 89, 34};\n    int n = 5;\n\n    int largest = findLargest(a, n);\n    int sum = findSum(a, n);\n\n    printf(\"Largest element = %d\\n\", largest);\n    printf(\"Sum of elements = %d\\n\", sum);\n\n    printf(\"Average = %.2f\\n\", (float)sum / n);\n\n    printf(\"Array: \");\n    displayArray(a, n);\n\n    printf(\"\\nNumber of elements = %d\\n\", n);\n\n    int *ptr = a + n - 1;\n\n    printf(\"Last element = %d\\n\", *ptr);\n\n    return 0;\n}",
};

const RUN_META = [
  { key: 'second largest', input: '10\n20\n5\n30\n15\n', canonical: FIXED_CB.seclargest },
  { key: 'armstrong', input: '153\n', canonical: FIXED_CB.armstrong },
  { key: 'matrix a:', input: '1\n2\n3\n4\n5\n6\n7\n8\n9\n9\n8\n7\n6\n5\n4\n3\n2\n1\n', canonical: FIXED_CB.matmul },
  { key: 'binary search', input: '5\n5\n3\n1\n4\n2\n3\n', canonical: FIXED_CB.bubblesearch },
  { key: 'struct student', input: '2\nAnn\n90\n80\n70\nBob\n60\n70\n80\n', canonical: FIXED_CB.students },
  { key: 'findlargest', input: '', canonical: FIXED_CB.recurse },
  { key: 'sum += i;', input: '5\n', canonical: FIXED.sum },
  { key: 'arr[5] = {10', input: '', canonical: FIXED.avg },
  { key: 'reversed = 0, remainder', input: '121\n', canonical: FIXED.palin },
  { key: 'int arr[10], n;', input: '3\n-5\n-1\n-7\n', canonical: FIXED.minmax },
  { key: 'temp = arr[j];', input: '4\n3\n1\n2\n4\n', canonical: FIXED.sort },
  { key: 'duplicate elements:', input: '5\n1\n2\n1\n3\n1\n', canonical: FIXED.dups },
  // original txt-based set (contains-based)
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
      requiredCS: (override.requiredCS || []).map(stripWS),
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
  return { required: [...new Set(required)], requiredCS: [], forbidden: [...new Set(forbidden)] };
}

// Fraction of correction applied by the student's program, in [0, 1].
// Each required fragment must be present, each requiredCS fragment must be
// present with exact casing, and each forbidden (buggy) fragment must be gone.
// The fraction is the share of those checks that pass, so partial fixes earn
// partial marks (a student who fixes 4 of 6 bugs gets 4/6 of the marks).
function scoreDebugFix(question, studentCode) {
  const { required, requiredCS, forbidden } = rubric(question);
  const total = required.length + requiredCS.length + forbidden.length;
  if (!total) return 0;
  const norm = normLine(studentCode);
  const normCS = stripWS(studentCode);
  let ok = 0;
  for (const f of required) if (norm.includes(f)) ok += 1;
  for (const f of requiredCS) if (normCS.includes(f)) ok += 1;
  for (const f of forbidden) if (!norm.includes(f)) ok += 1;
  return ok / total;
}

function isDebugFixCorrect(question, studentCode) {
  return scoreDebugFix(question, studentCode) === 1;
}

module.exports = { isDebugFixCorrect, scoreDebugFix, rubric, debugRunMeta };