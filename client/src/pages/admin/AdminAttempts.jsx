import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout.jsx';
import Loading from '../../components/Loading.jsx';
import { request } from '../../api.js';

export default function AdminAttempts() {
  const [tests, setTests] = useState([]);
  const [filter, setFilter] = useState('all');
  const [attempts, setAttempts] = useState(null);
  const [err, setErr] = useState('');

  function fmt(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString();
  }

  useEffect(() => {
    request('/admin/tests').then((d) => setTests(d.tests)).catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    setAttempts(null);
    request('/admin/attempts' + (filter === 'all' ? '' : `?testId=${filter}`))
      .then((d) => setAttempts(d.attempts))
      .catch((e) => setErr(e.message));
  }, [filter]);

  return (
    <AdminLayout title="Attempts" subtitle="Every student attempt across all examinations.">
      {err && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">{err}</div>}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setFilter('all')} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${filter === 'all' ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>All Tests</button>
        {tests.map((t) => (
          <button key={t.id} onClick={() => setFilter(t.id)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${filter === t.id ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {t.name}{t.round ? ` R${t.round}` : ''}
          </button>
        ))}
      </div>
      {!attempts ? <Loading /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Roll Number</th>
                  <th className="px-4 py-3 font-semibold">Test</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Started</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {attempts.length === 0 && <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-400">No attempts recorded.</td></tr>}
                {attempts.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-ink">{a.student_name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{a.roll_number}</td>
                    <td className="px-4 py-2.5">{a.test_name}{a.round ? ` R${a.round}` : ''}</td>
                    <td className="px-4 py-2.5">
                      <span className={a.status === 'SUBMITTED' ? 'badge-green' : a.status === 'EXPIRED' ? 'badge-amber' : 'badge-blue'}>{a.status}</span>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-brand-700">{a.score ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{fmt(a.started_at)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{fmt(a.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}