import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../AuthContext.jsx';
import { useSettings } from '../../SettingsContext.jsx';
import Icon from '../../components/Icon.jsx';
import { Loading, useAdmin, useFilters } from './common.jsx';

const TABS = [
  ['pricing', 'Pricing & rules'],
  ['payments', 'Payments'],
  ['smtp', 'E-mail (SMTP)'],
  ['site', 'Site & footer'],
  ['legal', 'Legal pages'],
];

/** Save button + result message shared by every settings form. */
function useSave(section, onSaved) {
  const { reload } = useSettings();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(['', '']);
  const save = async (body) => {
    setBusy(true);
    setMsg(['', '']);
    try {
      const fresh = await api(`/admin/settings/${section}`, { method: 'PUT', body });
      onSaved(fresh);
      await reload(); // The public site (prices, footer …) updates right away.
      setMsg(['success', 'Saved. The website uses the new settings now.']);
    } catch (err) {
      setMsg(['error', err.message]);
    } finally {
      setBusy(false);
    }
  };
  const message = msg[1] ? <p className={`alert alert-${msg[0]}`}>{msg[1]}</p> : null;
  return [save, busy, message];
}

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

/** Secret input: never shows the saved value. Blank = keep it; "Remove" clears it. */
function SecretField({ label, isSet, value, onChange, cleared, onClear }) {
  return (
    <Field label={label} hint={cleared ? 'Will be removed when you save.' : isSet ? 'Saved. Leave blank to keep it.' : 'Not set.'}>
      <div className="secret-row">
        <input type="password" autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} placeholder={isSet ? '••••••••  (saved)' : ''} disabled={cleared} />
        {isSet && (
          <label className="check small">
            <input type="checkbox" checked={cleared} onChange={(e) => onClear(e.target.checked)} /> Remove
          </label>
        )}
      </div>
    </Field>
  );
}

/* --------------------------------- Pricing -------------------------------- */

function PricingForm({ s, onSaved }) {
  const [plans, setPlans] = useState(s.plans);
  const [rules, setRules] = useState({ ...s.rules, reminderDays: s.rules.reminderDays.join(', ') });
  const [savePlans, busyP, msgP] = useSave('plans', onSaved);
  const [saveRules, busyR, msgR] = useSave('rules', onSaved);
  const setPlan = (id, k, v) => setPlans({ ...plans, [id]: { ...plans[id], [k]: v } });
  const perDay = (p) => (p.days > 0 ? Math.round(p.price / p.days) : 0);

  return (
    <>
      <form
        className="card form"
        onSubmit={(e) => {
          e.preventDefault();
          savePlans(plans);
        }}
      >
        <div>
          <h2>Plans and prices</h2>
          <p className="muted small">Shown on the home page and at checkout. Existing licenses keep the time they paid for.</p>
        </div>
        <div className="plan-editor">
          {Object.values(plans).map((p) => (
            <fieldset key={p.id} className={`plan-edit ${p.enabled ? '' : 'is-off'}`}>
              <legend>
                <label className="check">
                  <input type="checkbox" checked={p.enabled} onChange={(e) => setPlan(p.id, 'enabled', e.target.checked)} /> On sale
                </label>
              </legend>
              <Field label="Name">
                <input value={p.name} onChange={(e) => setPlan(p.id, 'name', e.target.value)} maxLength={40} required />
              </Field>
              <div className="two">
                <Field label="Price (NPR)">
                  <input type="number" min="1" value={p.price} onChange={(e) => setPlan(p.id, 'price', Number(e.target.value))} required />
                </Field>
                <Field label="Days">
                  <input type="number" min="1" max="3650" value={p.days} onChange={(e) => setPlan(p.id, 'days', Number(e.target.value))} required />
                </Field>
              </div>
              <small className="muted">≈ Rs. {perDay(p)} per day</small>
            </fieldset>
          ))}
        </div>
        {msgP}
        <div>
          <button className="btn btn-primary" disabled={busyP}>
            {busyP ? 'Saving…' : 'Save prices'}
          </button>
        </div>
      </form>

      <form
        className="card form"
        onSubmit={(e) => {
          e.preventDefault();
          saveRules(rules);
        }}
      >
        <div>
          <h2>Trial, extension and reminders</h2>
        </div>
        <div className="three">
          <Field label="Free trial (days)">
            <input type="number" min="1" max="365" value={rules.trialDays} onChange={(e) => setRules({ ...rules, trialDays: Number(e.target.value) })} required />
          </Field>
          <Field label="Extension (days)" hint="Paid licenses, once per period.">
            <input type="number" min="1" max="30" value={rules.extendDays} onChange={(e) => setRules({ ...rules, extendDays: Number(e.target.value) })} required />
          </Field>
          <Field label="Extension window (days)" hint="Button shows this many days before expiry.">
            <input type="number" min="1" max="60" value={rules.extendWindowDays} onChange={(e) => setRules({ ...rules, extendWindowDays: Number(e.target.value) })} required />
          </Field>
        </div>
        <Field label="Reminder e-mails (days before expiry)" hint="Comma separated, e.g. 7, 3, 1">
          <input value={rules.reminderDays} onChange={(e) => setRules({ ...rules, reminderDays: e.target.value })} required />
        </Field>
        <label className="check">
          <input type="checkbox" checked={rules.extensionDeducted} onChange={(e) => setRules({ ...rules, extensionDeducted: e.target.checked })} />
          <span>Take the extension days back at the next renewal (off = free bonus days)</span>
        </label>
        {msgR}
        <div>
          <button className="btn btn-primary" disabled={busyR}>
            {busyR ? 'Saving…' : 'Save rules'}
          </button>
        </div>
      </form>
    </>
  );
}

