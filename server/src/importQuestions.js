const fs = require('fs');

// ==========================================================================
// Parsers for the provided question text files.
// Technical Quiz (First Round).txt  -> 30 questions Round 1, 20 questions Round 2
// debugquestion.txt                 -> 6 debugging problems
// ==========================================================================

const has = (re, str) => re.test(str);

function findIdx(text, re, from) {
  const m = text.slice(from).match(re);
  return m ? from + m.index : -1;
}

// Extract options from a line that may contain one or more "A."/"A)"-style options.
// Returns object {letter: text} or null when the line carries no options.
function extractOptions(line) {
  const markers = [];
  const re = /\b([ABCD])[.)]/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    markers.push({ letter: m[1].toUpperCase(), index: m.index, end: m.index + m[0].length });
  }
  if (!markers.length) return null;
  const opts = {};
  markers.forEach((mk, k) => {
    const start = mk.end;
    const end = k + 1 < markers.length ? markers[k + 1].index : line.length;
    const t = line.slice(start, end).trim();
    opts[mk.letter] = t;
  });
  if (!Object.values(opts).some((v) => v !== '')) return null;
  return opts;
}

function hasOptionStart(line) {
  return /^[ABCD][.)]\s/.test(line.trim());
}

function findAnswer(lines, fromIdx) {
  for (let i = fromIdx; i < Math.min(lines.length, fromIdx + 3); i++) {
    const line = lines[i];
    let m = line.match(/(?:\(?\s*Answer\s*[:=.-]?\s*\)?\s*)([A-Da-d])\b/);
    if (!m) m = line.match(/^\s*Answer\s*[:=.-]?\s*([A-Da-d])\b/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

// Detect a line that begins a new numbered question:
//   1. text | 1) text | 1- text | 7 Which text   (NOT "2, 6, 12" sequences)
function parseQuestionLine(line) {
  const m = line.trim().match(/^(\d+)(?:[.\-–\)]\s*|\s+(?!\d))\s*(.*)$/);
  if (!m) return null;
  const rest = m[2].trim();
  if (!rest || hasOptionStart(rest)) return null;
  return { num: m[1], rest };
}
function isQuestionStart(line) {
  return !!parseQuestionLine(line);
}

// Parse an MCQ section (questions numbered 1..n with A-D options).
function parseMCQSection(text) {
  const lines = text.split(/\r?\n/);
  const questions = [];
  let i = 0;
  while (i < lines.length) {
    const parsed = parseQuestionLine(lines[i]);
    if (parsed) {
      const q = {
        question_text: parsed.rest,
        question_type: 'mcq',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_answer: null,
      };
      let j = i + 1;
      const opts = {};
      let limit = Math.min(lines.length, i + 12);
      while (j < limit) {
        const line = lines[j].trim();
        if (line === '') { j += 1; continue; }
        if (isQuestionStart(line)) break; // next numbered question started
        const par = extractOptions(line);
        if (par) {
          Object.assign(opts, par);
          j += 1;
          // continue consuming pure-option continuation lines
          while (j < limit) {
            const l2 = lines[j].trim();
            if (l2 === '') { j += 1; continue; }
            if (isQuestionStart(l2)) break;
            const p2 = extractOptions(l2);
            if (p2) { Object.assign(opts, p2); j += 1; continue; }
            break;
          }
          break;
        }
        // continuation of a long question statement
        q.question_text += ' ' + line;
        j += 1;
      }
      q.option_a = opts.A || '';
      q.option_b = opts.B || '';
      q.option_c = opts.C || '';
      q.option_d = opts.D || '';
      const present = [q.option_a, q.option_b, q.option_c, q.option_d].some((v) => v.trim() !== '');
      if (!present) { i += 1; continue; }
      q.correct_answer = findAnswer(lines, j - 1);
      questions.push(q);
      i = j;
    } else {
      i += 1;
    }
  }
  return questions;
}

// Jumbled sentences -> 'text' type questions
function parseJumbled(text) {
  const out = [];
  const re = /Unscramble\s*:?\s*(.+?)\s*(?:[→-]|\(|\s{3,})\s*\(?\s*([A-Z][A-Z ]*)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    let correct = m[2].trim();
    correct = correct.split(/—|–|-/)[0].trim();
    const scramble = m[1].trim();
    out.push({
      question_text: `Unscramble the jumbled word: "${scramble}"`,
      question_type: 'text',
      correct_answer: correct,
    });
  }
  return out;
}

// Matching pairs -> 'text' type questions
function parseMatchings(text) {
  const sets = text.split(/Column\s*A\s+Column\s*B/i).slice(1);
  const out = [];
  for (const set of sets) {
    const lines = set.split(/\r?\n/);
    const pairs = [];
    for (const line of lines) {
      const m = line.match(/^\s*(\d+)[\.\s]\s*(.*?)\s+([ABCD])[.)]\s+(.*)$/);
      if (m) pairs.push({ n: m[1], left: m[2].trim(), letter: m[3], right: m[4].trim() });
    }
    if (pairs.length < 3) continue;
    const linesOut = pairs.map((p) => `${p.n}. ${p.left.padEnd(16)} ${p.letter}. ${p.right}`).join('\n');
    const ansM = set.match(/\bAnswer\s*[:=.-]?\s*(.*)/i);
    let correct = null;
    if (ansM) {
      const pairs2 = [...ansM[1].matchAll(/(\d)\s*[→\-]\s*([ABCD])/gi)];
      if (pairs2.length >= 3) {
        correct = pairs2.map((p) => `${p[1]}-${p[2].toUpperCase()}`).join(', ');
      }
    }
    out.push({
      question_text: `Match the following pairs (type the mapping, e.g. 1-B, 2-C):\n${linesOut}`,
      question_type: 'text',
      correct_answer: correct,
    });
  }
  return out;
}

// Debugging problems -> 'code' type questions
function parseDebug(text) {
  const blocks = text.split(/Question-?\s*\d+/i).slice(1);
  const out = [];
  for (const block of blocks) {
    const ansIdx = block.search(/\banswers?-?\s*[:.=—-]*/i);
    let code = ansIdx >= 0 ? block.slice(0, ansIdx) : block;
    let answer = ansIdx >= 0 ? block.slice(ansIdx) : '';
    answer = answer.replace(/^\s*answers?-?\s*[:.=—-]*\s*/i, '').trim();
    code = code.trim();
    if (!code) continue;
    answer = answer.replace(/\r/g, '');
    const scrubbed = answer
      .split(/\r?\n/)
      .filter((l) => !/^\s*(wrong|note|adjust|corrected|fix|expected)\b/i.test(l.trim()))
      .map((l) => l.trim())
      .filter((l) => l !== '')
      .join('\n');
    out.push({
      question_text: `Identify and fix the error(s) in the following C program. Write the corrected line(s) / code.\n\n${code}`,
      question_type: 'code',
      correct_answer: scrubbed,
    });
  }
  return out;
}

// ==========================================================================
// Split the Round-1 quiz file into sections and return round-appropriate arrays
// ==========================================================================
function parseQuizFile(text) {
  // Search headers sequentially so the Structure list at the top never
  // collides with the real section headers.
  let iJum = findIdx(text, /Jumbled\s+sentences/i, 0);
  let iKey = findIdx(text, /Keyboard\s+Shortcuts/i, iJum);
  let iTech = findIdx(text, /^\s*TECHNICAL\s*$/m, iKey);
  let iAI = findIdx(text, /AI\s+Tech/i, iTech);
  let iHTML = findIdx(text, /HTML\s+AND\s+CSS/i, iAI);
  let iPuzz = findIdx(text, /^\s*Puzzles\s*$/m, iHTML);
  let iMatch = findIdx(text, /Matchings/i, iPuzz);
  const end = text.length;

  const sec = (a, b) => (a >= 0 && b > a ? text.slice(a, b) : '');
  const logo = parseMCQSection(sec(0, iJum)); // logo section is before Jumbled
  const jumbled = parseJumbled(sec(iJum, iKey));
  const keyboard = parseMCQSection(sec(iKey, iTech));
  const technical = parseMCQSection(sec(iTech, iAI));
  const ai = parseMCQSection(sec(iAI, iHTML));
  const html = parseMCQSection(sec(iHTML, iPuzz));
  const puzzles = parseMCQSection(sec(iPuzz, iMatch));
  const matchings = parseMatchings(sec(iMatch, end));

  const delay = (arr, n) => arr.slice(0, n);
  return {
    round1: [
      ...delay(logo, 10),
      ...delay(jumbled, 5),
      ...delay(keyboard, 5),
      ...delay(technical, 5),
      ...delay(ai, 5),
    ],
    round2: [...delay(html, 10), ...delay(puzzles, 5), ...matchings],
  };
}

module.exports = { parseQuizFile, parseDebug, parseMCQSection, parseStudentsFromWorkbook: null };