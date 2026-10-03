import { formatDate } from '../../api.js';
import { Loading, Pager, useAdmin, useFilters } from './common.jsx';

export default function Log() {
  const [f, setF, query] = useFilters({ page: '1' });
  const { data, error } = useAdmin(`/admin/log?${query}`);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Admin log</h1>
          <p className="muted">Every change made in the admin panel, and who made it.</p>
        </div>
      </header>
      {!data ? (
        <Loading error={error} />
      ) : data.entries.length === 0 ? (
        <div className="card empty">Nothing logged yet.</div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e._id}>
                    <td>{formatDate(e.createdAt)}</td>
                    <td>{e.adminEmail}</td>
                    <td>
                      <code>{e.action}</code>
                    </td>
                    <td className="wrap">{e.note || '—'}</td>
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
