/**
 * Settings edited in the admin panel. Stored in one MongoDB document
 * (Setting "site"), applied on top of the .env values in `config` / `PLANS`
 * when the server starts and right after every save, so changes are live
 * without a restart. Secrets are stored encrypted and never sent back to the
 * browser: the admin panel only learns whether each one is set.
 */
import { config, GATEWAY_URLS, gatewayList, plansOnSale, PLANS } from '../config.js';
import { Setting } from '../models/Setting.js';
import { HttpError } from './http.js';
import { decrypt, encrypt } from './secretBox.js';
import { resetMailer } from './mailer.js';
import { LEGAL_PAGES, publishedLegalPages } from './legal.js';

const DOC_ID = 'site';
export const SECTIONS = ['plans', 'rules', 'payments', 'smtp', 'site', 'legal'];

/* ------------------------------- Validation ------------------------------- */

const bad = (message) => new HttpError(400, message, 'invalid');
const has = (o, k) => o != null && Object.hasOwn(o, k);

function int(v, min, max, label) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${label} must be a whole number from ${min} to ${max}.`);
  return n;
}
function text(v, max, label, required = false) {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  if (required && !s) throw bad(`${label} is required.`);
  if (s.length > max) throw bad(`${label} is too long (${max} characters at most).`);
  return s;
}
const bool = (v) => v === true || v === 'true' || v === 1 || v === '1';
function email(v, label) {
  const s = text(v, 200, label);
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad(`${label} is not a valid e-mail address.`);
  return s;
}
function url(v, label) {
  const s = text(v, 300, label);
  if (s && !/^https?:\/\/[^\s<>"]+$/i.test(s)) throw bad(`${label} must start with https://`);
  return s;
}
/** A secret field: undefined or '' keeps the current value, null clears it. */
function secret(v, current, label) {
  if (v === null) return '';
  if (v === undefined || v === '') return current;
  return text(v, 500, label);
}

/*
 * Each validator takes the admin's input and returns the plain values.
 * `store` turns plain values into what is saved (secrets encrypted) and
 * `apply` puts saved values into config.
 */
