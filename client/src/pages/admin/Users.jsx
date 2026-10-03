import { Link } from 'react-router-dom';
import { formatDate } from '../../api.js';
import { Loading, Pager, RoleBadge, SearchBox, Select, useAdmin, useFilters } from './common.jsx';

export default function Users() {
  const [f, setF, query] = useFilters({ q: '', filter: '', page: '1' });
  const { data, error } = useAdmin(`/admin/users?${query}`);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Users</h1>
          <p className="muted">Open a user to block them, remove their trial, give a license or change their role.</p>
        </div>
      </header>
      <div className="toolbar">
        <SearchBox value={f.q} onSearch={(q) => setF({ q })} placeholder="Search name or e-mail" />
        <Select
          label="Show"
          value={f.filter}
          onChange={(filter) => setF({ filter })}
          options={[
            ['', 'All users'],
            ['blocked', 'Blocked'],
            ['unverified', 'E-mail not confirmed'],
            ['trial', 'Used their trial'],
            ['admins', 'Admins'],
          ]}
        />
      </div>
      {!data ? (
        <Loading error={error} />
      ) : data.users.length === 0 ? (
        <div className="card empty">No users match.</div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Licenses</th>
                  <th>Trial</th>
                  <th>Joined</th>
                  <th>Last log in</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link to={`/admin/users/${u.id}`} className="cell-main">
                        {u.name}
                      </Link>
                      <small className="cell-sub">{u.email}</small>
                    </td>
                    <td>
                      <RoleBadge role={u.role} />
                      {u.blocked ? <span className="badge bad">Blocked</span> : <span className="badge good">Active</span>}
                      {!u.emailVerified && <span className="badge warn">Unconfirmed</span>}
                      {u.lockedUntil && <span className="badge warn">Locked</span>}
                    </td>
                    <td className="num">
                      {u.activeLicenses} <small className="muted">/ {u.licenseCount}</small>
                    </td>
                    <td>{u.trialUsed ? 'Used' : '—'}</td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>{u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}</td>
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
