/**
 * Admin panel API. Admins manage users, licenses and payments; super admins
 * also site settings (pricing, payment mode and keys, SMTP, site, legal pages)
 * and roles. Every change is written to the AdminLog.
 */
import { Router } from 'express';
import os from 'node:os';
import mongoose from 'mongoose';
import { config, gatewayList, gatewayName, planById, PLANS } from '../config.js';
import { User } from '../models/User.js';
import { License } from '../models/License.js';
import { Payment } from '../models/Payment.js';
import { TrialMachine } from '../models/TrialMachine.js';
import { normalizeMachineId } from '../lib/machine.js';
import { AdminLog } from '../models/AdminLog.js';
import { HttpError, wrap } from '../lib/http.js';
import { requireAdmin, requireSuperAdmin, requireUser } from '../middleware/auth.js';
import { DAY, displayKey, newLicenseId, toPublic as licensePublic } from '../lib/licenseService.js';
import { adminSettings, saveSection, SECTIONS } from '../lib/settings.js';
import { mailStatus, sendTestMail } from '../lib/mailer.js';

const router = Router();
router.use(requireUser, requireAdmin);

const PER_PAGE = 25;
const ROLES = ['user', 'admin', 'superadmin'];

/* -------------------------------- Helpers -------------------------------- */

const pageOf = (req) => Math.min(10_000, Math.max(1, parseInt(req.query.page, 10) || 1));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const searchRe = (q) => {
  const s = String(q || '').trim().slice(0, 100);
  return s ? new RegExp(escapeRe(s), 'i') : null;
};
const reasonOf = (v) => String(v || '').trim().slice(0, 300);

async function audit(req, action, targetType, targetId, note = '') {
  await AdminLog.create({ admin: req.user._id, adminEmail: req.user.email, action, targetType, targetId: String(targetId || ''), note });
}

async function findUser(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'User not found.');
  const user = await User.findById(id);
  if (!user) throw new HttpError(404, 'User not found.');
  return user;
}

async function findLicense(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'License not found.');
  const lic = await License.findById(id);
  if (!lic) throw new HttpError(404, 'License not found.');
  return lic;
}

/** Admins act on customers only; super admins on anyone but themselves. */
function assertCanManage(req, target) {
  if (String(target._id) === String(req.user._id)) throw new HttpError(400, 'You cannot do this to your own account.');
  if (req.user.role !== 'superadmin' && (target.role || 'user') !== 'user') {
    throw new HttpError(403, 'Only a super admin can change another admin.');
  }
}

const userRow = (u) => ({
  ...u.toPublic(),
  blockedReason: u.blockedReason || '',
  blockedAt: u.blockedAt,
  lockedUntil: u.lockUntil && u.lockUntil > new Date() ? u.lockUntil : null,
});

const licenseRow = (lic) => ({
  ...licensePublic(lic),
  user: lic.user && lic.user.email ? { id: lic.user._id, name: lic.user.name, email: lic.user.email } : lic.user,
  blockedAt: lic.blockedAt,
  createdAt: lic.createdAt,
});

const paymentRow = (p) => ({
  id: p._id,
  orderId: p.orderId,
  user: p.user && p.user.email ? { id: p.user._id, name: p.user.name, email: p.user.email } : p.user,
  plan: PLANS[p.plan]?.name || p.plan,
  gateway: p.gateway,
  gatewayName: gatewayName(p.gateway),
  gatewayRef: p.gatewayRef,
  amount: p.amount,
  mode: p.mode,
  status: p.status,
  isRenewal: p.isRenewal,
  license: p.license,
  createdAt: p.createdAt,
  completedAt: p.completedAt,
});

/** "2026-09-30" in the site's time zone. */
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** Start of this calendar month in the site's time zone (the process runs in it: config.js sets TZ). */
const monthStart = (now) => new Date(now.getFullYear(), now.getMonth(), 1);

