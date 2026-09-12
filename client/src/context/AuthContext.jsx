import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { request, getStudentToken, getAdminToken, setStudentToken, setAdminToken, clearToken, setOnUnauthorized } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [role, setRole] = useState(null); // 'student' | 'admin' | null
  const [student, setStudent] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setOnUnauthorized(() => {
      clearToken();
      setRole(null);
      setStudent(null);
      setAdmin(null);
    });

    (async () => {
      // The URL path decides which role owns this tab. Refreshing a student
      // page must never log us in as admin (and vice versa), so we only probe
      // the token that matches this path — no cross-role fallback.
      const isAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
      const expectedRole = isAdminPath ? 'admin' : 'student';
      const token = isAdminPath ? getAdminToken() : getStudentToken();
      let nextRole = null;
      if (token) {
        const tryProbe = async () => {
          try {
            const me = await request(`/auth/${expectedRole}/me`, 'GET', null, { token });
            nextRole = expectedRole;
            if (alive) {
              if (expectedRole === 'student') setStudent(me.student);
              else setAdmin({ username: me.admin.username });
            }
          } catch (_) { /* invalid or expired */ }
        };
        await tryProbe();
      }
      if (alive) {
        setRole(nextRole);
        setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, []);

  const studentLogin = useCallback(async (roll_number, password) => {
    const data = await request('/auth/student/login', 'POST', { roll_number, password });
    setStudentToken(data.token);
    setRole('student');
    setStudent(data.student);
    setAdmin(null);
    return data.student;
  }, []);

  const adminLogin = useCallback(async (username, password) => {
    const data = await request('/auth/admin/login', 'POST', { username, password });
    setAdminToken(data.token);
    setRole('admin');
    setAdmin({ username: data.admin.username });
    setStudent(null);
    return data.admin;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setRole(null);
    setStudent(null);
    setAdmin(null);
  }, []);

  return (
    <AuthContext.Provider value={{ role, student, admin, loading, studentLogin, adminLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}