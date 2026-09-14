const fs = require('fs');
const { execFileSync } = require('child_process');

// ==========================================================================
// Parsers for the provided question text files.
// Technical Quiz (First Round).txt  -> 30 questions Round 1, 20 questions Round 2
// debugquestion.txt                 -> 6 debugging problems
// NEW-ROUND-1.odt / NEW-ROUND-2.odt / NEW-DEBUGGING.odt -> replacement sets
// ==========================================================================

// Extract readable text out of an OpenDocument (text) zip container.
function extractOdtText(filePath) {
  const xml = execFileSync('unzip', ['-p', filePath, 'content.xml'], { maxBuffer: 16 * 1024 * 1024 }).toString('utf8');
  const paras = [];
  const re = /<text:p\b[^>]*>([\s\S]*?)<\/text:p>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    let inner = m[1];
    inner = inner.replace(/<text:line-break\s*\/>/g, '\n');
    inner = inner.replace(/<text:tab\s*\/>/g, '\t');
    inner = inner.replace(/<text:s\b[^>]*\/>/g, ' ');
    inner = inner.replace(/<[^>]+>/g, '');
    inner = inner
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#10;/g, '\n');
    paras.push(inner);
  }
  return paras;
}

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

// ==========================================================================
// Parsers for the NEW .odt question sets (all-MCQ rounds + code debugging)
// ==========================================================================

// Unified parser for the new .odt MCQs. Every question ends with an "Answer:" line.
// "numbered" additionally strips the explicit "N. " prefix from each question.
function parseNewMCQ(paras, numbered) {
  const lines = paras
    .flatMap((p) => p.split('\n'))
    .map((l) => l.trim())
    .filter((l) => l !== '');
  if (lines.length) {
    lines[0] = lines[0].replace(/^\s*ROUND\s*[-–—]?\s*\d*\s*/i, '');
    lines[0] = lines[0].replace(/^\d+[.)]\s*/, '');
  }
  const isOptionLine = (l) => {
    const tr = l.trim();
    if (/^[ABCD][.)]\s?[^)]/.test(tr)) return true;
    const ms = tr.match(/\b[ABCD][.)]/g);
    return !!(ms && ms.length >= 2);
  };
  const out = [];
  let buf = [];
  const finish = (ansLine) => {
    const letter = (ansLine.match(/\b([A-Da-d])\b/) || [])[1];
    let optStart = buf.length;
    while (optStart > 0 && isOptionLine(buf[optStart - 1])) optStart--;
    const optLines = buf.slice(optStart);
    const opts = {};
    for (const ol of optLines) {
      const om = ol.match(/^([ABCD])[.)]\s*(.*)$/);
      if (!om) {
        const mks = [...ol.matchAll(/\b([ABCD])[.)]/g)];
        for (const mk of mks) {
          const after = ol.slice(mk.index + 2);
          const next = mk.index + 2 + Math.max(0, ol.slice(mk.index + 2).search(/\b[ABCD][.)]/));
          opts[mk[1].toUpperCase()] = ol.slice(mk.index + 2, next).trim();
        }
      } else {
        opts[om[1].toUpperCase()] = om[2];
      }
    }
    let text = buf.slice(0, optStart).join('\n').trim();
    if (numbered) text = text.replace(/^\d+[.)]\s*/, '');
    buf = [];
    if (!letter || !opts.A || !opts.B || !opts.C || !opts.D) return;
    out.push({
      question_text: text,
      question_type: 'mcq',
      option_a: opts.A,
      option_b: opts.B,
      option_c: opts.C,
      option_d: opts.D,
      correct_answer: letter.toUpperCase(),
    });
  };
  for (const line of lines) {
    if (/^\s*(?:Answer|Ans)\s*[:=.-]/i.test(line)) finish(line);
    else buf.push(line);
  }
  return out;
}

// NEW-ROUND-1: numbered MCQs.
function parseNewRound1(paras) {
  return parseNewMCQ(paras, true);
}

// NEW-ROUND-2: unnumbered MCQs.
function parseNewRound2(paras) {
  return parseNewMCQ(paras, false);
}

