import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminLogin() {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await adminLogin(username.trim(), password);
      navigate('/admin/dashboard', { replace: true });
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
        <div className="card p-7 border-t-4 border-t-slate-400">
          <h1 className="text-xl font-bold text-ink mb-1">Admin Login</h1>
          <p className="text-sm text-slate-500 mb-6">Restricted area — authorized personnel only.</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="au">Username</label>
              <input id="au" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </div>
            <div>
              <label className="label" htmlFor="ap">Password</label>
              <input id="ap" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
            <button type="submit" disabled={busy} className="btn-primary w-full mt-2">{busy ? 'Signing in…' : 'Login'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}