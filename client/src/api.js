/** Small fetch wrapper: JSON in/out, session cookie, errors thrown with the server's message. */
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    // X-Requested-With is the server's CSRF check: other sites cannot send it.
    headers: body ? { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' } : { 'X-Requested-With': 'fetch' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Sends the browser to Khalti, or posts the signed form to eSewa. */
export function goToGateway(checkout) {
  if (checkout.type === 'redirect') {
    window.location.href = checkout.url;
    return;
  }
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = checkout.action;
  Object.entries(checkout.fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

// Set from the server settings (SettingsProvider) before any page renders.
const fmt = { timeZone: undefined, locale: undefined, currency: '' };
export function setFormatOptions({ timeZone, locale, currency }) {
  Object.assign(fmt, { timeZone, locale, currency });
}

export const npr = (n) => `${fmt.currency} ${Number(n).toLocaleString(fmt.locale)}`.trim();

/**
 * Date + time in the site's time zone (TIMEZONE, Nepal), not the browser's.
 * No zone label on each date; the footer says once which zone all times use.
 */
export const formatDate = (d) =>
  new Date(d).toLocaleString(fmt.locale, {
    timeZone: fmt.timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** The site time zone's own name from the browser, e.g. "Nepal Time" for Asia/Kathmandu. */
export function timeZoneName() {
  const parts = new Intl.DateTimeFormat(fmt.locale, { timeZone: fmt.timeZone, timeZoneName: 'long' }).formatToParts(new Date());
  return parts.find((p) => p.type === 'timeZoneName')?.value || fmt.timeZone;
}
