import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../AuthContext.jsx';
import Icon from '../../components/Icon.jsx';
import { RoleBadge } from './common.jsx';

/** Admin shell: side navigation + the current admin page. */
export default function AdminLayout() {
  const { user } = useAuth();
  const links = [
    ['/admin', 'chart', 'Overview', true],
    ['/admin/users', 'users', 'Users'],
    ['/admin/licenses', 'key', 'Licenses'],
    ['/admin/payments', 'wallet', 'Payments'],
    ['/admin/log', 'history', 'Admin log'],
  ];
  if (user.role === 'superadmin') links.push(['/admin/settings', 'settings', 'Settings']);

  return (
    <section className="container page admin">
      <aside className="admin-nav">
        <div className="admin-who">
          <strong>{user.name}</strong>
          <RoleBadge role={user.role} />
        </div>
        <nav aria-label="Admin">
          {links.map(([to, icon, label, end]) => (
            <NavLink key={to} to={to} end={end}>
              <Icon name={icon} /> {label}
            </NavLink>
          ))}
          {user.role !== 'superadmin' && (
            <span className="admin-locked" title="Ask a super admin to change your role">
              <Icon name="lock" /> Settings
              <small>Payments (test/live keys), SMTP and prices need a super admin.</small>
            </span>
          )}
        </nav>
      </aside>
      <div className="admin-main">
        <Outlet />
      </div>
    </section>
  );
}
