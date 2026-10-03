import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { config, GATEWAY_URLS } from './config.js';
import adminRoutes from './routes/admin.js';
import { loadSettings } from './lib/settings.js';
import authRoutes from './routes/auth.js';
import licenseRoutes from './routes/licenses.js';
import paymentRoutes from './routes/payments.js';
import { startDailyJobs } from './jobs/daily.js';
import { HttpError } from './lib/http.js';

const app = express();
// Real client IPs for rate limits, only from the proxies we actually have (TRUST_PROXY).
app.set('trust proxy', config.trustProxy);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        // The eSewa checkout is a form POST to eSewa's site (test or live, switched in the admin panel).
        formAction: ["'self'", new URL(GATEWAY_URLS.test.esewaForm).origin, new URL(GATEWAY_URLS.live.esewaForm).origin],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    referrerPolicy: { policy: 'same-origin' },
  })
);
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

// CSRF guard: browser calls that change something must carry a header that
// other websites cannot add without a CORS preflight (which we never allow).
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'fetch') {
    return res.status(403).json({ error: 'Request blocked. Reload the page and try again.', code: 'csrf' });
  }
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api', licenseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Production: serve the built React app from ../client/dist.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Duplicate key (e.g. two sign-ups with one e-mail at the same moment).
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'This already exists. Reload the page and try again.', code: 'duplicate' });
  }
  const known = err instanceof HttpError;
  // Body-parser errors (bad JSON, too large) carry a 4xx status and a safe message.
  const status = known || (err.status >= 400 && err.status < 500) ? err.status : 500;
  if (status >= 500) console.error(err);
  // Only our own HttpError messages reach the browser; anything else could leak internals.
  res.status(status).json({
    error: known ? err.message : status < 500 ? 'The request could not be read.' : 'Something went wrong.',
    code: known ? err.code : 'error',
  });
});

await mongoose.connect(config.mongoUri);
await loadSettings(); // Admin-panel settings on top of .env.
startDailyJobs();
app.listen(config.port, config.host, () => console.log(`License server on http://${config.host}:${config.port}`));
