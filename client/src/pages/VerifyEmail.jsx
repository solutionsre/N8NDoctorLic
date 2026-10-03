import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useSettings } from '../SettingsContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import VerifyEmailForm from '../components/VerifyEmailForm.jsx';
import Icon from '../components/Icon.jsx';

export default function VerifyEmail() {
  const { user } = useAuth();
  const { auth } = useSettings();
  const navigate = useNavigate();

  if (user.emailVerified) return <Navigate to="/dashboard" replace />;

  return (
    <AuthLayout title="Check your inbox">
      <div className="verify-intro">
        <span className="round-icon">
          <Icon name="mail" size={22} />
        </span>
        <p>
          We sent a 6-digit code to <strong>{user.email}</strong>. Enter it below to confirm your address. The code works for
          {auth.codeMinutes} minutes. Check the spam folder if you can't find it.
        </p>
      </div>
      <VerifyEmailForm onDone={() => navigate('/dashboard', { replace: true })} />
      <p className="auth-switch">
        You can look around first: <Link to="/dashboard">go to the dashboard</Link>. Starting a trial and paying
        need a confirmed e-mail.
      </p>
    </AuthLayout>
  );
}
