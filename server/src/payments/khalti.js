// Khalti ePayment (KPG-2): https://docs.khalti.com/khalti-epayment/
import { config, gatewayConfig } from '../config.js';
import { HttpError } from '../lib/http.js';

/** mode: the mode the payment was started in ('test' = sandbox, 'live'). */
async function call(path, body, mode) {
  const { secretKey, baseUrl } = gatewayConfig('khalti', mode);
  if (!secretKey) {
    throw new HttpError(503, 'Khalti is not set up on this server yet.', 'gateway_off');
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Key ${secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.detail || data.error_key || JSON.stringify(data).slice(0, 200);
    throw new HttpError(502, `Khalti: ${msg}`, 'gateway_error');
  }
  return data;
}

/** Starts a payment. Returns { pidx, url } (send the user to url). */
export async function initiate({ payment, user, planName }) {
  const data = await call(
    '/epayment/initiate/',
    {
      return_url: `${config.serverUrl}/api/payments/khalti/return`,
      website_url: config.clientUrl,
      amount: Math.round(payment.amount * 100), // paisa
      purchase_order_id: payment.orderId,
      purchase_order_name: `${config.appName} - ${planName}`,
      customer_info: { name: user.name, email: user.email },
    },
    payment.mode
  );
  return { pidx: data.pidx, url: data.payment_url };
}

/** Asks Khalti for the real status of a payment (never trust the redirect alone). */
export async function lookup(pidx, mode) {
  return call('/epayment/lookup/', { pidx }, mode);
}
