import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { request } from '../../api.js';
import { Logo } from '../../components/Logo.jsx';
import Loading from '../../components/Loading.jsx';

const fmt = (s) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m} min`;
};

function TestCard({ t }) {
  const navigate = useNavigate();
  const att = t.attempt;
  const isActive = t.status === 'ACTIVE';
  const submitted = att && (att.status === 'SUBMITTED' || att.status === 'EXPIRED');
  const inProgress = att && att.status === 'IN_PROGRESS';

  let button;
  if (submitted) {
    button = (
      <Link to={`/student/result/${t.id}`} className="btn-soft w-full">View Result</Link>
    );
  } else if (inProgress) {
    button = (
      <button className="btn-outline w-full" onClick={() => navigate(`/student/test/${t.id}`)}>Resume Test</button>
    );
  } else if (isActive) {
    button = (
      <button className="btn-primary w-full" onClick={() => navigate(`/student/test/${t.id}`)}>Start Test</button>
    );
  } else {
    button = (
      <button className="btn w-full bg-slate-100 text-slate-400 cursor-not-allowed" disabled>Not Started</button>
    );
  }

  return (
    <div className="card p-6 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-ink text-lg leading-tight">{t.name}</h3>
        {t.round && <span className="badge-blue">Round {t.round}</span>}
      </div>
      <div className="text-sm text-slate-500">
        {t.question_count} Questions&nbsp;&nbsp;|&nbsp;&nbsp;{fmt(t.duration_seconds)}
      </div>
      <div className="flex items-center gap-2">
        {isActive ? <span className="badge-green">● Active</span> : <span className="badge-gray">● Not Started</span>}
        {submitted && <span className="badge-green">Completed · Submitted</span>}
        {inProgress && <span className="badge-amber">In Progress</span>}
      </div>
      <div className="mt-auto pt-2">{button}</div>
    </div>
  );
}

export default function StudentDashboard() {
  const { student, logout } = useAuth();
  const [tests, setTests] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    request('/student/tests')
      .then((d) => alive && setTests(d.tests))
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, []);

  if (!student) return <Loading />;
  const debugging = (tests || []).filter((t) => t.type === 'debugging');
  const quizzes = (tests || []).filter((t) => t.type === 'quiz');

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/student/dashboard"><Logo size="sm" /></Link>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold text-ink">{student.student_name}</div>
              <div className="text-xs text-slate-400">{student.roll_number} · {student.year} {student.section}</div>
            </div>
            <button className="btn-outline px-3 py-1.5" onClick={logout}>Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-ink mb-1">Welcome, {student.student_name.split(' ')[0]}</h1>
        <p className="text-slate-500 mb-8">Select a test to begin. Tests are enabled by the exam administrator.</p>

        {err && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">{err}</div>}
        {!tests && !err && <Loading />}

        {tests && tests.length === 0 && (
          <div className="card p-10 text-center text-slate-500">No examinations have been scheduled yet.</div>
        )}

        {debugging.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Code Debugging</h2>
            <div className="grid md:grid-cols-1 max-w-lg gap-4">
              {debugging.map((t) => <TestCard key={t.id} t={t} />)}
            </div>
          </section>
        )}

        {quizzes.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Technical Quiz</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {quizzes.map((t) => <TestCard key={t.id} t={t} />)}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}