/* -------------------------------- Payments -------------------------------- */

function PaymentsForm({ s, onSaved }) {
  const p = s.payments;
  const blank = { khaltiTest: '', khaltiLive: '', esewaTest: '', esewaLive: '' };
  const [mode, setMode] = useState(p.mode);
  const [khaltiOn, setKhaltiOn] = useState(p.khalti.enabled);
  const [esewaOn, setEsewaOn] = useState(p.esewa.enabled);
  const [codes, setCodes] = useState({ test: p.esewa.testProductCode, live: p.esewa.liveProductCode });
  const [keys, setKeys] = useState(blank);
  const [clear, setClear] = useState({});
  const [save, busy, msg] = useSave('payments', (fresh) => {
    setKeys(blank);
    setClear({});
    onSaved(fresh);
  });
  const secret = (name) => (clear[name] ? null : keys[name] || undefined);

  const submit = (e) => {
    e.preventDefault();
    if (mode === 'live' && p.mode !== 'live' && !window.confirm('Switch to LIVE payments? Customers will pay real money from now on.')) return;
    save({
      mode,
      khalti: { enabled: khaltiOn, testKey: secret('khaltiTest'), liveKey: secret('khaltiLive') },
      esewa: { enabled: esewaOn, testProductCode: codes.test, testSecret: secret('esewaTest'), liveProductCode: codes.live, liveSecret: secret('esewaLive') },
    });
  };
  const sf = (name, label, isSet) => (
    <SecretField
      label={label}
      isSet={isSet}
      value={keys[name]}
      onChange={(v) => setKeys({ ...keys, [name]: v })}
      cleared={!!clear[name]}
      onClear={(v) => setClear({ ...clear, [name]: v })}
    />
  );

  return (
    <form className="card form" onSubmit={submit}>
      <div>
        <h2>Payment mode</h2>
        <p className="muted small">Test uses the gateways' sandboxes: test wallets, no real money. Switch to live when you are ready to sell.</p>
      </div>
      <div className="choice-row">
        {[
          ['test', 'Test (sandbox)', 'Try payments with test wallets'],
          ['live', 'Live', 'Real money into your merchant account'],
        ].map(([id, title, note]) => (
          <label key={id} className={`choice ${mode === id ? 'is-on' : ''}`}>
            <input type="radio" name="mode" value={id} checked={mode === id} onChange={() => setMode(id)} />
            <strong>{title}</strong>
            <small>{note}</small>
          </label>
        ))}
      </div>
      {mode === 'live' ? (
        <p className="alert alert-warn">
          <Icon name="alert" /> Live mode: every switched-on method needs its live keys below. Callback address: <code>{p.callbackBase}</code> (must be public https).
        </p>
      ) : (
        <p className="alert alert-warn">
          <Icon name="info" /> Test mode is on. Payments made now are marked "Test" and do not count as revenue.
        </p>
      )}

      <fieldset className="gw-edit">
        <legend>
          <label className="check">
            <input type="checkbox" checked={khaltiOn} onChange={(e) => setKhaltiOn(e.target.checked)} /> <strong>Khalti</strong>
          </label>
        </legend>
        <div className="two">
          {sf('khaltiTest', 'Test secret key (test-admin.khalti.com)', p.khalti.testKeySet)}
          {sf('khaltiLive', 'Live secret key (merchant dashboard)', p.khalti.liveKeySet)}
        </div>
        <small className="muted">
          Test: {p.urls.test.khalti} · Live: {p.urls.live.khalti}
        </small>
      </fieldset>

      <fieldset className="gw-edit">
        <legend>
          <label className="check">
            <input type="checkbox" checked={esewaOn} onChange={(e) => setEsewaOn(e.target.checked)} /> <strong>eSewa</strong>
          </label>
        </legend>
        <div className="two">
          <Field label="Test product code" hint="eSewa's public sandbox merchant is EPAYTEST.">
            <input value={codes.test} onChange={(e) => setCodes({ ...codes, test: e.target.value })} />
          </Field>
          {sf('esewaTest', 'Test secret key', p.esewa.testSecretSet)}
          <Field label="Live product code (merchant code)">
            <input value={codes.live} onChange={(e) => setCodes({ ...codes, live: e.target.value })} />
          </Field>
          {sf('esewaLive', 'Live secret key', p.esewa.liveSecretSet)}
        </div>
        <small className="muted">
          Test: {new URL(p.urls.test.esewaForm).host} · Live: {new URL(p.urls.live.esewaForm).host}
        </small>
      </fieldset>

      {msg}
      <div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save payments'}
        </button>
      </div>
    </form>
  );
}

