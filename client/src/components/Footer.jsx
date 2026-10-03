import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useSettings } from '../SettingsContext.jsx';
import Icon, { Logo } from './Icon.jsx';
import { timeZoneName } from '../api.js';

const SOCIAL = [
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['youtube', 'YouTube'],
  ['x', 'X'],
  ['linkedin', 'LinkedIn'],
];

/** Site footer: brand, links, contact details and legal pages, all from the admin settings. */
export default function Footer() {
  const { appName, site, gateways, legalPages } = useSettings();
  const { user } = useAuth();
  const socials = SOCIAL.filter(([key]) => site[key]);
  const hasContact = !!(site.supportEmail || site.phone || site.address || socials.length);
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="brand">
              <Logo /> <span>{appName}</span>
            </Link>
            {site.tagline && <p className="muted">{site.tagline}</p>}
            {gateways.length > 0 && (
              <div className="footer-pay">
                <span className="muted small">We accept</span>
                {gateways.map((g) => (
                  <span key={g.id} className={`pay-chip gw-${g.id}`}>
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <nav className="footer-col" aria-label="Product">
            <h4>Product</h4>
            <Link to="/#features">Features</Link>
            <Link to="/#pricing">Pricing</Link>
            <Link to="/#faq">FAQ</Link>
            <Link to={user ? '/dashboard' : '/register'}>{user ? 'Dashboard' : 'Start free trial'}</Link>
          </nav>

          <nav className="footer-col" aria-label="Account">
            <h4>Account</h4>
            {user ? (
              <>
                <Link to="/dashboard">My licenses</Link>
                <Link to="/account">Account & security</Link>
                {(user.role === 'admin' || user.role === 'superadmin') && <Link to="/admin">Admin panel</Link>}
              </>
            ) : (
              <>
                <Link to="/login">Log in</Link>
                <Link to="/register">Create account</Link>
                <Link to="/forgot-password">Forgot password</Link>
              </>
            )}
          </nav>

          {hasContact && (
          <div className="footer-col">
            <h4>Contact</h4>
            {site.supportEmail && (
              <a href={`mailto:${site.supportEmail}`}>
                <Icon name="mail" size={15} /> {site.supportEmail}
              </a>
            )}
            {site.phone && (
              <a href={`tel:${site.phone.replace(/[^\d+]/g, '')}`}>
                <Icon name="phone" size={15} /> {site.phone}
              </a>
            )}
            {site.address && (
              <span>
                <Icon name="pin" size={15} /> {site.address}
              </span>
            )}
            {socials.length > 0 && (
              <div className="footer-social">
                {socials.map(([key, label]) => (
                  <a key={key} href={site[key]} target="_blank" rel="noopener noreferrer">
                    {label}
                  </a>
                ))}
              </div>
            )}
          </div>
          )}
        </div>

        <div className="footer-bottom">
          <span className="muted">
            © {year} {site.company || appName}. All rights reserved. All times are {timeZoneName()}.
          </span>
          <nav aria-label="Legal">
            {legalPages.map((p) => (
              <Link key={p.id} to={`/legal/${p.id}`}>
                {p.title}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
