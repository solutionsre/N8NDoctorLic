import { Link } from 'react-router-dom';
import { formatDate } from '../../api.js';
import { Loading, money, Pager, PaymentStatus, SearchBox, Select, useAdmin, useFilters } from './common.jsx';

export default function Payments() {
  const [f, setF, query] = useFilters({ q: '', status: '', mode: '', gateway: '', page: '1' });
  const { data, error } = useAdmin(`/admin/payments?${query}`);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Payments</h1>
          <p className="muted">Test payments (sandbox wallets) are marked and never count as revenue.</p>
        </div>
      </header>
      <div className="toolbar">
        <SearchBox value={f.q} onSearch={(q) => setF({ q })} placeholder="Search order, reference or customer" />
        <Select
          label="Status"
          value={f.status}
          onChange={(status) => setF({ status })}
          options={[
            ['', 'Any status'],
            ['completed', 'Completed'],
            ['pending', 'Pending'],
            ['failed', 'Failed'],
          ]}
        />
        <Select
          label="Mode"
          value={f.mode}
          onChange={(mode) => setF({ mode })}
          options={[
            ['', 'Live and test'],
            ['live', 'Live'],
            ['test', 'Test'],
          ]}
        />
        <Select
          label="Method"
          value={f.gateway}
          onChange={(gateway) => setF({ gateway })}
          options={[
            ['', 'All methods'],
            ['khalti', 'Khalti'],
            ['esewa', 'eSewa'],
          ]}
        />
      </div>
      {!data ? (
        <Loading error={error} />
      ) : data.payments.length === 0 ? (
        <div className="card empty">No payments match.</div>
      ) : (
        <>
          <p className="muted small">Completed in this view: {money(data.completedAmount)}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Plan</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Order / reference</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.createdAt)}</td>
                    <td>{p.user?.id ? <Link to={`/admin/users/${p.user.id}`}>{p.user.email}</Link> : '—'}</td>
                    <td>
                      {p.plan} <small className="muted">{p.isRenewal ? 'renewal' : 'new'}</small>
                    </td>
                    <td>{p.gatewayName}</td>
                    <td className="num">{money(p.amount)}</td>
                    <td>
                      <PaymentStatus p={p} />
                    </td>
                    <td>
                      <code className="cell-sub">{p.orderId}</code>
                      {p.gatewayRef && <code className="cell-sub">{p.gatewayRef}</code>}
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
