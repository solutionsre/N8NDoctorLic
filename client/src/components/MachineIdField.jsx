/** Machine ID input (copied from n8n Doctor > License Manager > Machine Information). */
export const MACHINE_RE = /^([0-9A-F]{4}-){15}[0-9A-F]{4}$/;
export const cleanMachineId = (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, '');

export default function MachineIdField({ value, onChange }) {
  const clean = cleanMachineId(value);
  const bad = clean && !MACHINE_RE.test(clean);
  return (
    <label className="field">
      <span>Machine ID</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
        spellCheck="false"
        autoComplete="off"
        style={{ fontFamily: 'monospace' }}
      />
      <small className={bad ? 'error' : 'muted'}>
        {bad ? 'That is not a valid Machine ID (16 groups of 4 letters/digits).' : 'In n8n Doctor open License Manager → Machine Information → Copy Machine ID. The key only works on that computer.'}
      </small>
    </label>
  );
}