/** Last `n` days as [{ day, value }], oldest first, from Mongo groups keyed by day. */
function dailySeries(groups, n, now) {
  const map = new Map(groups.map((g) => [g._id, g.value]));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = dayKey(new Date(now.getTime() - i * DAY));
    out.push({ day, value: map.get(day) || 0 });
  }
  return out;
}

/* ------------------------------- Overview -------------------------------- */

router.get(
  '/overview',
  wrap(async (req, res) => {
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * DAY);
    const month = monthStart(now);
    const tz = config.timezone;
    const byDay = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: tz } });

    const t0 = Date.now();
    await mongoose.connection.db.admin().ping();
    const dbPingMs = Date.now() - t0;

    const [
      users, verified, blockedUsers, admins, newUsers30,
      trialsActive, paidActive, expiringSoon, expired, blockedLicenses, sitesActive, checkedToday,
      revenue, paymentStats, signupsDaily, revenueDaily, planMix, recentPayments, recentLog,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ emailVerified: { $ne: false } }),
      User.countDocuments({ blocked: true }),
      User.countDocuments({ role: { $in: ['admin', 'superadmin'] } }),
      User.countDocuments({ createdAt: { $gte: since30 } }),
      License.countDocuments({ status: 'active', plan: 'trial', expiresAt: { $gt: now } }),
      License.countDocuments({ status: 'active', plan: { $ne: 'trial' }, expiresAt: { $gt: now } }),
      License.countDocuments({ status: 'active', expiresAt: { $gt: now, $lte: new Date(now.getTime() + config.extendWindowDays * DAY) } }),
      License.countDocuments({ status: 'active', expiresAt: { $lte: now } }),
      License.countDocuments({ status: 'revoked' }),
      License.countDocuments({ status: 'active', expiresAt: { $gt: now } }),
      License.countDocuments({ lastDownloadAt: { $gte: new Date(now.getTime() - DAY) } }),
      Payment.aggregate([
        { $match: { status: 'completed', mode: 'live' } },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
            month: { $sum: { $cond: [{ $gte: ['$completedAt', month] }, '$amount', 0] } },
            last30: { $sum: { $cond: [{ $gte: ['$completedAt', since30] }, '$amount', 0] } },
          },
        },
      ]),
      // Payments from before the mode field existed count as test.
      Payment.aggregate([{ $group: { _id: { status: '$status', mode: { $ifNull: ['$mode', 'test'] } }, count: { $sum: 1 } } }]),
      User.aggregate([{ $match: { createdAt: { $gte: since30 } } }, { $group: { _id: byDay('createdAt'), value: { $sum: 1 } } }]),
      Payment.aggregate([
        { $match: { status: 'completed', mode: 'live', completedAt: { $gte: since30 } } },
        { $group: { _id: byDay('completedAt'), value: { $sum: '$amount' } } },
      ]),
      License.aggregate([
        { $match: { status: 'active', expiresAt: { $gt: now } } },
        { $group: { _id: '$plan', count: { $sum: 1 } } },
      ]),
      Payment.find().sort({ createdAt: -1 }).limit(8).populate('user', 'name email'),
      AdminLog.find().sort({ createdAt: -1 }).limit(12),
    ]);

    const rev = revenue[0] || { total: 0, count: 0, month: 0, last30: 0 };
    const payCount = (status, mode) => paymentStats.filter((s) => s._id.status === status && (!mode || s._id.mode === mode)).reduce((a, s) => a + s.count, 0);

    // Things an admin should fix, most serious first.
    const warnings = [];
    const gateways = gatewayList();
    if (config.payments.mode === 'test') {
      warnings.push({
        level: config.isProd ? 'bad' : 'warn',
        text: 'Payments are in TEST mode: customers pay with sandbox wallets and no real money arrives. Switch to live in Settings → Payments.',
      });
    }
    if (!gateways.some((g) => g.enabled)) warnings.push({ level: 'bad', text: 'No payment method is ready, so nobody can buy a license.' });
    const mail = mailStatus();
    if (!mail.enabled) warnings.push({ level: 'bad', text: 'SMTP is not set up: confirmation and reset codes are not e-mailed. Set it in Settings → E-mail.' });
    else if (mail.lastError) warnings.push({ level: 'warn', text: `The last e-mail failed: ${mail.lastError.message}` });
    if (!config.isProd) warnings.push({ level: 'warn', text: 'The server runs with NODE_ENV=development. Use production when the site is live.' });

    const mem = process.memoryUsage();
    res.json({
      users: { total: users, verified, blocked: blockedUsers, admins, new30: newUsers30 },
      licenses: { trialsActive, paidActive, expiringSoon, expired, blocked: blockedLicenses, sitesActive, checkedToday },
      revenue: { total: rev.total, count: rev.count, month: rev.month, last30: rev.last30 },
      payments: {
        completedLive: payCount('completed', 'live'),
        completedTest: payCount('completed', 'test'),
        pending: payCount('pending'),
        failed: payCount('failed'),
      },
      planMix: planMix.map((p) => ({ plan: p._id, name: p._id === 'trial' ? 'Free trial' : PLANS[p._id]?.name || p._id, count: p.count })),
      series: {
        signups: dailySeries(signupsDaily, 30, now),
        revenue: dailySeries(revenueDaily, 30, now),
      },
      recentPayments: recentPayments.map(paymentRow),
      recentLog,
      warnings,
      system: {
        env: config.isProd ? 'production' : 'development',
        node: process.version,
        uptimeSec: Math.round(process.uptime()),
        memoryMb: { rss: Math.round(mem.rss / 1048576), heapUsed: Math.round(mem.heapUsed / 1048576) },
        load: os.loadavg().map((n) => Math.round(n * 100) / 100),
        cpus: os.cpus().length,
        db: { connected: mongoose.connection.readyState === 1, pingMs: dbPingMs },
        mail: { enabled: mail.enabled, host: mail.host, lastError: mail.lastError },
        paymentMode: config.payments.mode,
        gateways,
        timezone: config.timezone,
      },
    });
  })
);

