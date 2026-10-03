import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, npr } from '../../api.js';
import Icon from '../../components/Icon.jsx';

/** GET an admin endpoint; re-runs when `path` changes. Returns { data, error, loading, reload }. */
export function useAdmin(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api(path));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload };
}

/** List filters kept in the address bar, so a filtered view can be reloaded or shared. */
export function useFilters(defaults) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(Object.keys(defaults).map((k) => [k, params.get(k) ?? defaults[k]]));
  const set = (patch) => {
    const next = { ...values, ...patch };
    if (!('page' in patch)) next.page = '1';
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '' && v != null)), { replace: true });
  };
  const query = new URLSearchParams(Object.entries(values).filter(([, v]) => v !== '' && v != null)).toString();
  return [values, set, query];
}

/**
 * Runs an admin action (POST/PUT) with an optional confirm; returns the answer.
 * busy/error state lives in the caller via setBusy / setError.
 */
export async function adminAction(path, { method = 'POST', body, confirm, setBusy, setError, onDone }) {
  if (confirm && !window.confirm(confirm)) return null;
  setBusy?.(path);
  setError?.('');
  try {
    const out = await api(path, { method, body: body || {} });
    await onDone?.(out);
    return out;
  } catch (err) {
    setError?.(err.message);
    return null;
  } finally {
    setBusy?.('');
  }
}

export function Pager({ page, pages, total, onPage }) {
  if (pages <= 1) return <p className="muted small pager-info">{total} in total</p>;
  return (
    <div className="pager">
      <span className="muted small">
        {total} in total · page {page} of {pages}
      </span>
      <div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function SearchBox({ value, onSearch, placeholder }) {
  const [q, setQ] = useState(value);
  useEffect(() => setQ(value), [value]);
  return (
    <form
      className="search-box"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(q.trim());
      }}
    >
      <Icon name="search" className="input-icon" />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </form>
  );
}

export function Select({ value, onChange, options, label }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {options.map(([v, text]) => (
        <option key={v} value={v}>
          {text}
        </option>
      ))}
    </select>
  );
}

const LICENSE_STATUS = { active: ['Active', 'good'], expired: ['Expired', 'bad'], revoked: ['Blocked', 'bad'] };
export function LicenseStatus({ lic }) {
  const [label, tone] = LICENSE_STATUS[lic.status] || [lic.status, ''];
  return (
    <>
      <span className={`badge ${tone}`}>{label}</span>
      {lic.isTrial && <span className="badge trial">Trial</span>}
    </>
  );
}

export function PaymentStatus({ p }) {
  const tone = { completed: 'good', pending: 'warn', failed: 'bad' }[p.status] || '';
  return (
    <>
      <span className={`badge ${tone}`}>{p.status}</span>
      <span className={`badge ${p.mode === 'live' ? 'paid' : 'warn'}`}>{p.mode === 'live' ? 'Live' : 'Test'}</span>
    </>
  );
}

export function RoleBadge({ role }) {
  if (role === 'superadmin') return <span className="badge bad">Super admin</span>;
  if (role === 'admin') return <span className="badge paid">Admin</span>;
  return null;
}

export const money = (n) => npr(n || 0);

export function StatTile({ icon, label, value, note, tone = '' }) {
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

/**
 * One-series daily bar chart (last 30 days). Hover or focus a bar for its
 * exact value; the <table> below it (visually hidden) is the accessible view.
 */
export function BarChart({ title, series, format = (v) => v, total }) {
  const max = Math.max(1, ...series.map((d) => d.value));
  const short = (day) => `${Number(day.slice(8))}/${Number(day.slice(5, 7))}`;
  return (
    <figure className="card chart">
      <figcaption className="chart-head">
        <h3>{title}</h3>
        {total !== undefined && <span className="chart-total">{total}</span>}
      </figcaption>
      <div className="chart-plot" role="img" aria-label={`${title}, last ${series.length} days`}>
        <div className="chart-grid" aria-hidden="true">
          <span>{format(max)}</span>
          <span>{format(Math.round(max / 2))}</span>
          <span>0</span>
        </div>
        <div className="chart-bars">
          {series.map((d) => (
            <div key={d.day} className="chart-col" tabIndex={0} aria-label={`${d.day}: ${format(d.value)}`}>
              <span className="chart-bar" style={{ height: `${(d.value / max) * 100}%` }} />
              <span className="chart-tip" role="tooltip">
                <strong>{format(d.value)}</strong>
                <small>{d.day}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="chart-axis" aria-hidden="true">
        <span>{short(series[0].day)}</span>
        <span>{short(series[Math.floor(series.length / 2)].day)}</span>
        <span>{short(series[series.length - 1].day)}</span>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {series.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function Loading({ error }) {
  if (error) return <p className="alert alert-error">{error}</p>;
  return (
    <div className="skeleton-grid">
      <div />
      <div />
      <div />
    </div>
  );
}