const SECTION_DEFS = {
  plans: {
    validate(body) {
      const out = {};
      for (const id of Object.keys(PLANS)) {
        const p = body?.[id] || {};
        out[id] = {
          name: text(p.name, 40, 'Plan name', true),
          days: int(p.days, 1, 3650, `"${p.name || id}" length in days`),
          price: int(p.price, 1, 10_000_000, `"${p.name || id}" price`),
          enabled: bool(p.enabled),
        };
      }
      if (!Object.values(out).some((p) => p.enabled)) throw bad('Keep at least one plan on sale.');
      return out;
    },
    apply(saved) {
      for (const id of Object.keys(PLANS)) {
        if (saved?.[id]) Object.assign(PLANS[id], saved[id]);
      }
    },
  },

  rules: {
    validate(body) {
      let days = body?.reminderDays;
      if (typeof days === 'string') days = days.split(',');
      if (!Array.isArray(days)) days = [];
      const reminderDays = [...new Set(days.map((d) => int(String(d).trim(), 1, 60, 'Reminder day')))].sort((a, b) => b - a);
      if (!reminderDays.length || reminderDays.length > 6) throw bad('Give 1 to 6 reminder days, e.g. 7, 3, 1.');
      return {
        trialDays: int(body?.trialDays, 1, 365, 'Trial length'),
        extendDays: int(body?.extendDays, 1, 30, 'Extension days'),
        extendWindowDays: int(body?.extendWindowDays, 1, 60, 'Extension window'),
        extensionDeducted: bool(body?.extensionDeducted),
        reminderDays,
      };
    },
    apply(saved) {
      for (const k of ['trialDays', 'extendDays', 'extendWindowDays', 'extensionDeducted', 'reminderDays']) {
        if (has(saved, k)) config[k] = saved[k];
      }
    },
  },

  payments: {
    validate(body) {
      const mode = body?.mode;
      if (mode !== 'test' && mode !== 'live') throw bad('Pick test or live mode.');
      const cur = config.payments;
      const k = body.khalti || {};
      const e = body.esewa || {};
      const out = {
        mode,
        khalti: {
          enabled: bool(k.enabled),
          testKey: secret(k.testKey, cur.khalti.testKey, 'Khalti test secret key'),
          liveKey: secret(k.liveKey, cur.khalti.liveKey, 'Khalti live secret key'),
        },
        esewa: {
          enabled: bool(e.enabled),
          testProductCode: text(e.testProductCode, 60, 'eSewa test product code'),
          testSecret: secret(e.testSecret, cur.esewa.testSecret, 'eSewa test secret key'),
          liveProductCode: text(e.liveProductCode, 60, 'eSewa live product code'),
          liveSecret: secret(e.liveSecret, cur.esewa.liveSecret, 'eSewa live secret key'),
        },
      };
      const live = mode === 'live';
      if (out.khalti.enabled && !(live ? out.khalti.liveKey : out.khalti.testKey)) {
        throw bad(`Khalti is switched on but has no ${mode} secret key.`);
      }
      if (out.esewa.enabled) {
        const code = live ? out.esewa.liveProductCode : out.esewa.testProductCode;
        if (!code || !(live ? out.esewa.liveSecret : out.esewa.testSecret)) {
          throw bad(`eSewa is switched on but has no ${mode} product code and secret key.`);
        }
        if (live && code === 'EPAYTEST') throw bad('EPAYTEST is eSewa\'s test merchant. Enter your live merchant code.');
      }
      if (!out.khalti.enabled && !out.esewa.enabled) throw bad('Switch on at least one payment method.');
      return out;
    },
    store(plain) {
      return {
        mode: plain.mode,
        khalti: { ...plain.khalti, testKey: encrypt(plain.khalti.testKey), liveKey: encrypt(plain.khalti.liveKey) },
        esewa: { ...plain.esewa, testSecret: encrypt(plain.esewa.testSecret), liveSecret: encrypt(plain.esewa.liveSecret) },
      };
    },
    apply(saved) {
      const p = config.payments;
      if (has(saved, 'mode')) p.mode = saved.mode === 'live' ? 'live' : 'test';
      const k = saved?.khalti;
      if (k) {
        if (has(k, 'enabled')) p.khalti.enabled = !!k.enabled;
        if (has(k, 'testKey')) p.khalti.testKey = decrypt(k.testKey);
        if (has(k, 'liveKey')) p.khalti.liveKey = decrypt(k.liveKey);
      }
      const e = saved?.esewa;
      if (e) {
        if (has(e, 'enabled')) p.esewa.enabled = !!e.enabled;
        if (has(e, 'testProductCode')) p.esewa.testProductCode = e.testProductCode;
        if (has(e, 'testSecret')) p.esewa.testSecret = decrypt(e.testSecret);
        if (has(e, 'liveProductCode')) p.esewa.liveProductCode = e.liveProductCode;
        if (has(e, 'liveSecret')) p.esewa.liveSecret = decrypt(e.liveSecret);
      }
    },
  },

  smtp: {
    validate(body) {
      const host = text(body?.host, 200, 'SMTP server');
      if (host && !/^[a-z0-9.-]+$/i.test(host)) throw bad('SMTP server must be a host name, e.g. smtp.gmail.com');
      return {
        host,
        // Needed only with a server; an empty host switches e-mail off.
        port: host ? int(body?.port, 1, 65535, 'SMTP port') : Number(body?.port) || 0,
        user: text(body?.user, 200, 'SMTP username'),
        pass: secret(body?.pass, config.smtp.pass, 'SMTP password'),
        from: text(body?.from, 200, 'From address'),
      };
    },
    store: (plain) => ({ ...plain, pass: encrypt(plain.pass) }),
    apply(saved) {
      if (!saved) return;
      for (const k of ['host', 'port', 'user', 'from']) if (has(saved, k)) config.smtp[k] = saved[k];
      if (has(saved, 'pass')) config.smtp.pass = decrypt(saved.pass);
    },
    after: () => resetMailer(),
  },

  site: {
    validate(body) {
      return {
        appName: text(body?.appName, 60, 'Site name', true),
        tagline: text(body?.tagline, 200, 'Tagline'),
        company: text(body?.company, 100, 'Company name'),
        supportEmail: email(body?.supportEmail, 'Support e-mail'),
        phone: text(body?.phone, 40, 'Phone'),
        address: text(body?.address, 200, 'Address'),
        facebook: url(body?.facebook, 'Facebook link'),
        instagram: url(body?.instagram, 'Instagram link'),
        youtube: url(body?.youtube, 'YouTube link'),
        x: url(body?.x, 'X (Twitter) link'),
        linkedin: url(body?.linkedin, 'LinkedIn link'),
      };
    },
    apply(saved) {
      if (!saved) return;
      if (saved.appName) config.appName = saved.appName;
      for (const k of Object.keys(config.site)) if (has(saved, k)) config.site[k] = saved[k];
    },
  },

  legal: {
    validate(body) {
      const out = {};
      for (const page of Object.keys(LEGAL_PAGES)) {
        const s = typeof body?.[page] === 'string' ? body[page].replace(/\r\n/g, '\n').trim() : '';
        if (s.length > 30_000) throw bad(`${LEGAL_PAGES[page]} is too long.`);
        out[page] = s;
      }
      return out;
    },
    apply(saved) {
      if (saved) for (const k of Object.keys(config.legal)) if (has(saved, k)) config.legal[k] = saved[k];
    },
  },
};

