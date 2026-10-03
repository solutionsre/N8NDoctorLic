// eSewa ePay v2: https://developer.esewa.com.np/pages/Epay
import crypto from 'node:crypto';
import { config, gatewayConfig } from '../config.js';
import { HttpError } from '../lib/http.js';

const hmac = (secret, message) => crypto.createHmac('sha256', secret).update(message).digest('base64');

/** The form fields the browser posts to eSewa (in the payment's own mode). */
export function formFields(payment) {
  const { secretKey, productCode, formUrl } = gatewayConfig('esewa', payment.mode);
  if (!secretKey || !productCode) {
    throw new HttpError(503, 'eSewa is not set up on this server yet.', 'gateway_off');
  }
  const total = String(payment.amount);
  const fields = {
    amount: total,
    tax_amount: '0',
    total_amount: total,
    transaction_uuid: payment.orderId,
    product_code: productCode,
    product_service_charge: '0',
    product_delivery_charge: '0',
    success_url: `${config.serverUrl}/api/payments/esewa/success`,
    failure_url: `${config.serverUrl}/api/payments/esewa/failure?order=${payment.orderId}`,
    signed_field_names: 'total_amount,transaction_uuid,product_code',
  };
  fields.signature = hmac(secretKey, `total_amount=${total},transaction_uuid=${payment.orderId},product_code=${productCode}`);
  return { action: formUrl, fields };
}

/** Decodes the ?data= eSewa sends back, without trusting it yet. */
export function parseResponse(dataParam) {
  try {
    const data = JSON.parse(Buffer.from(String(dataParam), 'base64').toString('utf8'));
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/** Checks the signature on eSewa's answer with the secret of the payment's mode. */
export function verifyResponse(data, mode) {
  const { secretKey } = gatewayConfig('esewa', mode);
  if (!secretKey || !data?.signed_field_names || !data.signature) return false;
  const message = String(data.signed_field_names)
    .split(',')
    .map((f) => `${f}=${data[f] ?? ''}`)
    .join(',');
  const expected = Buffer.from(hmac(secretKey, message));
  const given = Buffer.from(String(data.signature));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** eSewa's own record of the transaction (status COMPLETE when paid). */
export async function status(payment) {
  const { productCode, statusUrl } = gatewayConfig('esewa', payment.mode);
  const url = new URL(statusUrl);
  url.searchParams.set('product_code', productCode);
  url.searchParams.set('total_amount', String(payment.amount));
  url.searchParams.set('transaction_uuid', payment.orderId);
  const res = await fetch(url);
  if (!res.ok) throw new HttpError(502, 'eSewa status check failed.', 'gateway_error');
  return res.json();
}

/** "1,000.0" -> 1000 */
export const toNumber = (v) => Number(String(v ?? '').replace(/,/g, ''));
