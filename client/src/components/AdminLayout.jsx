import { NavLink, Link } from 'react-router-dom';
import { Logo } from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const links = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/students', label: 'Students' },
  { to: '/admin/questions', label: 'Questions' },
  { to: '/admin/leaderboards', label: 'Leaderboards' },
  { to: '/admin/attempts', label: 'Attempts' },
];

export default function AdminLayout({ children, title, subtitle }) {
  const { logout, admin } = useAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/admin/dashboard"><Logo size="sm" /></Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <div className="mx-2 h-6 w-px bg-slate-200" />
            <span className="text-xs text-slate-400 hidden sm:block">{admin && admin.username}</span>
            <button className="btn-outline px-3 py-1.5 ml-1" onClick={logout}>Logout</button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {title && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-ink tracking-tight">{title}</h1>
            {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}