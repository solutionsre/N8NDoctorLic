import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDate } from '../../api.js';
import { useAuth } from '../../AuthContext.jsx';
import { useSettings } from '../../SettingsContext.jsx';
import Icon from '../../components/Icon.jsx';
import LicenseActions from './LicenseActions.jsx';
import { adminAction, LicenseStatus, Loading, money, PaymentStatus, RoleBadge, useAdmin } from './common.jsx';

function GrantLicense({ userId, onDone }) {
  const { plans, trialDays } = useSettings();
  const options = [...plans.map((p) => [p.id, p.name, p.days]), ['trial', 'Free trial', trialDays]];
  const [plan, setPlan] = useState(options[0][0]);
  const [days, setDays] = useState(String(options[0][2]));
  const [machineId, setMachineId] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const pick = (id) => {
    setPlan(id);
    setDays(String(options.find((o) => o[0] === id)[2]));
  };

  return (
    <form
      className="grant"
      onSubmit={(e) => {
        e.preventDefault();
        adminAction(`/admin/users/${userId}/licenses`, {
          body: { plan, days: Number(days), machineId },
          confirm: `Give this user a ${options.find((o) => o[0] === plan)[1]} license for ${days} days, without payment?`,
          setBusy,
          setError,
          onDone,
        });
      }}
    >
      <select className="select" value={plan} onChange={(e) => pick(e.target.value)} aria-label="Plan">
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      <input className="input" value={machineId} onChange={(e) => setMachineId(e.target.value)} placeholder="Machine ID" aria-label="Machine ID" required style={{ minWidth: 260, fontFamily: 'monospace' }} />
      <label className="inline-field">
        <input type="number" min="1" max="3650" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Days" required />
        <span>days</span>
      </label>
      <button className="btn btn-primary btn-sm" disabled={!!busy}>
        <Icon name="plus" /> Give license
      </button>
      {error && <p className="alert alert-error">{error}</p>}
    </form>
  );
}

