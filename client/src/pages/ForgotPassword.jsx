import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useSettings } from '../SettingsContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import Icon from '../components/Icon.jsx';

/** Step 1: e-mail → a 6-digit code is mailed. Step 2: code + new password. */
export default function ForgotPassword() {
  const { setUser } = useAuth();
  const { auth } = useSettings();
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const sendCode = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } });
      if (step === 'code') setNotice(`A new code is on its way to ${email}.`);
      setStep('code');
      setCode('');
      setWait(auth.resendSeconds);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { user: me } = await api('/auth/reset-password', { method: 'POST', body: { email, code, password } });
      setUser(me);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (step === 'code') {
    return (
      <AuthLayout title="Enter the code" subtitle="All other devices will be logged out.">
        <div className="verify-intro">
          <span className="round-icon">
            <Icon name="mail" size={22} />
          </span>
          <p>
            If an account exists for <strong>{email}</strong>, we sent it a 6-digit code. The code works for {auth.resetMinutes} minutes. Check the
            spam folder if you can't find it.
          </p>
        </div>
        <form className="form" onSubmit={reset}>
          <input
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-label="6-digit code"
            autoFocus
            required
          />
          <PasswordInput label="New password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={auth.passwordMinLength} autoComplete="new-password" showStrength />
          <PasswordInput label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={auth.passwordMinLength} autoComplete="new-password" />
          {notice && <p className="alert alert-success">{notice}</p>}
          {error && <p className="alert alert-error">{error}</p>}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy || code.length !== 6}>
            {busy ? 'Saving…' : 'Save new password'}
          </button>
          <button type="button" className="btn btn-link" onClick={() => sendCode()} disabled={busy || wait > 0}>
            {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
          </button>
        </form>
        <p className="auth-switch">
          Wrong e-mail?{' '}
          <button type="button" className="btn btn-link" onClick={() => { setStep('email'); setError(''); setNotice(''); }}>
            Change it
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your account e-mail and we will send you a 6-digit code to reset it.">
      <form className="form" onSubmit={sendCode}>
        <label className="field">
          <span className="field-label">E-mail</span>
          <span className="input-wrap">
            <Icon name="mail" className="input-icon" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
          </span>
        </label>
        {error && <p className="alert alert-error">{error}</p>}
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Sending…' : 'Send code'}
        </button>
      </form>
      <p className="auth-switch">
        Remembered it? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
