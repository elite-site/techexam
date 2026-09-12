import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo.jsx';

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="mb-10">
        <Logo size="lg" />
      </div>
      <h1 className="text-3xl font-bold text-ink text-center mb-2 tracking-tight">
        Online Examination Management System
      </h1>
      <p className="text-slate-500 text-center mb-10 max-w-md">
        Please choose your portal to continue.
      </p>
      <div className="grid sm:grid-cols-2 gap-5 w-full max-w-xl">
        <Link
          to="/student"
          className="card p-6 hover:shadow-soft transition-shadow border-t-4 border-t-brand-500 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="h-11 w-11 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-xl">🎓</div>
            <div>
              <div className="font-bold text-ink">Student Portal</div>
              <div className="text-xs text-slate-400">/student</div>
            </div>
          </div>
          <p className="text-sm text-slate-500">Login, take scheduled tests, track your results.</p>
          <div className="mt-4 text-sm font-semibold text-brand-600 group-hover:underline">Enter Portal →</div>
        </Link>
        <Link
          to="/admin"
          className="card p-6 hover:shadow-soft transition-shadow border-t-4 border-t-slate-400 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="h-11 w-11 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xl">🛡️</div>
            <div>
              <div className="font-bold text-ink">Admin Portal</div>
              <div className="text-xs text-slate-400">/admin</div>
            </div>
          </div>
          <p className="text-sm text-slate-500">Manage tests, questions, students and leaderboards.</p>
          <div className="mt-4 text-sm font-semibold text-slate-600 group-hover:underline">Enter Portal →</div>
        </Link>
      </div>
    </div>
  );
}