/* ---------------------------------- SMTP ---------------------------------- */

function SmtpForm({ s, onSaved }) {
  const { user } = useAuth();
  const [f, setF] = useState({ host: s.smtp.host, port: s.smtp.port, user: s.smtp.user, from: s.smtp.from });
  const [pass, setPass] = useState('');
  const [clearPass, setClearPass] = useState(false);
  const [save, busy, msg] = useSave('smtp', (fresh) => {
    setPass('');
    setClearPass(false);
    onSaved(fresh);
  });
  const [to, setTo] = useState(user.email);
  const [test, setTest] = useState(['', '']);
  const [testing, setTesting] = useState(false);

  const sendTest = async () => {
    setTesting(true);
    setTest(['', '']);
    try {
      await api('/admin/settings/smtp/test', { method: 'POST', body: { to } });
      setTest(['success', `Test e-mail sent to ${to}. Check the inbox (and spam).`]);
    } catch (err) {
      setTest(['error', err.message]);
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <form
        className="card form"
        onSubmit={(e) => {
          e.preventDefault();
          save({ ...f, pass: clearPass ? null : pass || undefined });
        }}
      >
        <div>
          <h2>SMTP server</h2>
          <p className="muted small">
            Sends confirmation codes, password resets and expiry reminders. Gmail: host smtp.gmail.com, port 587, your Gmail address and an App
            Password (Google account → Security → App passwords).
          </p>
        </div>
        <div className="two">
          <Field label="Host">
            <input value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} placeholder="smtp.gmail.com" />
          </Field>
          <Field label="Port" hint="587 (STARTTLS) or 465 (SSL)">
            <input type="number" min="1" max="65535" value={f.port} onChange={(e) => setF({ ...f, port: Number(e.target.value) })} />
          </Field>
          <Field label="Username">
            <input value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} autoComplete="off" />
          </Field>
          <SecretField label="Password" isSet={s.smtp.passSet} value={pass} onChange={setPass} cleared={clearPass} onClear={setClearPass} />
        </div>
        <Field label="From" hint='e.g. "My Site <you@gmail.com>". Gmail only sends from your own address. Blank = site name + username.'>
          <input value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        </Field>
        {msg}
        <div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save SMTP'}
          </button>
        </div>
      </form>

      <div className="card form">
        <div>
          <h2>Send a test e-mail</h2>
          <p className="muted small">Save first, then send a test to check the settings work.</p>
        </div>
        <div className="grant">
          <input type="email" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Send test to" />
          <button type="button" className="btn btn-secondary" onClick={sendTest} disabled={testing || !s.smtp.host}>
            <Icon name="mail" /> {testing ? 'Sending…' : 'Send test'}
          </button>
        </div>
        {test[1] && <p className={`alert alert-${test[0]}`}>{test[1]}</p>}
      </div>
    </>
  );
}