/* --------------------------------- Users --------------------------------- */

router.get(
  '/users',
  wrap(async (req, res) => {
    const filter = {};
    const re = searchRe(req.query.q);
    if (re) filter.$or = [{ email: re }, { name: re }];
    const f = String(req.query.filter || '');
    if (f === 'blocked') filter.blocked = true;
    else if (f === 'admins') filter.role = { $in: ['admin', 'superadmin'] };
    else if (f === 'unverified') filter.emailVerified = false;
    else if (f === 'trial') filter.trialUsed = true;

    const page = pageOf(req);
    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PER_PAGE).limit(PER_PAGE),
    ]);
    const now = new Date();
    const counts = await License.aggregate([
      { $match: { user: { $in: users.map((u) => u._id) } } },
      {
        $group: {
          _id: '$user',
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'active'] }, { $gt: ['$expiresAt', now] }] }, 1, 0] } },
        },
      },
    ]);
    const byUser = new Map(counts.map((c) => [String(c._id), c]));
    res.json({
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PER_PAGE)),
      users: users.map((u) => ({ ...userRow(u), licenseCount: byUser.get(String(u._id))?.total || 0, activeLicenses: byUser.get(String(u._id))?.active || 0 })),
    });
  })
);

router.get(
  '/users/:id',
  wrap(async (req, res) => {
    const user = await findUser(req.params.id);
    const [licenses, payments, trialDomains] = await Promise.all([
      License.find({ user: user._id }).sort({ createdAt: -1 }),
      Payment.find({ user: user._id }).sort({ createdAt: -1 }).limit(100),
      TrialMachine.find({ user: user._id }).sort({ createdAt: -1 }),
    ]);
    res.json({
      user: userRow(user),
      licenses: licenses.map((l) => ({ ...licenseRow(l), history: l.history.slice(-20).reverse() })),
      payments: payments.map(paymentRow),
      trialMachines: trialDomains.map((t) => ({ machineId: t.machineId, at: t.createdAt })),
    });
  })
);

