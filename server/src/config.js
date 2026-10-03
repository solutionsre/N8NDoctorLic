import 'dotenv/config';

/*
 * Every value comes from .env (or, for the editable ones, from the admin
 * panel, which overrides .env: lib/settings.js). Nothing falls back to a value
 * written in the code: a missing setting stops the server with the full list
 * of what to add (see .env.example).
 */
const missing = [];
const invalid = [];

function need(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) missing.push(name);
  return value;
}

/** Optional text: empty when not set. */
const opt = (name) => String(process.env[name] ?? '').trim();

function int(name) {
  const raw = need(name);
  const n = Number(raw);
  if (raw && (!Number.isInteger(n) || n <= 0)) invalid.push(`${name} must be a whole number above 0 (now "${raw}")`);
  return n;
}

function bool(name) {
  const raw = need(name).toLowerCase();
  if (raw && raw !== 'true' && raw !== 'false') invalid.push(`${name} must be true or false (now "${raw}")`);
  return raw === 'true';
}

/** "7,3,1" -> [7, 3, 1] */
function intList(name) {
  const raw = need(name);
  const list = raw.split(',').map((v) => Number(v.trim()));
  if (raw && !list.every((n) => Number.isInteger(n) && n > 0)) invalid.push(`${name} must be whole numbers separated by commas (now "${raw}")`);
  return list;
}

/**
 * Express "trust proxy": how many proxies sit in front of this server.
 * 1 = one (nginx, ngrok, Render ...). false = none: X-Forwarded-For from the
 * visitor is then ignored, so nobody can fake their IP to dodge rate limits.
 * Also accepts Express names such as "loopback".
 */
function trustProxy(name) {
  const v = need(name).toLowerCase();
  if (v === 'false' || v === '0') return false;
  if (v === 'true') return true;
  return /^\d+$/.test(v) ? Number(v) : v;
}

const timezone = need('TIMEZONE');
if (timezone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    // Server-side Date output (logs, toString) uses the same zone as the website.
    process.env.TZ = timezone;
  } catch {
    invalid.push(`TIMEZONE "${timezone}" is not a valid IANA time zone (Nepal: Asia/Kathmandu)`);
  }
}

/** Gateway addresses per mode. Test = sandbox (test wallets, no real money), live = real money. */
export const GATEWAY_URLS = {
  test: {
    khalti: 'https://dev.khalti.com/api/v2',
    esewaForm: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
    esewaStatus: 'https://rc.esewa.com.np/api/epay/transaction/status/',
  },
  live: {
    khalti: 'https://khalti.com/api/v2',
    esewaForm: 'https://epay.esewa.com.np/api/epay/main/v2/form',
    esewaStatus: 'https://esewa.com.np/api/epay/transaction/status/',
  },
};

/** Starting payment settings from .env; Admin → Settings → Payments overrides them. */
function envPayments() {
  const mode = need('PAYMENT_MODE');
  if (mode && mode !== 'test' && mode !== 'live') invalid.push(`PAYMENT_MODE must be test or live (now "${mode}")`);
  const p = {
    mode: mode === 'live' ? 'live' : 'test',
    khalti: { testKey: opt('KHALTI_TEST_KEY'), liveKey: opt('KHALTI_LIVE_KEY') },
    esewa: {
      testProductCode: opt('ESEWA_TEST_PRODUCT_CODE'),
      testSecret: opt('ESEWA_TEST_SECRET'),
      liveProductCode: opt('ESEWA_LIVE_PRODUCT_CODE'),
      liveSecret: opt('ESEWA_LIVE_SECRET'),
    },
  };
  p.khalti.enabled = !!(p.khalti.testKey || p.khalti.liveKey);
  p.esewa.enabled = !!(p.esewa.testSecret || p.esewa.liveSecret);
  return p;
}

export const config = {
  isProd: need('NODE_ENV') === 'production',
  port: int('PORT'),
  // 127.0.0.1 behind nginx on the same machine, so the plain-http port is not public.
  host: need('HOST'),
  trustProxy: trustProxy('TRUST_PROXY'),
  mongoUri: need('MONGODB_URI'),
  jwtSecret: need('JWT_SECRET'),
  clientUrl: need('CLIENT_URL').replace(/\/$/, ''),
  serverUrl: need('SERVER_URL').replace(/\/$/, ''),
  licensePrivateKeyHex: need('LICENSE_PRIVATE_KEY_HEX'),
  productVersion: need('PRODUCT_VERSION'),

  appName: need('APP_NAME'),
  timezone,
  locale: need('LOCALE'),
  currency: need('CURRENCY_LABEL'),

  trialDays: int('TRIAL_DAYS'),
  extendDays: int('EXTEND_DAYS'),
  extendWindowDays: int('EXTEND_WINDOW_DAYS'),
  extensionDeducted: bool('EXTENSION_DEDUCTED'),
  reminderDays: intList('REMINDER_DAYS'),
  reminderCron: need('REMINDER_CRON'),

  auth: {
    passwordMinLength: int('PASSWORD_MIN_LENGTH'),
    maxFailedLogins: int('MAX_FAILED_LOGINS'),
    lockMinutes: int('LOCK_MINUTES'),
    codeMinutes: int('CODE_MINUTES'),
    codeAttempts: int('CODE_ATTEMPTS'),
    resendSeconds: int('RESEND_SECONDS'),
    resetMinutes: int('RESET_MINUTES'),
  },

  payments: envPayments(),

  // Optional: without SMTP, e-mails are printed to the server console.
  smtp: {
    host: opt('SMTP_HOST'),
    port: opt('SMTP_PORT') ? Number(opt('SMTP_PORT')) : 0,
    user: opt('SMTP_USER'),
    pass: opt('SMTP_PASS'),
    from: opt('MAIL_FROM'),
  },

  // Footer and contact details: empty until set in Admin → Settings → Site.
  site: {
    tagline: opt('SITE_TAGLINE'),
    company: opt('SITE_COMPANY'),
    supportEmail: opt('SITE_SUPPORT_EMAIL'),
    phone: opt('SITE_PHONE'),
    address: opt('SITE_ADDRESS'),
    facebook: '',
    instagram: '',
    youtube: '',
    x: '',
    linkedin: '',
  },
  // Legal pages: written in Admin → Settings → Legal pages; an empty page is not shown.
  legal: { terms: '', privacy: '', refund: '' },
};