/* ---------------------------------- Site ---------------------------------- */

function SiteForm({ s, onSaved }) {
  const [f, setF] = useState(s.site);
  const [save, busy, msg] = useSave('site', onSaved);
  const input = (k, label, { hint, ...props } = {}) => (
    <Field label={label} hint={hint}>
      <input value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
    </Field>
  );

  return (
    <form
      className="card form"
      onSubmit={(e) => {
        e.preventDefault();
        save(f);
      }}
    >
      <div>
        <h2>Site and footer</h2>
        <p className="muted small">Name, contact details and social links shown in the header, footer, e-mails and legal pages.</p>
      </div>
      <div className="two">
        {input('appName', 'Site name', { required: true, maxLength: 60 })}
        {input('company', 'Company / owner name', { hint: 'Used in the copyright line and legal pages.' })}
      </div>
      {input('tagline', 'Tagline', { maxLength: 200 })}
      <div className="two">
        {input('supportEmail', 'Support e-mail', { type: 'email' })}
        {input('phone', 'Phone')}
      </div>
      {input('address', 'Address')}
      <div className="two">
        {input('facebook', 'Facebook link', { placeholder: 'https://facebook.com/…' })}
        {input('instagram', 'Instagram link', { placeholder: 'https://instagram.com/…' })}
        {input('youtube', 'YouTube link', { placeholder: 'https://youtube.com/…' })}
        {input('x', 'X (Twitter) link', { placeholder: 'https://x.com/…' })}
        {input('linkedin', 'LinkedIn link', { placeholder: 'https://linkedin.com/…' })}
      </div>
      {msg}
      <div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save site details'}
        </button>
      </div>
    </form>
  );
}

/* ---------------------------------- Legal --------------------------------- */

function LegalForm({ s, onSaved }) {
  const pages = Object.entries(s.legalTitles).map(([id, title]) => ({ id, title }));
  const [f, setF] = useState(s.legal);
  const [save, busy, msg] = useSave('legal', onSaved);

  return (
    <form
      className="card form"
      onSubmit={(e) => {
        e.preventDefault();
        save(f);
      }}
    >
      <div>
        <h2>Legal pages</h2>
        <p className="muted small">
          Plain text. A blank line starts a paragraph, "## " a heading, "- " a list item. {'{site}'}, {'{company}'} and {'{email}'} are filled in
          from Site & footer. A page appears in the footer only once it has text.
        </p>
      </div>
      {pages.map((p) => (
        <Field key={p.id} label={p.title}>
          <textarea rows={12} value={f[p.id]} onChange={(e) => setF({ ...f, [p.id]: e.target.value })} placeholder="Empty: this page is not shown on the website." />
          {s.legal[p.id] && (
            <span className="row-actions tight">
              <a href={`/legal/${p.id}`} target="_blank" rel="noreferrer" className="btn btn-link">
                View page
              </a>
            </span>
          )}
        </Field>
      ))}
      {msg}
      <div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save legal pages'}
        </button>
      </div>
    </form>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function Settings() {
  const [f, setF] = useFilters({ tab: 'pricing' });
  const { data, error } = useAdmin('/admin/settings');
  const [s, setS] = useState(null);
  useEffect(() => setS(data), [data]);
  const tab = TABS.some(([id]) => id === f.tab) ? f.tab : 'pricing';

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Super admin</p>
          <h1>Settings</h1>
          <p className="muted">Changes apply at once, without restarting the server. Secrets are stored encrypted.</p>
        </div>
      </header>
      <nav className="tabs" aria-label="Settings sections">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'is-on' : ''} onClick={() => setF({ tab: id })}>
            {label}
          </button>
        ))}
      </nav>
      {!s ? (
        <Loading error={error} />
      ) : (
        <div className="settings-stack" key={tab}>
          {tab === 'pricing' && <PricingForm s={s} onSaved={setS} />}
          {tab === 'payments' && <PaymentsForm s={s} onSaved={setS} />}
          {tab === 'smtp' && <SmtpForm s={s} onSaved={setS} />}
          {tab === 'site' && <SiteForm s={s} onSaved={setS} />}
          {tab === 'legal' && <LegalForm s={s} onSaved={setS} />}
        </div>
      )}
    </>
  );
}
