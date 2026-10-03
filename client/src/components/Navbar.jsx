import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useSettings } from '../SettingsContext.jsx';
import Icon, { Logo } from './Icon.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { appName } = useSettings();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const onLogout = async () => {
    await logout();
    navigate('/');
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const initials = (user?.name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand">
          <Logo /> <span>{appName}</span>
        </Link>
        <button type="button" className="nav-burger" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
          <Icon name={open ? 'x' : 'menu'} size={22} />
        </button>
        <nav className={`nav-links ${open ? 'is-open' : ''}`}>
          <Link to="/#pricing">Pricing</Link>
          {user ? (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              {isAdmin && <NavLink to="/admin">Admin</NavLink>}
              <div className="user-menu" ref={menuRef}>
                <button type="button" className="avatar-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
                  <span className="avatar">{initials}</span>
                  <span className="avatar-name">{user.name.split(' ')[0]}</span>
                  {!user.emailVerified && <span className="dot" title="E-mail not confirmed" />}
                </button>
                {menu && (
                  <div className="dropdown">
                    <div className="dropdown-head">
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </div>
                    <Link to="/dashboard">
                      <Icon name="key" /> Licenses
                    </Link>
                    <Link to="/account">
                      <Icon name="settings" /> Account & security
                    </Link>
                    {isAdmin && (
                      <Link to="/admin">
                        <Icon name="grid" /> Admin panel
                      </Link>
                    )}
                    <button type="button" onClick={onLogout}>
                      <Icon name="logout" /> Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link to="/register" className="btn btn-primary">
                Start free trial
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
