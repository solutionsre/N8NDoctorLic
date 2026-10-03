import { useCallback, useEffect, useState } from 'react';
import { api, formatDate, npr } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useSettings } from '../SettingsContext.jsx';
import LicenseCard from '../components/LicenseCard.jsx';
import CheckoutForm from '../components/CheckoutForm.jsx';
import VerifyEmailForm from '../components/VerifyEmailForm.jsx';
import Icon from '../components/Icon.jsx';
import MachineIdField, { MACHINE_RE, cleanMachineId } from '../components/MachineIdField.jsx';

function Stat({ icon, label, value, note, tone = '' }) {
  return (
    <div className={`stat ${tone}`}>
      <span className="stat-icon">
        <Icon name={icon} />
      </span>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {note && <p className="stat-note">{note}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user: me, refresh: refreshUser } = useAuth();
  const rules = useSettings();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialMachine, setTrialMachine] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api('/licenses'));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startTrial = async () => {
    setTrialBusy(true);
    setError('');
    try {
      await api('/licenses/trial', { method: 'POST', body: { machineId: cleanMachineId(trialMachine) } });
      await Promise.all([load(), refreshUser()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setTrialBusy(false);
    }
  };

  if (!data) {
    return (
      <section className="container page">
        {error ? <p className="alert alert-error">{error}</p> : <div className="skeleton-grid"><div /><div /><div /></div>}
      </section>
    );
  }

  const { licenses, payments } = data;
  const verified = me.emailVerified;
  const active = licenses.filter((l) => l.status === 'active');
  const soon = licenses.filter((l) => l.expiringSoon);
  const nearest = active.reduce((min, l) => (min === null || l.daysLeft < min ? l.daysLeft : min), null);

  return (
    <section className="container page dashboard">
      <header className="page-head">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Hello, {me.name.split(' ')[0]}</h1>
          <p className="muted">{me.email}</p>
        </div>
        {!buying && (
          <button type="button" className="btn btn-primary" onClick={() => setBuying(true)} disabled={!verified} title={verified ? '' : 'Confirm your e-mail first'}>
            <Icon name="plus" /> Buy a license
          </button>
        )}
      </header>

      {!verified && (
        <div className="card callout callout-warn">
          <div className="callout-text">
            <span className="round-icon warn">
              <Icon name="mail" size={20} />
            </span>
            <div>
              <h2>Confirm your e-mail</h2>
              <p className="muted">
                Enter the 6-digit code we sent to <strong>{me.email}</strong>. You need it before starting the trial or paying.
              </p>
            </div>
          </div>
          <VerifyEmailForm compact onDone={load} />
        </div>
      )}

      <div className="stats">
        <Stat icon="key" label="Active licenses" value={active.length} note={`${licenses.length} in total`} />
        <Stat icon="globe" label="Machines" value={new Set(licenses.map((l) => l.machineId)).size} note="One license per machine" />
        <Stat
          icon="clock"
          label="Next expiry"
          value={nearest === null ? '—' : `${nearest} day${nearest === 1 ? '' : 's'}`}
          note={soon.length ? 'Renew soon to avoid a pause' : 'All good'}
          tone={soon.length ? 'warn' : ''}
        />
      </div>

      {error && <p className="alert alert-error">{error}</p>}
      {soon.length > 0 && (
        <p className="alert alert-warn">
          <Icon name="alert" /> {soon.length === 1 ? 'One license expires' : `${soon.length} licenses expire`} within {rules.extendWindowDays} days.
        </p>
      )}

      {buying && (
        <div className="card">
          <h2>Buy a new license</h2>
          <p className="muted">A new license is for one more computer (you will enter its Machine ID). To add time to an existing license, use Renew on it instead.</p>
          <CheckoutForm plans={rules.plans} onCancel={() => setBuying(false)} />
        </div>
      )}

      {verified && !me.trialUsed && (
        <div className="card callout callout-trial">
          <div className="callout-text">
            <span className="round-icon">
              <Icon name="bolt" size={20} />
            </span>
            <div>
              <h2>Try it free for {rules.trialDays} days</h2>
              <p className="muted">Every feature, no payment. One trial per account and per machine; trials cannot be extended.</p>
            </div>
          </div>
          <div style={{ width: '100%', marginTop: 12 }}>
            <MachineIdField value={trialMachine} onChange={setTrialMachine} />
            <button type="button" className="btn btn-primary" onClick={startTrial} disabled={trialBusy || !MACHINE_RE.test(cleanMachineId(trialMachine))}>
              {trialBusy ? 'Starting…' : 'Start free trial'}
            </button>
          </div>
        </div>
      )}

      <div className="dash-grid">
        <div>
          <h2 className="section-title">Your licenses</h2>
          {licenses.length === 0 ? (
            <div className="card empty">
              <Icon name="key" size={28} />
              <p>No licenses yet. Start the free trial or buy a plan.</p>
            </div>
          ) : (
            <div className="licenses">
              {licenses.map((l) => (
                <LicenseCard key={l.id} license={l} plans={rules.plans} rules={rules} onChange={load} />
              ))}
            </div>
          )}
        </div>

        <aside>
          <h2 className="section-title">Activate n8n Doctor</h2>
          <div className="card steps">
            <ol>
              <li>
                <strong>Get your Machine ID</strong>
                <span>In n8n Doctor: License Manager → Machine Information → Copy Machine ID.</span>
              </li>
              <li>
                <strong>Start a trial or buy a plan</strong>
                <span>Paste the Machine ID. The license is made for that computer only.</span>
              </li>
              <li>
                <strong>Paste the key</strong>
                <span>Copy the key (or download the .lic file) into License Manager → Activate License. After a renewal or extension, paste the new key into Renew License.</span>
              </li>
            </ol>
          </div>
        </aside>
      </div>

      <h2 className="section-title">Payments</h2>
      {payments.length === 0 ? (
        <div className="card empty">
          <Icon name="card" size={28} />
          <p>No payments yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Plan</th>
                <th>Type</th>
                <th>Paid with</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.createdAt)}</td>
                  <td>{p.plan}</td>
                  <td>{p.isRenewal ? 'Renewal' : 'New license'}</td>
                  <td>{p.gatewayName}</td>
                  <td className="num">{npr(p.amount)}</td>
                  <td>
                    <span className={`badge ${p.status === 'completed' ? 'good' : 'bad'}`}>{p.status}</span>
                    {p.mode === 'test' && <span className="badge warn">Test</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
