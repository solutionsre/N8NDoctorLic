import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useSettings } from '../SettingsContext.jsx';

/** 6-digit code entry with a resend button (cooldown from the server settings). */
export default function VerifyEmailForm({ onDone, compact = false }) {
  const { user, setUser } = useAuth();
  const { auth } = useSettings();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user: me } = await api('/auth/verify-email', { method: 'POST', body: { code } });
      setUser(me);
      onDone?.();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setNotice('');
    try {
      await api('/auth/resend-verification', { method: 'POST' });
      setNotice(`A new code is on its way to ${user.email}.`);
      setCode('');
      setWait(auth.resendSeconds);
    } catch (err) {
      setError(err.message);
      const secs = Number(/(\d+) seconds/.exec(err.message)?.[1]);
      if (secs) setWait(secs);
    }
  };

  return (
    <form className={`form verify ${compact ? 'is-compact' : ''}`} onSubmit={submit}>
      <input
        className="code-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-label="6-digit code"
        autoFocus={!compact}
        required
      />
      <button className="btn btn-primary" disabled={busy || code.length !== 6}>
        {busy ? 'Checking…' : 'Confirm e-mail'}
      </button>
      <button type="button" className="btn btn-link" onClick={resend} disabled={wait > 0}>
        {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
      </button>
      {notice && <p className="alert alert-success">{notice}</p>}
      {error && <p className="alert alert-error">{error}</p>}
    </form>
  );
}
