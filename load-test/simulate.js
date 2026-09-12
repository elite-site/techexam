/**
 * Load test — simulate N students taking an exam simultaneously.
 *
 * Usage:
 *   node load-test/simulate.js --students 150 --test 2
 *
 * Flow per student: login → start test → save answers → submit.
 * Starts the target test via the admin API first (if not already ACTIVE).
 *
 * Env: API_BASE (default http://localhost:5000/api),
 *      ADMIN_USER / ADMIN_PASS (default ADMIN/ADMIN123)
 */

const API = process.env.API_BASE || 'http://localhost:5000/api';
const ADMIN_USER = process.env.ADMIN_USER || 'ADMIN';
const ADMIN_PASS = process.env.ADMIN_PASS || 'ADMIN123';
const CONCURRENCY = 150;

const args = {};
process.argv.slice(2).forEach((a, i, arr) => {
  if (a.startsWith('--')) args[a.slice(2)] = arr[i + 1] === undefined || arr[i + 1].startsWith('--') ? true : arr[i + 1];
});
const NUM = Number(args.students || 150);
const TEST_ID = Number(args.test || 2);

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${(data && data.error) || res.statusText}`);
  return data;
}

async function main() {
  // 1. Admin: make sure target test is ACTIVE
  const admin = await api('/auth/admin/login', { method: 'POST', body: { username: ADMIN_USER, password: ADMIN_PASS } });
  const stats = await api('/admin/stats', { token: admin.token });
  const test = stats.tests.find((t) => String(t.id) === String(TEST_ID));
  if (!test) throw new Error(`Test ${TEST_ID} not found`);
  if (test.status !== 'ACTIVE') {
    console.log(`Starting test ${TEST_ID} (${test.name})…`);
    await api(`/admin/tests/${TEST_ID}/start`, { method: 'POST', token: admin.token });
  }

  // 2. Pick students
  const sres = await api('/admin/students', { token: admin.token });
  const students = sres.students.slice(0, NUM);
  if (students.length < NUM) console.warn(`Only ${students.length} students available (requested ${NUM}).`);

  // 3. Simulate each student
  const t0 = Date.now();
  let done = 0, ok = 0;
  const timings = [];
  const failed = [];

  async function simulateReal(student) {
    const label = student.roll_number;
    const times = {};
    let token = '';
    async function step(name, fn) {
      const s = Date.now();
      try { const r = await fn(); times[name] = Date.now() - s; return r; }
      catch (e) { throw new Error(`${name}: ${e.message}`); }
    }
    try {
      const login = await step('login', () => api('/auth/student/login', { method: 'POST', body: { roll_number: label, password: label } }));
      token = login.token;
      const res = await step('start', () => api(`/student/tests/${TEST_ID}/start`, { method: 'POST', token }));
      const questions = res.questions || [];
      const payload = questions.map((q) => ({
        question_id: q.id,
        answer: q.question_type === 'mcq' ? 'A' : '# include <stdio.h>',
      }));
      await step('answers', () => api(`/student/tests/${TEST_ID}/answers`, { method: 'PUT', token, body: { answers: payload } }));
      const sub = await step('submit', () => api(`/student/tests/${TEST_ID}/submit`, { method: 'POST', token, body: { answers: payload } }));
      times.total = Object.values(times).reduce((a, b) => a + b, 0);
      timings.push({ roll: label, times });
      done++; ok++;
      console.log(`[${done}/${students.length}] ${label} submitted score=${sub && sub.score}`);
    } catch (e) {
      done++;
      failed.push(label);
      console.error(`[${done}/${students.length}] ${label} FAILED: ${e.message}`);
    }
  }

  await Promise.all(students.map((s, i) => new Promise((r) => setTimeout(r, i * 10)).then(() => simulateReal(s))));

  const wall = Date.now() - t0;
  console.log('\n===== LOAD TEST RESULTS =====');
  console.log(`Students attempted: ${students.length}  OK: ${ok}  Failed: ${failed.length}`);
  console.log(`Wall time: ${(wall / 1000).toFixed(2)}s`);
  if (timings.length) {
    const avg = (k) => Math.round(timings.reduce((a, t) => a + t.times[k], 0) / timings.length);
    const max = (k) => Math.max(...timings.map((t) => t.times[k]));
    for (const k of ['login', 'start', 'answers', 'submit']) {
      console.log(`${k.padEnd(8)} avg ${avg(k)}ms   max ${max(k)}ms`);
    }
    console.log(`full-flow avg ${avg('total')}ms  max ${max('total')}ms`);
  }
  if (failed.length) console.log('\nFailed:\n' + failed.join('\n'));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });