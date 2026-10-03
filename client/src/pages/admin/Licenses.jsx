import { Link } from 'react-router-dom';
import { formatDate } from '../../api.js';
import LicenseActions from './LicenseActions.jsx';
import { LicenseStatus, Loading, Pager, SearchBox, Select, useAdmin, useFilters } from './common.jsx';

export default function Licenses() {
  const [f, setF, query] = useFilters({ q: '', status: '', plan: '', page: '1' });
  const { data, error, reload } = useAdmin(`/admin/licenses?${query}`);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Licenses</h1>
          <p className="muted">Every license of every customer. A blocked license is no longer issued as a key.</p>
        </div>
      </header>
      <div className="toolbar">
        <SearchBox value={f.q} onSearch={(q) => setF({ q })} placeholder="Search key, machine ID or customer" />
        <Select
          label="Status"
          value={f.status}
          onChange={(status) => setF({ status })}
          options={[
            ['', 'Any status'],
            ['active', 'Active'],
            ['expiring', 'Expiring soon'],
            ['expired', 'Expired'],
            ['blocked', 'Blocked'],
          ]}
        />
        <Select
          label="Type"
          value={f.plan}
          onChange={(plan) => setF({ plan })}
          options={[
            ['', 'Trial and paid'],
            ['paid', 'Paid'],
            ['trial', 'Trial'],
          ]}
        />
      </div>
      {!data ? (
        <Loading error={error} />
      ) : data.licenses.length === 0 ? (
        <div className="card empty">No licenses match.</div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>License</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Machine ID</th>
                  <th>Expires</th>
                  <th>Key downloaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.licenses.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <span className="cell-main">{l.planName}</span>
                      <code className="cell-sub">{l.key}</code>
                    </td>
                    <td>{l.user?.id ? <Link to={`/admin/users/${l.user.id}`}>{l.user.email}</Link> : '—'}</td>
                    <td>
                      <LicenseStatus lic={l} />
                    </td>
                    <td><code className="domain" style={{ fontSize: 11 }}>{(l.machineId || '').slice(0, 19)}…</code></td>
                    <td>
                      {formatDate(l.expiresAt)}
                      {l.status === 'active' && <small className="cell-sub">{l.daysLeft} day(s) left</small>}
                    </td>
                    <td>{l.lastDownloadAt ? formatDate(l.lastDownloadAt) : '—'}</td>
                    <td>
                      <LicenseActions lic={l} onDone={reload} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={(p) => setF({ page: String(p) })} />
        </>
      )}
    </>
  );
}