export default function UserDetail() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const { data, error, reload } = useAdmin(`/admin/users/${id}`);
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');

  if (!data) return <Loading error={error} />;
  const { user: u, licenses, payments, trialMachines } = data;
  const isMe = u.id === me.id;
  const isSuper = me.role === 'superadmin';
  const canManage = !isMe && (isSuper || u.role === 'user');
  const run = (path, opts = {}) => adminAction(`/admin/users/${u.id}/${path}`, { setBusy, setError: setActionError, onDone: reload, ...opts });
  const trials = licenses.filter((l) => l.isTrial);

  const block = () => {
    const reason = window.prompt(`Block ${u.email}? They are logged out, cannot log in, and they get no new keys.\n\nReason (optional):`, '');
    if (reason !== null) run('block', { body: { reason } });
  };

  return (
    <>
      <p className="crumbs">
        <Link to="/admin/users">← Users</Link>
      </p>
      <header className="page-head">
        <div>
          <p className="eyebrow">User</p>
          <h1>{u.name}</h1>
          <p className="muted">
            {u.email} <RoleBadge role={u.role} />
            {u.blocked ? <span className="badge bad">Blocked</span> : <span className="badge good">Active</span>}
            {!u.emailVerified && <span className="badge warn">E-mail not confirmed</span>}
          </p>
        </div>
      </header>

      {u.blocked && (
        <p className="alert alert-error">
          <Icon name="ban" /> Blocked {u.blockedAt ? `on ${formatDate(u.blockedAt)}` : ''}
          {u.blockedReason ? `: ${u.blockedReason}` : ''}.
        </p>
      )}
      {actionError && <p className="alert alert-error">{actionError}</p>}

      <div className="admin-cols">
        <div>
          <div className="card">
            <dl className="facts">
              <div>
                <dt>Joined</dt>
                <dd>{formatDate(u.createdAt)}</dd>
              </div>
              <div>
                <dt>Last log in</dt>
                <dd>{u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}</dd>
              </div>
              <div>
                <dt>Free trial</dt>
                <dd>{u.trialUsed ? 'Used' : 'Not used'}</dd>
              </div>
              <div>
                <dt>Trial machines</dt>
                <dd>{trialMachines.length ? trialMachines.map((t) => t.machineId.slice(0, 14) + '…').join(', ') : '—'}</dd>
              </div>
            </dl>
          </div>

          <h2 className="section-title">Licenses ({licenses.length})</h2>
          {licenses.length === 0 ? (
            <div className="card empty">No licenses.</div>
          ) : (
            <div className="licenses">
              {licenses.map((l) => (
                <article key={l.id} className={`card license ${l.status !== 'active' ? 'is-off' : l.expiringSoon ? 'is-warn' : ''}`}>
                  <div className="license-head">
                    <div>
                      <h3>{l.planName}</h3>
                      <LicenseStatus lic={l} />
                    </div>
                    <code className="key-plain">{l.key}</code>
                  </div>
                  <dl className="facts">
                    <div>
                      <dt>Expires</dt>
                      <dd>
                        {formatDate(l.expiresAt)}
                        {l.status === 'active' && <small> · {l.daysLeft} day(s) left</small>}
                      </dd>
                    </div>
                    <div>
                      <dt>Machine ID</dt>
                      <dd><code className="domain" style={{ fontSize: 11, wordBreak: 'break-all' }}>{l.machineId}</code></dd>
                    </div>
                    <div>
                      <dt>Key last downloaded</dt>
                      <dd>
                        {l.lastDownloadAt ? formatDate(l.lastDownloadAt) : 'Never'}
                      </dd>
                    </div>
                  </dl>
                  {l.blockedReason && <p className="hint">Block reason: {l.blockedReason}</p>}
                  <LicenseActions lic={l} onDone={reload} />
                  {l.history.length > 0 && (
                    <details className="history">
                      <summary>History</summary>
                      <ul>
                        {l.history.map((h, i) => (
                          <li key={i}>
                            <small>{formatDate(h.at)}</small> <strong>{h.type}</strong> {h.note}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}

          <h2 className="section-title">Payments ({payments.length})</h2>
          {payments.length === 0 ? (
            <div className="card empty">No payments.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Plan</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Order</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.createdAt)}</td>
                      <td>
                        {p.plan} <small className="muted">{p.isRenewal ? 'renewal' : 'new'}</small>
                      </td>
                      <td>{p.gatewayName}</td>
                      <td className="num">{money(p.amount)}</td>
                      <td>
                        <PaymentStatus p={p} />
                      </td>
                      <td>
                        <code className="small">{p.orderId.slice(0, 8)}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside>
          <h2 className="section-title">Account</h2>
          <div className="card action-list">
            {canManage ? (
              u.blocked ? (
                <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => run('unblock', { confirm: `Unblock ${u.email}?` })}>
                  Unblock account
                </button>
              ) : (
                <button type="button" className="btn btn-danger" disabled={!!busy} onClick={block}>
                  <Icon name="ban" /> Block account
                </button>
              )
            ) : (
              <p className="muted small">{isMe ? 'This is your own account.' : 'Only a super admin can manage another admin.'}</p>
            )}
            {!u.emailVerified && (
              <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => run('verify', { confirm: `Mark ${u.email} as confirmed?` })}>
                Mark e-mail confirmed
              </button>
            )}
            {u.lockedUntil && (
              <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => run('unlock')}>
                End password lock
              </button>
            )}
            {isSuper && !isMe && (
              <label className="field">
                <span className="field-label">Role</span>
                <select
                  className="select"
                  value={u.role}
                  disabled={!!busy}
                  onChange={(e) => run('role', { body: { role: e.target.value }, confirm: `Change ${u.email}'s role to ${e.target.value}?` })}
                >
                  <option value="user">Customer</option>
                  <option value="admin">Admin (users, licenses, payments)</option>
                  <option value="superadmin">Super admin (everything + settings)</option>
                </select>
              </label>
            )}
          </div>

          <h2 className="section-title">Free trial</h2>
          <div className="card action-list">
            <p className="muted small">
              {trials.length ? `${trials.length} trial license(s).` : 'No trial license.'} {u.trialUsed ? 'The trial is used up.' : 'They can still start a trial.'}
            </p>
            <button
              type="button"
              className="btn btn-danger"
              disabled={!!busy || !trials.length}
              onClick={() =>
                run('trial/remove', {
                  body: { allowNew: false },
                  confirm: `Remove ${u.email}'s trial? They cannot start another trial.`,
                })
              }
            >
              Remove trial
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!!busy || (!trials.length && !u.trialUsed)}
              onClick={() =>
                run('trial/remove', {
                  body: { allowNew: true },
                  confirm: `Remove ${u.email}'s trial and let them (and that machine) start a new one?`,
                })
              }
            >
              Reset trial (allow a new one)
            </button>
          </div>

          <h2 className="section-title">Give a license</h2>
          <div className="card">
            <p className="muted small">Free of charge, e.g. for a partner or to fix a failed payment.</p>
            <GrantLicense userId={u.id} onDone={reload} />
          </div>
        </aside>
      </div>
    </>
  );
}
