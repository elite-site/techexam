import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout.jsx';
import Loading from '../../components/Loading.jsx';
import { request } from '../../api.js';

function StatCard({ label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</div>
      <div className="text-3xl font-bold text-brand-700">{value ?? '—'}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function TestControls({ t, refresh }) {
  const [busy, setBusy] = useState('');
  const isActive = t.status === 'ACTIVE';
  async function act(action) {
    setBusy(action);
    try {
      await request(`/admin/tests/${t.id}/${action}`, 'POST');
      refresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-primary" disabled={!!busy || isActive} onClick={() => act('start')}>
        {busy === 'start' ? '…' : 'Start'}
      </button>
      <button className="btn-outline" disabled={!!busy || !isActive} onClick={() => act('stop')}>
        {busy === 'stop' ? '…' : 'Stop'}
      </button>
      <button className="btn-danger" disabled={!!busy} onClick={async () => {
        if (confirm(`Restart "${t.name}"? This will reset ALL attempts and answers for this test.`)) act('restart');
      }}>
        {busy === 'restart' ? '…' : 'Restart'}
      </button>
      <Link to={`/admin/questions/${t.id}`} className="btn-soft">Manage Questions</Link>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');

  async function refresh() {
    try {
      const d = await request('/admin/stats');
      setStats(d);
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => { refresh(); }, []);

  return (
    <AdminLayout title="Admin Dashboard" subtitle="Control examinations, questions and monitor student activity.">
      {err && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">{err}</div>}
      {!stats && <Loading />}
      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <StatCard label="Total Students" value={stats.total_students} />
            <StatCard label="Debugging Attempts" value={stats.debugging_attempts} />
            <StatCard label="Debugging Submitted" value={stats.debugging_submitted} />
            <StatCard label="Quiz R1 Submitted" value={stats.quiz_round1_submitted} />
            <StatCard label="Quiz R2 Submitted" value={stats.quiz_round2_submitted} />
          </div>

          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Examinations</h2>
          <div className="space-y-5">
            {stats.tests.map((t) => (
              <div key={t.id} className="card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-ink">{t.name}{t.round ? ` — Round ${t.round}` : ''}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {t.question_count} Questions&nbsp;|&nbsp;{Math.round(t.duration_seconds / 60)} Minutes
                    </p>
                  </div>
                  {isActiveColor(t)}
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4 max-w-md text-center">
                  <div className="rounded-lg bg-slate-50 py-2"><div className="text-xs text-slate-400">Attempts</div><div className="font-bold text-ink">{t.attempt_count}</div></div>
                  <div className="rounded-lg bg-slate-50 py-2"><div className="text-xs text-slate-400">Submitted</div><div className="font-bold text-ink">{t.submitted_count}</div></div>
                  <div className="rounded-lg bg-slate-50 py-2"><div className="text-xs text-slate-400">In Progress</div><div className="font-bold text-ink">{t.in_progress_count}</div></div>
                </div>
                <TestControls t={t} refresh={refresh} />
              </div>
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  );

  function isActiveColor(t) {
    return t.status === 'ACTIVE' ? <span className="badge-green">● Status: ACTIVE</span> : <span className="badge-gray">● Status: STOPPED</span>;
  }
}