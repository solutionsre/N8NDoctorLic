import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useSettings } from '../SettingsContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import Icon from '../components/Icon.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const { auth } = useSettings();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.emailVerified ? '/dashboard' : '/verify-email'} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await register(form.name, form.email, form.password);
      navigate('/verify-email', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const mismatch = form.confirm && form.password !== form.confirm;

  return (
    <AuthLayout title="Create your account">
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Full name</span>
          <span className="input-wrap">
            <Icon name="user" className="input-icon" />
            <input value={form.name} onChange={set('name')} required autoComplete="name" autoFocus maxLength={100} />
          </span>
        </label>
        <label className="field">
          <span className="field-label">E-mail</span>
          <span className="input-wrap">
            <Icon name="mail" className="input-icon" />
            <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
          </span>
        </label>
        <PasswordInput label="Password" value={form.password} onChange={set('password')} required minLength={auth.passwordMinLength} autoComplete="new-password" showStrength />
        <PasswordInput label="Confirm password" value={form.confirm} onChange={set('confirm')} required minLength={auth.passwordMinLength} autoComplete="new-password" aria-invalid={mismatch || undefined} />
        {mismatch && <small className="field-error">The passwords do not match.</small>}
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
          <span>I agree that one license key works on one computer.</span>
        </label>
        {error && <p className="alert alert-error">{error}</p>}
        <button className="btn btn-primary btn-block btn-lg" disabled={busy || !agree}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="muted small center">We will e-mail you a 6-digit code to confirm the address.</p>
      </form>
      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
