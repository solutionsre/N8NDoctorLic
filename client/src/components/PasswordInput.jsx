import { useState } from 'react';
import Icon from './Icon.jsx';
import { useSettings } from '../SettingsContext.jsx';

/** Rough strength score 0-4 with the rules the server enforces. */
export function passwordScore(pw, min) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= min) s++;
  if (pw.length >= min + 4) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (pw.length < min || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) s = Math.min(s, 1);
  return s;
}

const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];

export default function PasswordInput({ label, value, onChange, showStrength = false, autoComplete = 'current-password', ...rest }) {
  const { auth } = useSettings();
  const [visible, setVisible] = useState(false);
  const score = passwordScore(value, auth.passwordMinLength);

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <Icon name="lock" className="input-icon" />
        <input type={visible ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} {...rest} />
        <button
          type="button"
          className="input-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} />
        </button>
      </span>
      {showStrength && value && (
        <span className={`strength s${score}`}>
          <span className="strength-bar">
            {[1, 2, 3, 4].map((i) => (
              <i key={i} className={i <= score ? 'on' : ''} />
            ))}
          </span>
          <small>{LABELS[score]} · at least {auth.passwordMinLength} characters with a letter and a number</small>
        </span>
      )}
    </label>
  );
}