router.post(
  '/users/:id/block',
  wrap(async (req, res) => {
    const user = await findUser(req.params.id);
    assertCanManage(req, user);
    user.blocked = true;
    user.blockedReason = reasonOf(req.body.reason);
    user.blockedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Logs them out everywhere.
    await user.save();
    await audit(req, 'user.block', 'user', user._id, `${user.email}${user.blockedReason ? `: ${user.blockedReason}` : ''}`);
    res.json({ user: userRow(user) });
  })
);

router.post(
  '/users/:id/unblock',
  wrap(async (req, res) => {
    const user = await findUser(req.params.id);
    assertCanManage(req, user);
    user.blocked = false;
    user.blockedReason = '';
    user.blockedAt = null;
    await user.save();
    await audit(req, 'user.unblock', 'user', user._id, user.email);
    res.json({ user: userRow(user) });
  })
);

router.post(
  '/users/:id/verify',
  wrap(async (req, res) => {
    const user = await findUser(req.params.id);
    user.emailVerified = true;
    user.verifyCodeHash = null;
    user.verifyCodeExpires = null;
    await user.save();
    await audit(req, 'user.verify', 'user', user._id, user.email);
    res.json({ user: userRow(user) });
  })
);

/** Ends a "too many wrong passwords" lock. */
router.post(
  '/users/:id/unlock',
  wrap(async (req, res) => {
    const user = await findUser(req.params.id);
    user.failedLogins = 0;
    user.lockUntil = null;
    await user.save();
    await audit(req, 'user.unlock', 'user', user._id, user.email);
    res.json({ user: userRow(user) });
  })
);

router.post(
  '/users/:id/role',
  requireSuperAdmin,
  wrap(async (req, res) => {
    const user = await findUser(req.params.id);
    assertCanManage(req, user);
    const role = String(req.body.role || '');
    if (!ROLES.includes(role)) throw new HttpError(400, 'Pick user, admin or super admin.');
    const before = user.role || 'user';
    user.role = role;
    if (role !== 'user') user.emailVerified = true;
    await user.save();
    await audit(req, 'user.role', 'user', user._id, `${user.email}: ${before} → ${role}`);
    res.json({ user: userRow(user) });
  })
);

/**
 * Removes the user's free trial license(s). n8n Doctor on that machine locks when
 * the trial ends. With allowNew the account (and the trial's machines) may
 * start a new trial; without it the trial stays used up.
 */
router.post(
  '/users/:id/trial/remove',
  wrap(async (req, res) => {
    const user = await findUser(req.params.id);
    const allowNew = req.body.allowNew === true;
    const trials = await License.find({ user: user._id, plan: 'trial' });
    await License.deleteMany({ _id: { $in: trials.map((t) => t._id) } });
    if (allowNew) {
      await TrialMachine.deleteMany({ $or: [{ user: user._id }, { license: { $in: trials.map((t) => t._id) } }] });
      user.trialUsed = false;
      await user.save();
    }
    await audit(
      req,
      allowNew ? 'trial.reset' : 'trial.remove',
      'user',
      user._id,
      `${user.email}: ${trials.length} trial license(s) removed${allowNew ? ', new trial allowed' : ''}`
    );
    res.json({ user: userRow(user), removed: trials.length });
  })
);