/** Paid plans. Each purchase is one license key for one machine. Edited in Admin → Settings → Pricing. */
export const PLANS = {
  monthly: { id: 'monthly', name: need('PLAN_MONTHLY_NAME'), days: int('DAYS_MONTHLY'), price: int('PRICE_MONTHLY'), enabled: true },
  sixmonth: { id: 'sixmonth', name: need('PLAN_SIXMONTH_NAME'), days: int('DAYS_SIXMONTH'), price: int('PRICE_SIXMONTH'), enabled: true },
  yearly: { id: 'yearly', name: need('PLAN_YEARLY_NAME'), days: int('DAYS_YEARLY'), price: int('PRICE_YEARLY'), enabled: true },
};

if (missing.length || invalid.length) {
  const lines = [...missing.map((n) => `${n} is not set`), ...invalid];
  throw new Error(`Fix server/.env (see .env.example):\n - ${lines.join('\n - ')}`);
}

/** Plans customers can buy right now. */
export const plansOnSale = () => Object.values(PLANS).filter((p) => p.enabled);

export const GATEWAYS = ['khalti', 'esewa'];

/** The paid plan with this id, or null (never an Object.prototype key like "constructor"). */
export const planById = (id) => (typeof id === 'string' && Object.hasOwn(PLANS, id) ? PLANS[id] : null);

/** Credentials and addresses of one gateway in a mode (default: the current mode). */
export function gatewayConfig(id, mode) {
  const p = config.payments;
  const m = mode === 'live' || mode === 'test' ? mode : p.mode;
  const urls = GATEWAY_URLS[m];
  const live = m === 'live';
  if (id === 'khalti') {
    return { mode: m, enabled: p.khalti.enabled, secretKey: live ? p.khalti.liveKey : p.khalti.testKey, baseUrl: urls.khalti };
  }
  return {
    mode: m,
    enabled: p.esewa.enabled,
    productCode: live ? p.esewa.liveProductCode : p.esewa.testProductCode,
    secretKey: live ? p.esewa.liveSecret : p.esewa.testSecret,
    formUrl: urls.esewaForm,
    statusUrl: urls.esewaStatus,
  };
}

/** Switched on and has the credentials it needs in that mode. */
export function gatewayReady(id, mode) {
  const g = gatewayConfig(id, mode);
  return !!(g.enabled && g.secretKey && (id === 'khalti' || g.productCode));
}

/**
 * With NODE_ENV=production, refuses to start on settings that are only safe
 * for testing. Payment test mode and SMTP are set in the admin panel, whose
 * Overview page warns about them.
 */
function checkProduction() {
  if (!config.isProd) return;
  const problems = [];
  const https = (name, url) => {
    if (!/^https:\/\//.test(url) || /localhost|127\.0\.0\.1|ngrok/.test(url)) {
      problems.push(`${name} must be your public https address (now "${url}")`);
    }
  };
  https('CLIENT_URL', config.clientUrl);
  https('SERVER_URL', config.serverUrl);
  if (config.jwtSecret.length < 32 || config.jwtSecret === 'change-me') {
    problems.push('JWT_SECRET must be a long random string (at least 32 characters)');
  }
  if (problems.length) {
    throw new Error(`Not safe to run in production:\n - ${problems.join('\n - ')}\n(see .env.example)`);
  }
}
checkProduction();

const GATEWAY_NAMES = { khalti: 'Khalti', esewa: 'eSewa' };

/** Gateways ready in the current mode; the others are hidden on the website. */
export const gatewayList = () => GATEWAYS.map((id) => ({ id, name: GATEWAY_NAMES[id], enabled: gatewayReady(id) }));

export const gatewayName = (id) => GATEWAY_NAMES[id] || id;

/** Date + time in the configured time zone with its name, e.g. "29 Sept 2026, 3:15 pm Nepal Time" (e-mails). */
export function formatDate(d) {
  return new Date(d).toLocaleString(config.locale, {
    timeZone: config.timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'long',
  });
}