/* --------------------------------- Loading -------------------------------- */

/** Reads saved settings into config. Call once after connecting to MongoDB. */
export async function loadSettings() {
  const doc = await Setting.findById(DOC_ID).lean();
  const data = doc?.data || {};
  for (const section of SECTIONS) {
    if (data[section]) SECTION_DEFS[section].apply(data[section]);
  }
  resetMailer();
}

/** Validates, saves and applies one section. Returns a short summary for the admin log. */
export async function saveSection(section, body) {
  const def = SECTION_DEFS[section];
  if (!def) throw new HttpError(404, 'Unknown settings section.');
  const plain = def.validate(body || {});
  const stored = def.store ? def.store(plain) : plain;
  await Setting.updateOne({ _id: DOC_ID }, { $set: { [`data.${section}`]: stored } }, { upsert: true });
  def.apply(stored);
  def.after?.();
  return section === 'payments' ? `mode ${plain.mode}` : '';
}

/* ------------------------------- Read views ------------------------------- */

/** Everything the public website needs. No secrets. */
export function publicSettings() {
  const { auth, site } = config;
  return {
    appName: config.appName,
    timezone: config.timezone,
    locale: config.locale,
    currency: config.currency,
    plans: plansOnSale().map(({ id, name, days, price }) => ({ id, name, days, price })),
    gateways: gatewayList().filter((g) => g.enabled).map(({ id, name }) => ({ id, name })),
    paymentMode: config.payments.mode,
    trialDays: config.trialDays,
    extendDays: config.extendDays,
    extendWindowDays: config.extendWindowDays,
    extensionDeducted: config.extensionDeducted,
    reminderDays: config.reminderDays,
    auth: {
      passwordMinLength: auth.passwordMinLength,
      maxFailedLogins: auth.maxFailedLogins,
      lockMinutes: auth.lockMinutes,
      codeMinutes: auth.codeMinutes,
      resendSeconds: auth.resendSeconds,
      resetMinutes: auth.resetMinutes,
    },
    site: { ...site },
    legalPages: publishedLegalPages().map((id) => ({ id, title: LEGAL_PAGES[id] })),
  };
}

/** The admin panel's view: all editable values, secrets replaced by "is it set". */
export function adminSettings() {
  const p = config.payments;
  return {
    plans: Object.fromEntries(Object.values(PLANS).map((pl) => [pl.id, { ...pl }])),
    rules: {
      trialDays: config.trialDays,
      extendDays: config.extendDays,
      extendWindowDays: config.extendWindowDays,
      extensionDeducted: config.extensionDeducted,
      reminderDays: config.reminderDays,
    },
    payments: {
      mode: p.mode,
      khalti: { enabled: p.khalti.enabled, testKeySet: !!p.khalti.testKey, liveKeySet: !!p.khalti.liveKey },
      esewa: {
        enabled: p.esewa.enabled,
        testProductCode: p.esewa.testProductCode,
        testSecretSet: !!p.esewa.testSecret,
        liveProductCode: p.esewa.liveProductCode,
        liveSecretSet: !!p.esewa.liveSecret,
      },
      urls: GATEWAY_URLS,
      callbackBase: config.serverUrl,
    },
    smtp: { host: config.smtp.host, port: config.smtp.port, user: config.smtp.user, from: config.smtp.from, passSet: !!config.smtp.pass },
    site: { appName: config.appName, ...config.site },
    legal: Object.fromEntries(Object.keys(LEGAL_PAGES).map((k) => [k, config.legal[k] || ''])),
    legalTitles: LEGAL_PAGES,
  };
}
