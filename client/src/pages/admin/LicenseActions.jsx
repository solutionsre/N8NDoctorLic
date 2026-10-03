import { useState } from 'react';
import { adminAction } from './common.jsx';

/** Block / unblock, add days and change the machine of one license. */
export default function LicenseActions({ lic, onDone, compact = false }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const base = `/admin/licenses/${lic.id}`;
  const run = (path, opts = {}) => adminAction(`${base}/${path}`, { setBusy, setError, onDone, ...opts });

  const block = () => {
    const reason = window.prompt(`Block ${lic.key}? The customer gets no key for it any more (a key already pasted into the app keeps working until it expires).\n\nReason (shown to the customer, optional):`, '');
    if (reason !== null) run('block', { body: { reason } });
  };
  const extend = () => {
    const v = window.prompt(`Add days to ${lic.key} (use a minus sign to remove days):`, '30');
    if (v === null) return;
    const days = Number(v);
    if (!Number.isInteger(days) || days === 0) {
      setError('Enter a whole number of days, e.g. 30 or -7.');
      return;
    }
    run('extend', { body: { days } });
  };

  return (
    <div className={compact ? 'cell-actions' : 'row-actions'}>
      {lic.status === 'revoked' ? (
        <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => run('unblock', { confirm: `Unblock ${lic.key}?` })}>
          Unblock
        </button>
      ) : (
        <button type="button" className="btn btn-danger btn-sm" disabled={!!busy} onClick={block}>
          Block
        </button>
      )}
      <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={extend}>
        ± Days
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={!!busy}
        onClick={() => {
          const v = window.prompt(`New Machine ID for ${lic.key}.\nCurrent: ${lic.machineId}`, '');
          if (v) run('machine', { body: { machineId: v } });
        }}
      >
        Change machine
      </button>
      {error && <p className="alert alert-error">{error}</p>}
    </div>
  );
}
