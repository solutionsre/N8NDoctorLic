import crypto from 'node:crypto';
import { config } from '../config.js';

// Same Ed25519 key as vendor-license-tool (vendor_private_key.hex, raw 32-byte seed).
// n8n Doctor only holds the matching public key, so it accepts what this server signs.
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const privateKey = crypto.createPrivateKey({
  key: Buffer.concat([PKCS8_PREFIX, Buffer.from(config.licensePrivateKeyHex, 'hex')]),
  format: 'der',
  type: 'pkcs8',
});

/** Raw public key as hex: must equal PUBLIC_KEY_HEX in the app's public_key.py. */
export function publicKeyHex() {
  const spki = crypto.createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
  return spki.subarray(spki.length - 32).toString('hex');
}

// license_type values the app understands (license_model.LicenseType).
export const APP_TYPE = { trial: 'trial', monthly: 'monthly', sixmonth: 'half_yearly', yearly: 'yearly' };

const iso = (d) => (d ? d.toISOString().replace('Z', '+00:00') : null);

/**
 * The text the customer pastes into n8n Doctor (Activate / Renew License):
 * base64(JSON record). Identical to what license_generator_tool.py writes, and
 * the signature covers the same fields in the same order (canonical_payload).
 */
export function buildLicenseBlob(lic, user) {
  const record = {
    license_id: lic.licenseId,
    customer_name: user.name,
    customer_email: user.email,
    license_type: APP_TYPE[lic.plan] || lic.plan,
    activation_date: iso(lic.startsAt),
    expiry_date: iso(lic.expiresAt),
    machine_id: lic.machineId,
    product_version: config.productVersion,
  };
  const payload = [
    record.license_id, record.customer_name, record.customer_email, record.license_type,
    record.activation_date, record.expiry_date || '', record.machine_id, record.product_version,
  ].join('\x1f');
  record.signature = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64');
  return Buffer.from(JSON.stringify(record), 'utf8').toString('base64');
}

export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