/** Gives the user a license without payment (a paid plan, or a trial). */
router.post(
  '/users/:id/licenses',
  wrap(async (req, res) => {
    const user = await findUser(req.params.id);
    const planId = String(req.body.plan || '');
    const plan = planId === 'trial' ? { id: 'trial', name: 'Free trial', days: config.trialDays } : planById(planId);
    if (!plan) throw new HttpError(400, 'Pick a plan.');
    const days = req.body.days === undefined || req.body.days === '' ? plan.days : Number(req.body.days);
    if (!Number.isInteger(days) || days < 1 || days > 3650) throw new HttpError(400, 'Days must be a whole number from 1 to 3650.');
    const machineId = normalizeMachineId(req.body.machineId);
    if (!machineId) throw new HttpError(400, 'Enter a valid Machine ID.');
    if (await License.exists({ machineId })) throw new HttpError(400, 'That machine already has a license.');
    const now = new Date();
    const licenseId = newLicenseId();
    const lic = new License({ user: user._id, licenseId, key: displayKey(licenseId, plan.id), machineId, plan: plan.id, startsAt: now, expiresAt: new Date(now.getTime() + days * DAY) });
    lic.log('grant', `${plan.name}, ${days} days, given by admin ${req.user.email}`);
    await lic.save();
    await audit(req, 'license.grant', 'license', lic._id, `${user.email}: ${plan.name}, ${days} days (${lic.key})`);
    res.status(201).json({ license: licenseRow(lic) });
  })
);

/* -------------------------------- Licenses ------------------------------- */

router.get(
  '/licenses',
  wrap(async (req, res) => {
    const now = new Date();
    const filter = {};
    const s = String(req.query.status || '');
    if (s === 'active') Object.assign(filter, { status: 'active', expiresAt: { $gt: now } });
    else if (s === 'expired') Object.assign(filter, { status: 'active', expiresAt: { $lte: now } });
    else if (s === 'blocked') filter.status = 'revoked';
    else if (s === 'expiring') Object.assign(filter, { status: 'active', expiresAt: { $gt: now, $lte: new Date(now.getTime() + config.extendWindowDays * DAY) } });
    const p = String(req.query.plan || '');
    if (p === 'trial') filter.plan = 'trial';
    else if (p === 'paid') filter.plan = { $ne: 'trial' };

    const re = searchRe(req.query.q);
    if (re) {
      const users = await User.find({ $or: [{ email: re }, { name: re }] }, '_id').limit(500);
      filter.$or = [{ key: re }, { machineId: re }, { user: { $in: users.map((u) => u._id) } }];
    }
    const page = pageOf(req);
    const [total, licenses] = await Promise.all([
      License.countDocuments(filter),
      License.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PER_PAGE).limit(PER_PAGE).populate('user', 'name email'),
    ]);
    res.json({ total, page, pages: Math.max(1, Math.ceil(total / PER_PAGE)), licenses: licenses.map(licenseRow) });
  })
);

router.post(
  '/licenses/:id/block',
  wrap(async (req, res) => {
    const lic = await findLicense(req.params.id);
    lic.status = 'revoked';
    lic.blockedReason = reasonOf(req.body.reason);
    lic.blockedAt = new Date();
    lic.log('block', `Blocked by admin ${req.user.email}${lic.blockedReason ? `: ${lic.blockedReason}` : ''}`);
    await lic.save();
    await audit(req, 'license.block', 'license', lic._id, `${lic.key}${lic.blockedReason ? `: ${lic.blockedReason}` : ''}`);
    res.json({ license: licenseRow(lic) });
  })
);

router.post(
  '/licenses/:id/unblock',
  wrap(async (req, res) => {
    const lic = await findLicense(req.params.id);
    lic.status = 'active';
    lic.blockedReason = '';
    lic.blockedAt = null;
    lic.log('unblock', `Unblocked by admin ${req.user.email}`);
    await lic.save();
    await audit(req, 'license.unblock', 'license', lic._id, lic.key);
    res.json({ license: licenseRow(lic) });
  })
);

/** Adds (or with a negative number, removes) days. */
router.post(
  '/licenses/:id/extend',
  wrap(async (req, res) => {
    const lic = await findLicense(req.params.id);
    const days = Number(req.body.days);
    if (!Number.isInteger(days) || days === 0 || Math.abs(days) > 3650) throw new HttpError(400, 'Days must be a whole number from -3650 to 3650, not 0.');
    lic.expiresAt = new Date(lic.expiresAt.getTime() + days * DAY);
    lic.remindersSent = [];
    lic.log('admin-extend', `${days > 0 ? '+' : ''}${days} days by admin ${req.user.email}`);
    await lic.save();
    await audit(req, 'license.extend', 'license', lic._id, `${lic.key}: ${days > 0 ? '+' : ''}${days} days`);
    res.json({ license: licenseRow(lic) });
  })
);

