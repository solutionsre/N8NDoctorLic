import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setFormatOptions } from './api.js';

const SettingsContext = createContext(null);

/**
 * Loads the site settings (name, time zone, plans, rules) from the server once.
 * Nothing renders until they are here, so no page needs its own fallback values.
 */
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const s = await api('/settings');
      setFormatOptions({ timeZone: s.timezone, locale: s.locale, currency: s.currency });
      document.title = `${s.appName} – Licenses`;
      setSettings(s);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!settings) {
    return (
      <div className="page-loading">
        {error ? (
          <div className="card center">
            <p className="alert alert-error">The site could not load its settings: {error}</p>
            <button type="button" className="btn btn-primary" onClick={load}>
              Try again
            </button>
          </div>
        ) : (
          <span className="spinner" />
        )}
      </div>
    );
  }

  // reload(): the admin panel calls it after saving, so prices and the footer update at once.
  return <SettingsContext.Provider value={{ ...settings, reload: load }}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);

/** "Khalti", "Khalti or eSewa", "Khalti, eSewa or X" */
export const joinNames = (names, word = 'or') =>
  names.length <= 1 ? names[0] || '' : `${names.slice(0, -1).join(', ')} ${word} ${names[names.length - 1]}`;
