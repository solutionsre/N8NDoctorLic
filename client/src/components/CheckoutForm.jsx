import { useState } from 'react';
import { api, goToGateway, npr } from '../api.js';
import { useSettings } from '../SettingsContext.jsx';
import MachineIdField, { MACHINE_RE, cleanMachineId } from './MachineIdField.jsx';

/**
 * Plan + gateway picker. With licenseId it renews that license; without, it
 * buys a new license for the Machine ID entered.
 */
export default function CheckoutForm({ plans, licenseId = null, onCancel, submitLabel }) {
  const { gateways, paymentMode } = useSettings();
  const [plan, setPlan] = useState(plans[0]?.id || '');
  const [gateway, setGateway] = useState(gateways[0]?.id || '');
  const [machineId, setMachineId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const checkout = await api('/payments/checkout', { method: 'POST', body: { plan, gateway, licenseId, machineId: cleanMachineId(machineId) } });
      goToGateway(checkout);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="checkout" onSubmit={submit}>
      {!licenseId && <MachineIdField value={machineId} onChange={setMachineId} />}
      <div className="choice-row">
        {plans.map((p) => (
          <label key={p.id} className={`choice ${plan === p.id ? 'is-on' : ''}`}>
            <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} />
            <strong>{p.name}</strong>
            <span>{npr(p.price)}</span>
            <small>{p.days} days</small>
          </label>
        ))}
      </div>
      <div className="choice-row">
        {gateways.length === 0 && <p className="alert alert-warn">Online payment is not set up on this server yet.</p>}
        {gateways.map(({ id, name: label }) => (
          <label key={id} className={`choice gateway ${gateway === id ? 'is-on' : ''} gw-${id}`}>
            <input type="radio" name="gateway" value={id} checked={gateway === id} onChange={() => setGateway(id)} />
            <strong>{label}</strong>
          </label>
        ))}
      </div>
      {paymentMode === 'test' && gateways.length > 0 && (
        <p className="alert alert-warn">Test mode: payments go to the gateway's sandbox. Use a test wallet; no real money is taken.</p>
      )}
      {error && <p className="alert alert-error">{error}</p>}
      <div className="row-actions">
        <button className="btn btn-primary" disabled={busy || !plan || !gateway || (!licenseId && !MACHINE_RE.test(cleanMachineId(machineId)))}>
          {busy ? 'Opening payment…' : submitLabel || 'Pay now'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
