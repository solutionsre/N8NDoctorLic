import Icon from './Icon.jsx';
import { joinNames, useSettings } from '../SettingsContext.jsx';

/** Two-column page for log in / sign up / password screens. */
export default function AuthLayout({ title, subtitle, children }) {
  const { appName, gateways } = useSettings();
  const pay = gateways.length ? `${joinNames(gateways.map((g) => g.name))}, in rupees. ` : '';
  const POINTS = [
    ['shield', 'Signed licenses', 'Keys are digitally signed, so they cannot be edited or faked.'],
    ['globe', 'One license, one computer', 'Your key is tied to your Machine ID.'],
    ['card', 'Pay in Nepal', `${pay}The trial needs no payment.`],
  ];

  return (
    <section className="auth-page">
      <aside className="auth-aside">
        <div className="auth-aside-inner">
          <p className="eyebrow light">{appName}</p>
          <h2>Get your n8n Doctor license key in minutes.</h2>
          <ul className="auth-points">
            {POINTS.map(([icon, t, d]) => (
              <li key={t}>
                <span className="auth-point-icon">
                  <Icon name={icon} />
                </span>
                <span>
                  <strong>{t}</strong>
                  <small>{d}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="auth-main">
        <div className="auth-card">
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
          {children}
        </div>
      </div>
    </section>
  );
}