// NEW-DEBUGGING: blocks of (buggy program ... "Answer:" ... explanation + fixed lines).
// Blocks are delimited by their "#include <stdio.h>" opening line.
const FIX_LINE_RE = /^\s*(int\s+original\b|scanf\s*\(|for\s*\(|if\s*\(|printf\s*\(|largest\s*=|smallest\s*=|break\s*;|return\b|[a-zA-Z_]\w*\s*=\s*|[{}])/;
function isFixLine(l) {
  if (!l || /^(Answer|Correct|The|A\s|before the loop|When|One)\b/i.test(l.trim())) return false;
  if (/^[a-zA-Z]{3,}\s+[a-zA-Z]+[^;=)(]*$/.test(l.trim())) return false; // prose sentence
  return FIX_LINE_RE.test(l);
}
function parseNewDebug(paras) {
  const lines = paras.map((p) => p.trim()).filter((p) => p !== '');
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^(?:\d+[.)]\s*-?[A-Za-z-]*)?#include\s*<stdio\.h>/i.test(lines[i])) starts.push(i);
  }
  const out = [];
  for (let s = 0; s < starts.length; s++) {
    const endIdx = s + 1 < starts.length ? starts[s + 1] : lines.length;
    const block = lines.slice(starts[s], endIdx);
    block[0] = block[0].replace(/^\d+[.)]\s*-?[A-Za-z-]*#include/i, '#include');
    const ansIdx = block.findIndex((l) => /^\s*Answer\s*[:=.-]/i.test(l));
    if (ansIdx <= 0) continue;
    const code = block.slice(0, ansIdx).join('\n');
    const answer = block.slice(ansIdx + 1);
    const fixedLines = answer.filter(isFixLine);
    out.push({
      question_text: `Identify and fix the error(s) in the following C program. Write the corrected line(s) / code.\n\n${code}`,
      question_type: 'code',
      correct_answer: fixedLines.join('\n'),
    });
  }
  return out;
}

// ==========================================================================
// Parser for CODEBUGGING.txt: Q-blocks each holding a Description, a
// "Buggy Code" section and a "Corrected Code" section.  Answer annotations
// ("// ❌ ERROR n") are stripped so students only ever see the question.
// ==========================================================================
function stripAnswerMarks(line) {
  return line.replace(/\s*\/\/\s*❌.*$/, '').replace(/❌/g, '').replace(/\s+$/, '');
}

function extractCodeBlock(lines) {
  const start = lines.findIndex((l) => /^\s*#include\b/.test(l));
  if (start < 0) return '';
  let end = lines.length - 1;
  while (end > start && lines[end].trim() !== '}') end--;
  return lines.slice(start, end + 1).map(stripAnswerMarks).join('\n').trim();
}

function parseCodebuggingFile(text) {
  const lines = text.split(/\r?\n/);
  const qStarts = [];
  lines.forEach((l, i) => { if (/^Q\d+\s*$/.test(l.trim())) qStarts.push(i); });
  const rawBlocks = qStarts.map((s, k) => lines.slice(s, k + 1 < qStarts.length ? qStarts[k + 1] : lines.length));
  // A block missing its "QN" header (e.g. Q5) is detected via a second
  // Description line inside the previous block and split off.
  const blocks = [];
  for (const seg of rawBlocks) {
    const descIdx = [];
    seg.forEach((l, i) => { if (/Description:/.test(l)) descIdx.push(i); });
    if (descIdx.length > 1) {
      blocks.push(seg.slice(0, descIdx[1]));
      blocks.push(seg.slice(descIdx[1]));
    } else {
      blocks.push(seg);
    }
  }
  const out = [];
  for (const b of blocks) {
    const descLine = b.find((l) => /Description:/.test(l)) || '';
    const description = descLine.replace(/^.*?Description:\s*/, '').trim();
    const bugIdx = b.findIndex((l) => /Buggy\s*Code/i.test(l));
    const fixIdx = b.findIndex((l) => /Corrected\s*Code/i.test(l));
    if (bugIdx < 0 || fixIdx < 0 || fixIdx <= bugIdx) continue;
    const buggy = extractCodeBlock(b.slice(bugIdx + 1, fixIdx));
    const fixed = extractCodeBlock(b.slice(fixIdx + 1));
    if (!buggy || !fixed) continue;
    out.push({
      description,
      buggy,
      fixed,
      question_text: `Identify and fix the error(s) in the following C program. Write the corrected line(s) / code.\n\n${description ? '// ' + description + '\n\n' : ''}${buggy}`,
      question_type: 'code',
      correct_answer: fixed,
    });
  }
  return out;
}

module.exports = { parseQuizFile, parseDebug, parseMCQSection, extractOdtText, parseNewRound1, parseNewRound2, parseNewDebug, parseCodebuggingFile, parseStudentsFromWorkbook: null };