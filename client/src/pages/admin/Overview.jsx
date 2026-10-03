import { Link } from 'react-router-dom';
import { formatDate, timeZoneName } from '../../api.js';
import Icon from '../../components/Icon.jsx';
import { BarChart, Loading, money, PaymentStatus, StatTile, useAdmin } from './common.jsx';

function uptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

export default function Overview() {
  const { data, error, reload, loading } = useAdmin('/admin/overview');
  if (!data) return <Loading error={error} />;
  const { users, licenses, revenue, payments, series, system, warnings, planMix } = data;
  const sum = (s) => s.reduce((a, d) => a + d.value, 0);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Overview</h1>
          <p className="muted">Business and server performance at a glance.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading}>
          <Icon name="refresh" /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {warnings.map((w) => (
        <p key={w.text} className={`alert alert-${w.level === 'bad' ? 'error' : 'warn'}`}>
          <Icon name="alert" /> {w.text}
        </p>
      ))}

      <h2 className="section-title">Revenue (live payments only)</h2>
      <div className="stats">
        <StatTile icon="wallet" label="This month" value={money(revenue.month)} note={`${money(revenue.last30)} in the last 30 days`} />
        <StatTile icon="chart" label="All time" value={money(revenue.total)} note={`${revenue.count} paid order(s)`} />
        <StatTile
          icon="card"
          label="Payments"
          value={payments.completedLive}
          note={`${payments.pending} pending · ${payments.failed} failed · ${payments.completedTest} test`}
          tone={payments.pending ? 'warn' : ''}
        />
      </div>

      <h2 className="section-title">Customers & licenses</h2>
      <div className="stats">
        <StatTile icon="users" label="Users" value={users.total} note={`${users.new30} new in 30 days · ${users.verified} confirmed`} />
        <StatTile icon="key" label="Paid licenses active" value={licenses.paidActive} note={`${licenses.trialsActive} trial(s) running`} />
        <StatTile icon="globe" label="Active licenses" value={licenses.sitesActive} note={`${licenses.checkedToday} keys downloaded in the last 24 h`} />
        <StatTile
          icon="clock"
          label="Expiring soon"
          value={licenses.expiringSoon}
          note={`${licenses.expired} expired · ${licenses.blocked} blocked`}
          tone={licenses.expiringSoon ? 'warn' : ''}
        />
      </div>

      <div className="chart-grid-2">
        <BarChart title="Sign-ups per day" series={series.signups} total={`${sum(series.signups)} in 30 days`} />
        <BarChart title="Live revenue per day" series={series.revenue} format={money} total={money(sum(series.revenue))} />
      </div>

      <div className="admin-cols">
        <div>
          <div className="section-row">
            <h2 className="section-title">Latest payments</h2>
            <Link to="/admin/payments">All payments</Link>
          </div>
          {data.recentPayments.length === 0 ? (
            <div className="card empty">No payments yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPayments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.createdAt)}</td>
                      <td>{p.user?.id ? <Link to={`/admin/users/${p.user.id}`}>{p.user.email}</Link> : '—'}</td>
                      <td>
                        {p.plan} · {p.gatewayName}
                      </td>
                      <td className="num">{money(p.amount)}</td>
                      <td>
                        <PaymentStatus p={p} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="section-title">Active licenses by plan</h2>
          <div className="card">
            {planMix.length === 0 ? (
              <p className="muted">No active licenses yet.</p>
            ) : (
              <ul className="mix">
                {planMix.map((p) => {
                  const total = planMix.reduce((a, x) => a + x.count, 0);
                  return (
                    <li key={p.plan}>
                      <span>{p.name}</span>
                      <span className="mix-bar">
                        <span style={{ width: `${(p.count / total) * 100}%` }} />
                      </span>
                      <strong>{p.count}</strong>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <aside>
          <h2 className="section-title">Server</h2>
          <div className="card">
            <dl className="sys">
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`badge ${system.db.connected ? 'good' : 'bad'}`}>{system.db.connected ? 'Online' : 'DB down'}</span>
                  <span className={`badge ${system.env === 'production' ? 'good' : 'warn'}`}>{system.env}</span>
                </dd>
              </div>
              <div>
                <dt>Uptime</dt>
                <dd>{uptime(system.uptimeSec)}</dd>
              </div>
              <div>
                <dt>Database ping</dt>
                <dd>{system.db.pingMs} ms</dd>
              </div>
              <div>
                <dt>Memory</dt>
                <dd>
                  {system.memoryMb.rss} MB <small className="muted">(heap {system.memoryMb.heapUsed} MB)</small>
                </dd>
              </div>
              <div>
                <dt>CPU load</dt>
                <dd>
                  {system.load[0] || '—'} <small className="muted">({system.cpus} cores)</small>
                </dd>
              </div>
              <div>
                <dt>Node.js</dt>
                <dd>{system.node}</dd>
              </div>
              <div>
                <dt>Payments</dt>
                <dd>
                  <span className={`badge ${system.paymentMode === 'live' ? 'good' : 'warn'}`}>{system.paymentMode}</span>
                  {system.gateways.map((g) => (
                    <span key={g.id} className={`badge ${g.enabled ? 'good' : ''}`}>
                      {g.name} {g.enabled ? 'on' : 'off'}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd>
                  <span className={`badge ${system.mail.enabled && !system.mail.lastError ? 'good' : 'bad'}`}>
                    {system.mail.enabled ? (system.mail.lastError ? 'Error' : 'Working') : 'Not set up'}
                  </span>
                  {system.mail.host && <small className="muted">{system.mail.host}</small>}
                </dd>
              </div>
              <div>
                <dt>Time zone</dt>
                <dd>
                  {timeZoneName()} <small className="muted">({system.timezone})</small>
                </dd>
              </div>
            </dl>
          </div>

          <div className="section-row">
            <h2 className="section-title">Admin activity</h2>
            <Link to="/admin/log">Full log</Link>
          </div>
          <div className="card log-list">
            {data.recentLog.length === 0 ? (
              <p className="muted small">Nothing yet.</p>
            ) : (
              data.recentLog.map((e) => (
                <div key={e._id}>
                  <strong>{e.action}</strong> <span className="muted">{e.note}</span>
                  <small>
                    {e.adminEmail} · {formatDate(e.createdAt)}
                  </small>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