/** Moves a license to another machine (hardware change). Body: { machineId }. */
router.post(
  '/licenses/:id/machine',
  wrap(async (req, res) => {
    const lic = await findLicense(req.params.id);
    const machineId = normalizeMachineId(req.body.machineId);
    if (!machineId) throw new HttpError(400, 'Not a valid Machine ID.');
    if (machineId === lic.machineId) return res.json({ license: licenseRow(lic) });
    if (await License.exists({ machineId })) throw new HttpError(400, 'That machine already has a license.');
    const old = lic.machineId;
    lic.log('machine', `Machine changed ${old} -> ${machineId} by admin ${req.user.email}`);
    lic.machineId = machineId;
    await lic.save();
    await audit(req, 'license.machine', 'license', lic._id, `${lic.key}: ${old} -> ${machineId}`);
    res.json({ license: licenseRow(lic) });
  })
);

/* -------------------------------- Payments ------------------------------- */

router.get(
  '/payments',
  wrap(async (req, res) => {
    const filter = {};
    const status = String(req.query.status || '');
    if (['pending', 'completed', 'failed'].includes(status)) filter.status = status;
    const mode = String(req.query.mode || '');
    if (mode === 'live') filter.mode = 'live';
    else if (mode === 'test') filter.mode = { $in: ['test', null] }; // null: older payments
    const gateway = String(req.query.gateway || '');
    if (['khalti', 'esewa'].includes(gateway)) filter.gateway = gateway;
    const re = searchRe(req.query.q);
    if (re) {
      const users = await User.find({ $or: [{ email: re }, { name: re }] }, '_id').limit(500);
      filter.$or = [{ orderId: re }, { gatewayRef: re }, { user: { $in: users.map((u) => u._id) } }];
    }
    const page = pageOf(req);
    const [total, payments, sum] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PER_PAGE).limit(PER_PAGE).populate('user', 'name email'),
      Payment.aggregate([{ $match: { ...filter, status: 'completed' } }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
    ]);
    res.json({ total, page, pages: Math.max(1, Math.ceil(total / PER_PAGE)), completedAmount: sum[0]?.amount || 0, payments: payments.map(paymentRow) });
  })
);

/* ----------------------------- Log & settings ---------------------------- */

router.get(
  '/log',
  wrap(async (req, res) => {
    const page = pageOf(req);
    const [total, entries] = await Promise.all([
      AdminLog.countDocuments(),
      AdminLog.find().sort({ createdAt: -1 }).skip((page - 1) * PER_PAGE).limit(PER_PAGE),
    ]);
    res.json({ total, page, pages: Math.max(1, Math.ceil(total / PER_PAGE)), entries });
  })
);

router.get('/settings', requireSuperAdmin, (req, res) => res.json(adminSettings()));

router.put(
  '/settings/:section',
  requireSuperAdmin,
  wrap(async (req, res) => {
    const { section } = req.params;
    if (!SECTIONS.includes(section)) throw new HttpError(404, 'Unknown settings section.');
    const note = await saveSection(section, req.body);
    await audit(req, `settings.${section}`, 'settings', section, note);
    res.json(adminSettings());
  })
);

router.post(
  '/settings/smtp/test',
  requireSuperAdmin,
  wrap(async (req, res) => {
    const to = String(req.body.to || req.user.email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new HttpError(400, 'Enter a valid e-mail address.');
    await sendTestMail(to);
    await audit(req, 'settings.smtp.test', 'settings', 'smtp', to);
    res.json({ ok: true, to });
  })
);

export default router;
