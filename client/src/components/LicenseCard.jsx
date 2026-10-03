import { useState } from 'react';
import { api, formatDate } from '../api.js';
import CheckoutForm from './CheckoutForm.jsx';
import Icon from './Icon.jsx';

const STATUS = {
  active: ['Active', 'good'],
  expired: ['Expired', 'bad'],
  revoked: ['Blocked', 'bad'],
};

export default function LicenseCard({ license: lic, plans, rules, onChange }) {
  const [renewing, setRenewing] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async (what, path, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(what);
    setError('');
    try {
      await api(path, { method: 'POST' });
      await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lic.licenseKey || lic.key);
      api(`/licenses/${lic.id}/downloaded`, { method: 'POST' }).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the key is still selectable */
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([lic.licenseKey], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lic.key}.lic`;
    a.click();
    URL.revokeObjectURL(url);
    api(`/licenses/${lic.id}/downloaded`, { method: 'POST' }).catch(() => {});
  };

  const [label, tone] = STATUS[lic.status] || [lic.status, ''];
  const total = Math.max(1, (new Date(lic.expiresAt) - new Date(lic.startsAt)) / 86400000);
  const pct = lic.status === 'active' ? Math.min(100, Math.round((lic.daysLeft / total) * 100)) : 0;

  return (
    <article className={`card license ${lic.expiringSoon ? 'is-warn' : ''} ${lic.status !== 'active' ? 'is-off' : ''}`}>
      <div className="license-head">
        <div className="license-title">
          <span className={`plan-dot ${lic.isTrial ? 'trial' : 'paid'}`}>
            <Icon name={lic.isTrial ? 'bolt' : 'key'} />
          </span>
          <div>
            <h3>{lic.planName}</h3>
            <span className={`badge ${tone}`}>{label}</span>
            {lic.isTrial && <span className="badge trial">Trial</span>}
          </div>
        </div>
        <button type="button" className="key" onClick={copy} title="Copy the license key to paste into n8n Doctor">
          <span>{lic.key}</span>
          <small>
            <Icon name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copied' : 'Copy key'}
          </small>
        </button>
      </div>

      {lic.expiringSoon && (
        <p className="alert alert-warn">
          {lic.isTrial
            ? `Your free trial ends in ${lic.daysLeft} day(s). Buy a plan to keep using n8n Doctor.`
            : `This license expires in ${lic.daysLeft} day(s). Renew it now${lic.canExtend ? `, or extend it once by ${rules.extendDays} days` : ''}.`}
        </p>
      )}
      {lic.status === 'revoked' && (
        <p className="alert alert-error">
          This license is blocked{lic.blockedReason ? `: ${lic.blockedReason}` : ''}. The key is no longer issued. Contact support if you
          think this is a mistake.
        </p>
      )}
      {lic.status === 'expired' && (
        <p className="alert alert-error">Expired. n8n Doctor is locked on this machine. Renew, then paste the new key into License Manager → Renew License.</p>
      )}

      <dl className="facts">
        <div>
          <dt>
            <Icon name="clock" size={14} /> Expires
          </dt>
          <dd>
            {formatDate(lic.expiresAt)}
            {lic.status === 'active' && <small> · {lic.daysLeft} day(s) left</small>}
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="globe" size={14} /> Machine ID
          </dt>
          <dd><code className="domain" style={{ wordBreak: 'break-all', fontSize: 11 }}>{lic.machineId}</code></dd>
        </div>
        <div>
          <dt>
            <Icon name="checkCircle" size={14} /> Key last downloaded
          </dt>
          <dd>{lic.lastDownloadAt ? formatDate(lic.lastDownloadAt) : <span className="muted">Never</span>}</dd>
        </div>
        {lic.extensionUsedAt && (
          <div>
            <dt>Extension</dt>
            <dd>
              +{lic.extensionDays} days used on {formatDate(lic.extensionUsedAt)}
              {rules.extensionDeducted && <small> · counted in your next renewal</small>}
            </dd>
          </div>
        )}
      </dl>

      {lic.status === 'active' && (
        <div className="meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Time left">
          <span style={{ width: `${pct}%` }} />
        </div>
      )}

      {error && <p className="alert alert-error">{error}</p>}

      {renewing ? (
        <CheckoutForm
          plans={plans}
          licenseId={lic.id}
          submitLabel={lic.isTrial ? 'Upgrade & pay' : 'Renew & pay'}
          onCancel={() => setRenewing(false)}
        />
      ) : (
        <div className="row-actions">
          {lic.status !== 'revoked' && (
            <button type="button" className="btn btn-primary" onClick={() => setRenewing(true)}>
              {lic.isTrial ? 'Upgrade to paid' : 'Renew'}
            </button>
          )}
          {!lic.isTrial && lic.status === 'active' && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!lic.canExtend || busy === 'extend'}
              title={lic.extendBlockedReason || ''}
              onClick={() =>
                run(
                  'extend',
                  `/licenses/${lic.id}/extend`,
                  `Extend this license by ${rules.extendDays} days? You can do this once per period${
                    rules.extensionDeducted ? '; the days are counted in your next renewal' : ''
                  }.`
                )
              }
            >
              {busy === 'extend' ? 'Extending…' : `Extend ${rules.extendDays} days`}
            </button>
          )}
          {lic.licenseKey && (
            <button type="button" className="btn btn-ghost" onClick={download}>
              Download .lic file
            </button>
          )}
        </div>
      )}
      {!lic.isTrial && lic.status === 'active' && !lic.canExtend && lic.extendBlockedReason && !renewing && (
        <p className="hint">Extend: {lic.extendBlockedReason}</p>
      )}
      {lic.isTrial && !renewing && <p className="hint">Trial licenses cannot be extended.</p>}
    </article>
  );
}
