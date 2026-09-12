import { Routes, Route, Navigate } from 'react-router-dom';
import EliteFooter from './components/EliteFooter.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import StudentLogin from './pages/student/StudentLogin.jsx';
import StudentDashboard from './pages/student/StudentDashboard.jsx';
import StudentTest from './pages/student/StudentTest.jsx';
import StudentResult from './pages/student/StudentResult.jsx';

import AdminLogin from './pages/admin/AdminLogin.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminStudents from './pages/admin/AdminStudents.jsx';
import AdminQuestions from './pages/admin/AdminQuestions.jsx';
import AdminLeaderboards from './pages/admin/AdminLeaderboards.jsx';
import AdminAttempts from './pages/admin/AdminAttempts.jsx';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/student/login" replace />} />
        <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
        <Route path="/student/login" element={<StudentLogin />} />
        <Route path="/student/dashboard" element={<ProtectedRoute expectedRole="student"><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/test/:testId" element={<ProtectedRoute expectedRole="student"><StudentTest /></ProtectedRoute>} />
        <Route path="/student/result/:testId" element={<ProtectedRoute expectedRole="student"><StudentResult /></ProtectedRoute>} />

        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<ProtectedRoute expectedRole="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/students" element={<ProtectedRoute expectedRole="admin"><AdminStudents /></ProtectedRoute>} />
        <Route path="/admin/questions" element={<ProtectedRoute expectedRole="admin"><AdminQuestions /></ProtectedRoute>} />
        <Route path="/admin/questions/:testId" element={<ProtectedRoute expectedRole="admin"><AdminQuestions /></ProtectedRoute>} />
        <Route path="/admin/leaderboards" element={<ProtectedRoute expectedRole="admin"><AdminLeaderboards /></ProtectedRoute>} />
        <Route path="/admin/attempts" element={<ProtectedRoute expectedRole="admin"><AdminAttempts /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <EliteFooter />
    </>
  );
}