import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { Logo } from '../../components/Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function StudentLogin() {
  const { studentLogin, role } = useAuth();
  const navigate = useNavigate();
  const [roll, setRoll] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (role === 'student') {
    return <Navigate to="/student/dashboard" replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await studentLogin(roll.trim(), password);
      navigate('/student/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>
        <div className="card p-7">
          <h1 className="text-xl font-bold text-ink mb-1">Student Login</h1>
          <p className="text-sm text-slate-500 mb-6">Sign in with your registration number.</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="roll">Roll Number</label>
              <input id="roll" className="input" placeholder="e.g. 25K61A1201" value={roll}
                onChange={(e) => setRoll(e.target.value)} autoComplete="username" required />
            </div>
            <div>
              <label className="label" htmlFor="pass">Password</label>
              <input id="pass" type="password" className="input" placeholder="Your initial password is your roll number" value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
            <button type="submit" disabled={busy} className="btn-primary w-full mt-2">
              {busy ? 'Signing in…' : 'Login'}
            </button>
          </form>
          <p className="text-xs text-slate-400 mt-5 text-center">
            Note: Your default password is the same as your Roll Number.
          </p>
        </div>
        <p className="text-center text-sm text-slate-400 mt-6">
          Looking for the admin? <Link to="/admin/login" className="hover:text-slate-600">Admin login →</Link>
        </p>
      </div>
    </div>
  );
}