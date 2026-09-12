import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { request } from '../../api.js';
import { Logo } from '../../components/Logo.jsx';
import Loading from '../../components/Loading.jsx';

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString();
}

export default function StudentResult() {
  const { testId } = useParams();
  const { student } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    request(`/student/tests/${testId}/result`)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [testId]);

  if (!student) return <Loading />;

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size="sm" />
          <Link to="/student/dashboard" className="btn-outline px-3 py-1.5">← Dashboard</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10">
        {err && <div className="card p-8 text-center text-red-600 text-sm">{err}</div>}
        {!data && <Loading />}
{data && data.result && (
            <div className="card p-8">
              <div className="text-center mb-6">
                <div className="h-14 w-14 rounded-full bg-brand-50 text-brand-600 text-2xl flex items-center justify-center mx-auto mb-3">🏁</div>
                <h1 className="text-xl font-bold text-ink">Result — {data.result.test_name}{data.result.round ? ` (Round ${data.result.round})` : ''}</h1>
                <p className="text-sm text-slate-500 mt-1">{student.roll_number} · {student.student_name}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 py-8 text-center">
                <div className="text-xs uppercase tracking-wider text-emerald-600 font-semibold">Submission</div>
                <div className="text-3xl font-bold text-emerald-700 mt-2">Submitted</div>
                <div className="text-sm text-slate-500 mt-2">Status <span className="badge-blue">{data.result.status}</span> · Submitted {fmtDate(data.result.submitted_at)}</div>
              </div>
              <div className="flex gap-3 justify-center mt-7">
                <Link to="/student/dashboard" className="btn-primary">Back to Dashboard</Link>
              </div>
            </div>
          )}
        {data && data.status === 'IN_PROGRESS' && (
          <div className="card p-8 text-center text-slate-500">This attempt is still in progress.</div>
        )}
      </main>
    </div>
  );
}