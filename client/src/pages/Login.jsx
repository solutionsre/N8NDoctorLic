import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useSettings } from '../SettingsContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import Icon from '../components/Icon.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const { trialDays } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const next = location.state?.from || '/dashboard';
  if (user) return <Navigate to={next} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password, remember);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to manage your licenses.">
      {location.state?.notice && <p className="alert alert-success">{location.state.notice}</p>}
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">E-mail</span>
          <span className="input-wrap">
            <Icon name="mail" className="input-icon" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
          </span>
        </label>
        <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <div className="form-row">
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Keep me logged in</span>
          </label>
          <Link to="/forgot-password" className="small">
            Forgot password?
          </Link>
        </div>
        {error && <p className="alert alert-error">{error}</p>}
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="auth-switch">
        No account yet? <Link to="/register">Create one, free for {trialDays} days</Link>
      </p>
    </AuthLayout>
  );
}
