import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { SettingsProvider } from './SettingsContext.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Account from './pages/Account.jsx';
import PaymentResult from './pages/PaymentResult.jsx';
import Legal from './pages/Legal.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminOverview from './pages/admin/Overview.jsx';
import AdminUsers from './pages/admin/Users.jsx';
import AdminUserDetail from './pages/admin/UserDetail.jsx';
import AdminLicenses from './pages/admin/Licenses.jsx';
import AdminPayments from './pages/admin/Payments.jsx';
import AdminSettings from './pages/admin/Settings.jsx';
import AdminLog from './pages/admin/Log.jsx';
import './styles.css';

function Loading() {
  return (
    <div className="page-loading">
      <span className="spinner" />
    </div>
  );
}

function Private({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

/** Admin pages: admins and super admins; `superOnly` pages: super admins. */
function AdminOnly({ children, superOnly = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  const ok = superOnly ? user.role === 'superadmin' : user.role === 'admin' || user.role === 'superadmin';
  return ok ? children : <Navigate to="/dashboard" replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SettingsProvider>
      <BrowserRouter>
        <AuthProvider>
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<Navigate to="/forgot-password" replace />} />
              <Route path="/verify-email" element={<Private><VerifyEmail /></Private>} />
              <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
              <Route path="/account" element={<Private><Account /></Private>} />
              <Route path="/payment/result" element={<PaymentResult />} />
              <Route path="/legal/:page" element={<Legal />} />
              <Route path="/admin" element={<AdminOnly><AdminLayout /></AdminOnly>}>
                <Route index element={<AdminOverview />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:id" element={<AdminUserDetail />} />
                <Route path="licenses" element={<AdminLicenses />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="log" element={<AdminLog />} />
                <Route path="settings" element={<AdminOnly superOnly><AdminSettings /></AdminOnly>} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </AuthProvider>
      </BrowserRouter>
    </SettingsProvider>
  </React.StrictMode>
);
