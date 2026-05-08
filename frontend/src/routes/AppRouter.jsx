import { Routes, Route, Navigate } from 'react-router-dom';

const Placeholder = ({ title }) => (
  <div className="flex h-screen items-center justify-center text-2xl font-bold text-gray-500">
    {title} — Coming Soon
  </div>
);

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login"    element={<Placeholder title="Login" />} />
      <Route path="/register" element={<Placeholder title="Register" />} />
      <Route path="*"         element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
