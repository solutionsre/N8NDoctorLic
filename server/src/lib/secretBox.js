import crypto from 'node:crypto';
import { config } from '../config.js';

/*
 * AES-256-GCM for secrets saved from the admin panel (payment keys, SMTP
 * password), so a copied database alone does not reveal them. The key comes
 * from SETTINGS_SECRET, or JWT_SECRET when that is not set. Changing that
 * value means entering the saved secrets again.
 */
const key = Buffer.from(
  crypto.hkdfSync('sha256', process.env.SETTINGS_SECRET || config.jwtSecret, 'license-site', 'admin-settings-v1', 32)
);

export function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')}`;
}

export function decrypt(value) {
  if (!value) return '';
  try {
    const raw = Buffer.from(String(value).slice(3), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    console.error('[settings] A saved secret could not be decrypted (JWT_SECRET or SETTINGS_SECRET changed?). Enter it again in the admin panel.');
    return '';
  }
}
