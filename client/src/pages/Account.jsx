import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatDate } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useSettings } from '../SettingsContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import VerifyEmailForm from '../components/VerifyEmailForm.jsx';
import Icon from '../components/Icon.jsx';

function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [msg, setMsg] = useState(['', '']);
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(['', '']);
    try {
      const { user: me } = await api('/auth/profile', { method: 'PATCH', body: { name } });
      setUser(me);
      setMsg(['success', 'Saved.']);
    } catch (err) {
      setMsg(['error', err.message]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card settings-card">
      <div className="settings-head">
        <Icon name="user" />
        <div>
          <h2>Profile</h2>
          <p className="muted small">Your name appears on receipts and e-mails.</p>
        </div>
      </div>
      <form className="form" onSubmit={save}>
        <label className="field">
          <span className="field-label">Full name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        </label>
        <div className="field">
          <span className="field-label">E-mail</span>
          <div className="readonly">
            {user.email}
            {user.emailVerified ? <span className="badge good">Confirmed</span> : <span className="badge warn">Not confirmed</span>}
          </div>
        </div>
        {msg[1] && <p className={`alert alert-${msg[0]}`}>{msg[1]}</p>}
        <div>
          <button className="btn btn-primary" disabled={busy || name.trim() === user.name}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
      {!user.emailVerified && (
        <div className="subcard">
          <p className="small">
            Enter the 6-digit code we sent to <strong>{user.email}</strong>.
          </p>
          <VerifyEmailForm compact />
        </div>
      )}
    </div>
  );
}

function ChangePassword() {
  const { setUser } = useAuth();
  const { auth } = useSettings();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setMsg(['error', 'The new passwords do not match.']);
      return;
    }
    setBusy(true);
    setMsg(['', '']);
    try {
      const { user } = await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      setUser(user);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setMsg(['success', 'Password changed. Other devices were logged out.']);
    } catch (err) {
      setMsg(['error', err.message]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card settings-card">
      <div className="settings-head">
        <Icon name="lock" />
        <div>
          <h2>Password</h2>
          <p className="muted small">Used to log in to this website.</p>
        </div>
      </div>
      <form className="form" onSubmit={save}>
        <PasswordInput label="Current password" value={form.currentPassword} onChange={set('currentPassword')} required />
        <PasswordInput label="New password" value={form.newPassword} onChange={set('newPassword')} required minLength={auth.passwordMinLength} autoComplete="new-password" showStrength />
        <PasswordInput label="Confirm new password" value={form.confirm} onChange={set('confirm')} required minLength={auth.passwordMinLength} autoComplete="new-password" />
        {msg[1] && <p className={`alert alert-${msg[0]}`}>{msg[1]}</p>}
        <div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Security() {
  const { user, logoutAll } = useAuth();
  const { auth } = useSettings();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const signOutEverywhere = async () => {
    if (!window.confirm('Log out on every device, including this one?')) return;
    setBusy(true);
    await logoutAll();
    navigate('/login', { state: { notice: 'You were logged out on every device.' } });
  };

  return (
    <div className="card settings-card">
      <div className="settings-head">
        <Icon name="shield" />
        <div>
          <h2>Security</h2>
          <p className="muted small">Sessions and sign-in activity.</p>
        </div>
      </div>
      <dl className="facts">
        <div>
          <dt>Member since</dt>
          <dd>{formatDate(user.createdAt)}</dd>
        </div>
        <div>
          <dt>Last log in</dt>
          <dd>{user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'}</dd>
        </div>
        <div>
          <dt>Password changed</dt>
          <dd>{user.passwordChangedAt ? formatDate(user.passwordChangedAt) : 'Never'}</dd>
        </div>
      </dl>
      <ul className="security-list">
        <li>
          <Icon name="check" /> {auth.maxFailedLogins} wrong passwords in a row lock the account for {auth.lockMinutes} minutes.
        </li>
        <li>
          <Icon name="check" /> We e-mail you whenever your password changes.
        </li>
      </ul>
      <div className="danger-zone">
        <div>
          <strong>Log out everywhere</strong>
          <p className="muted small">Ends every website session. Use it if you logged in on a shared computer.</p>
        </div>
        <button type="button" className="btn btn-danger" onClick={signOutEverywhere} disabled={busy}>
          <Icon name="logout" /> Log out all devices
        </button>
      </div>
    </div>
  );
}

export default function Account() {
  return (
    <section className="container page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Account & security</h1>
        </div>
      </header>
      <div className="settings-grid">
        <Profile />
        <ChangePassword />
        <Security />
      </div>
    </section>
  );
}
