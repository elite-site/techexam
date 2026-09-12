const fs = require('fs');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { query } = require('./db');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '8', 10);

function normalizeKey(k) {
  return String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseStudentsFromWorkbook(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const out = [];
  for (const r of rows) {
    const keys = Object.keys(r);
    const get = (want) => {
      const target = normalizeKey(want);
      return keys.find((k) => normalizeKey(k) === target);
    };
    const kRoll = get('Uni Reg No') || get('UnivRegNo') || get('roll') || get('rollnumber');
    const kName = get('Student Name') || get('StudentName') || get('name');
    const kYear = get('Year');
    const kSection = get('Section');
    if (!kRoll) continue;
    const roll = String(r[kRoll] ?? '').trim();
    const name = String(r[kName] ?? '').trim();
    const year = String(r[kYear] ?? '').trim() || '';
    const section = String(r[kSection] ?? '').trim() || '';
    if (!roll) continue;
    if (!name) continue;
    out.push({ roll_number: roll, student_name: name, year, section });
  }
  return out;
}

async function importStudents(filePath) {
  const wb = XLSX.readFile(filePath);
  const students = parseStudentsFromWorkbook(wb);
  if (!students.length) throw new Error('No valid student rows found in Excel file: ' + filePath);

  // hash in bounded-concurrency batches (bcryptjs is CPU-bound)
  const chunkSize = 50;
  for (let i = 0; i < students.length; i += chunkSize) {
    const chunk = students.slice(i, i + chunkSize);
    const hashed = chunk.map((s) => bcrypt.hashSync(s.roll_number, BCRYPT_ROUNDS));
    const params = [];
    const values = [];
    chunk.forEach((s, idx) => {
      const base = idx * 5;
      params.push(s.roll_number, s.student_name, s.year, s.section, hashed[idx]);
      values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
    });
    await query(
      `INSERT INTO students (roll_number, student_name, year, section, password_hash)
       VALUES ${values.join(', ')}
       ON CONFLICT (roll_number)
       DO UPDATE SET student_name = EXCLUDED.student_name, year = EXCLUDED.year, section = EXCLUDED.section`,
      params
    );
  }

  const { rows } = await query('SELECT COUNT(*)::int AS total FROM students');
  return { processed: students.length, total: rows[0].total };
}

module.exports = { importStudents, parseStudentsFromWorkbook, BCRYPT_ROUNDS };