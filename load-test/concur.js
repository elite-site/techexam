const API = 'http://localhost:5000/api';

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch (_) {}
  return { status: res.status, data };
}

(async () => {
  const N = Number(process.argv[2] || 30);
  const admin = await api('/auth/admin/login', { method: 'POST', body: { username: 'ADMIN', password: 'ADMIN123' } });
  const st = await api('/admin/students', { token: admin.data.token });
  const rolls = st.data.students.slice(0, N).map((s) => s.roll_number);
  console.log(`logins (${N}) starting…`);
  const t0 = Date.now();
  const tokens = await Promise.all(rolls.map((r) => api('/auth/student/login', { method: 'POST', body: { roll_number: r, password: r } })));
  const bad = tokens.filter((t) => t.status !== 200).length;
  console.log(`logins done in ${Date.now() - t0}ms, failures=${bad}`);
  const t1 = Date.now();
  const starts = await Promise.all(tokens.map((t) => api('/student/tests/2/start', { method: 'POST', token: t.data && t.data.token })));
  const sOk = starts.filter((s) => s.status === 200);
  const sFail = starts.filter((s) => s.status !== 200);
  console.log(`starts done in ${Date.now() - t1}ms, 200=${sOk.length}, others=${sFail.length}`);
  sFail.slice(0, 5).forEach((f) => console.log('  FAIL:', f.status, f.data && f.data.error));
  const submitted = await Promise.all(sOk.map((s) => api('/student/tests/2/submit', {
    method: 'POST', token: tokens[sOk.indexOf(s)].data.token,
    body: { answers: s.data.questions.map((q) => ({ question_id: q.id, answer: q.question_type === 'mcq' ? 'A' : 'x' })) },
  })));
  const subOk = submitted.filter((s) => s.status === 200);
  console.log(`submits done, 200=${subOk.length}/${submitted.length}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });