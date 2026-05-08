import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Register from './pages/auth/Register';
import Login from './pages/auth/Login';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

import HRDashboard from './pages/hr/HRDashboard';
import Employees from './pages/hr/Employees';
import ColdCalling from './pages/hr/ColdCalling';
import LeadPipeline from './pages/hr/LeadPipeline';
import Tasks from './pages/hr/Tasks';
import Reports from './pages/hr/Reports';

const RoleRedirect = () => {
  const { user } = useAuth();
  const routes = {
    candidate: '/hr/candidate',
    company: '/hr/company',
    hr_staff: '/hr/',
    admin: '/hr/admin',
    trainer: '/hr/admin',
  };
  return <Navigate to={routes[user?.role] || '/login'} replace />;
};

export default function App() {
  return (
    <AuthProvider>

      <Routes>
        {/* Public routes */}
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Role redirect after login */}
        <Route path="/hr" element={
          <ProtectedRoute allowedRoles={['hr_staff', 'admin']}>
            <HRDashboard />
          </ProtectedRoute>
        } />
        <Route path="/hr/employees" element={
          <ProtectedRoute allowedRoles={['hr_staff', 'admin']}><Employees /></ProtectedRoute>
        } />
        <Route path="/hr/calls" element={
          <ProtectedRoute allowedRoles={['hr_staff', 'admin']}><ColdCalling /></ProtectedRoute>
        } />
        <Route path="/hr/leads" element={
          <ProtectedRoute allowedRoles={['hr_staff', 'admin']}><LeadPipeline /></ProtectedRoute>
        } />
        <Route path="/hr/tasks" element={
          <ProtectedRoute allowedRoles={['hr_staff', 'admin']}><Tasks /></ProtectedRoute>
        } />
        <Route path="/hr/reports" element={
          <ProtectedRoute allowedRoles={['hr_staff', 'admin']}><Reports /></ProtectedRoute>
        } />

        <Route path="/unauthorized" element={
          <div className="flex items-center justify-center h-screen text-xl text-red-500">
            Access Denied
          </div>
        } />
      </Routes>
    </AuthProvider>
  );
}