import crypto from 'node:crypto';
import { config, formatDate, gatewayName, PLANS } from '../config.js';
import { License } from '../models/License.js';
import { User } from '../models/User.js';
import { TrialMachine } from '../models/TrialMachine.js';
import { buildLicenseBlob } from './signing.js';
import { Payment } from '../models/Payment.js';
import { HttpError } from './http.js';

export const DAY = 24 * 60 * 60 * 1000;

const PLAN_CODE = { trial: 'TRL', monthly: 'MON', sixmonth: 'HYR', yearly: 'YRL' };

/** Id inside the signed key. */
export const newLicenseId = () => crypto.randomUUID();

/** NCC-MON-XXXX-XXXX-XXXX: the same short label n8n Doctor shows for a license. */
export function displayKey(licenseId, plan) {
  const tail = licenseId.replace(/-/g, '').toUpperCase().slice(-12);
  return `NCC-${PLAN_CODE[plan] || 'GEN'}-${tail.match(/.{4}/g).join('-')}`;
}

/** Everything the dashboard and the plugin need to know about a license right now. */
export function licenseState(lic, now = new Date()) {
  const msLeft = lic.expiresAt.getTime() - now.getTime();
  let status = 'active';
  if (lic.status === 'revoked') status = 'revoked';
  else if (msLeft <= 0) status = 'expired';

  const isTrial = lic.plan === 'trial';
  const expiringSoon = status === 'active' && msLeft <= config.extendWindowDays * DAY;
  let extendBlockedReason = null;
  if (isTrial) extendBlockedReason = 'Trial licenses cannot be extended. Buy a plan to keep using n8n Doctor.';
  else if (status !== 'active') extendBlockedReason = 'Only an active license can be extended. Renew it instead.';
  else if (lic.extensionUsedAt) extendBlockedReason = 'The extension was already used for this period.';
  else if (!expiringSoon) extendBlockedReason = `Available in the last ${config.extendWindowDays} days before expiry.`;

  return {
    status,
    isTrial,
    daysLeft: Math.max(0, Math.ceil(msLeft / DAY)),
    expiringSoon,
    canExtend: !extendBlockedReason,
    extendBlockedReason,
  };
}

export function toPublic(lic, user = null) {
  const plan = lic.plan === 'trial' ? { name: 'Free trial' } : PLANS[lic.plan];
  return {
    id: lic._id,
    key: lic.key,
    plan: lic.plan,
    planName: plan?.name || lic.plan,
    startsAt: lic.startsAt,
    expiresAt: lic.expiresAt,
    machineId: lic.machineId,
    lastDownloadAt: lic.lastDownloadAt,
    extensionUsedAt: lic.extensionUsedAt,
    extensionDays: lic.extensionDays,
    blockedReason: lic.status === 'revoked' ? lic.blockedReason || '' : '',
    ...licenseState(lic),
    // The signed key to paste into n8n Doctor (blocked licenses get none).
    licenseKey: user && lic.status !== 'revoked' ? buildLicenseBlob(lic, user) : null,
  };
}

/**
 * Free trial. Allowed once per account, once per machine, and never on a
 * machine that already has a license. The unique indexes make it race-safe.
 */
export async function startTrial(user, machineId) {
  if (!machineId) throw new HttpError(400, 'Enter a valid Machine ID (16 groups of 4 characters, copied from n8n Doctor > License Manager).', 'bad_machine');
  if (user.trialUsed) throw new HttpError(400, 'This account already used its free trial.', 'trial_used');
  if (await License.exists({ machineId })) {
    throw new HttpError(400, 'This machine already has a license, so it cannot start a trial.', 'machine_licensed');
  }
  const now = new Date();
  const lic = new License({
    user: user._id,
    licenseId: newLicenseId(),
    machineId,
    plan: 'trial',
    startsAt: now,
    expiresAt: new Date(now.getTime() + config.trialDays * DAY),
  });
  lic.key = displayKey(lic.licenseId, 'trial');
  lic.log('trial', `${config.trialDays}-day trial started`);

  // Claim the machine first: the unique index rejects a second trial for it.
  try {
    await TrialMachine.create({ machineId, user: user._id, license: lic._id });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(400, 'This machine already used its free trial.', 'trial_machine_used');
    throw err;
  }
  // Then claim the account (only if still unused).
  const claimed = await User.findOneAndUpdate({ _id: user._id, trialUsed: false }, { trialUsed: true });
  if (!claimed) {
    await TrialMachine.deleteOne({ machineId });
    throw new HttpError(400, 'This account already used its free trial.', 'trial_used');
  }
  try {
    await lic.save();
  } catch (err) {
    await TrialMachine.deleteOne({ machineId });
    await User.updateOne({ _id: user._id }, { trialUsed: false });
    if (err.code === 11000) throw new HttpError(400, 'This machine already has a license.', 'machine_licensed');
    throw err;
  }
  user.trialUsed = true;
  return lic;
}

/**
 * The paid-only EXTEND_DAYS extension. Allowed once per paid period, in the last
 * EXTEND_WINDOW_DAYS before expiry. The days are remembered so the next
 * purchase counts them (see applyPurchase).
 */
export async function extendLicense(lic) {
  const s = licenseState(lic);
  if (!s.canExtend) {
    throw new HttpError(400, s.extendBlockedReason, 'cannot_extend');
  }
  lic.expiresAt = new Date(lic.expiresAt.getTime() + config.extendDays * DAY);
  lic.extensionUsedAt = new Date();
  lic.extensionDays = (lic.extensionDays || 0) + config.extendDays;
  lic.remindersSent = [];
  lic.log('extend', `Extended by ${config.extendDays} days to ${formatDate(lic.expiresAt)}`);
  await lic.save();
  return lic;
}

/**
 * Adds a paid period. It starts at the current expiry (or now, if that has
 * passed). With EXTENSION_DEDUCTED the borrowed extension days come off the
 * new period, i.e. renewal counts from the original expiry date.
 * A trial that is upgraded keeps its remaining trial days.
 */
export function applyPurchase(lic, planId, now = new Date()) {
  const plan = PLANS[planId];
  const borrowed = config.extensionDeducted ? (lic.extensionDays || 0) * DAY : 0;
  const base = Math.max(now.getTime(), lic.expiresAt.getTime()) - borrowed;
  lic.expiresAt = new Date(base + plan.days * DAY);
  if (lic.plan === 'trial') lic.startsAt = now;
  lic.plan = plan.id;
  lic.key = displayKey(lic.licenseId, plan.id);
  lic.extensionUsedAt = null;
  lic.extensionDays = 0;
  lic.remindersSent = [];
  lic.log('renew', `${plan.name} added; now expires ${formatDate(lic.expiresAt)}`);
}

/**
 * Marks a pending (or failed) payment completed (exactly once, even if the gateway calls
 * back twice) and gives the user the license time they paid for.
 */
export async function fulfillPayment(paymentId, gatewayRef, raw) {
  // 'failed' too: the cancel URL (or an early lookup) may have marked it
  // failed before the gateway confirmed it; the gateway's word wins.
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: { $in: ['pending', 'failed'] } },
    { status: 'completed', completedAt: new Date(), gatewayRef, raw },
    { new: true }
  );
  if (!payment) return null; // Already handled.

  let lic = payment.license ? await License.findById(payment.license) : null;
  if (lic) {
    applyPurchase(lic, payment.plan);
  } else {
    const plan = PLANS[payment.plan];
    const now = new Date();
    // The machine may have got a license since checkout: extend that one if it is this user's.
    const existing = await License.findOne({ machineId: payment.machineId });
    if (existing && String(existing.user) === String(payment.user)) {
      lic = existing;
      applyPurchase(lic, plan.id);
      payment.license = lic._id;
      await payment.save();
      await lic.save();
      return lic;
    }
    const licenseId = newLicenseId();
    lic = new License({
      user: payment.user,
      licenseId,
      key: displayKey(licenseId, plan.id),
      machineId: payment.machineId,
      plan: plan.id,
      startsAt: now,
      expiresAt: new Date(now.getTime() + plan.days * DAY),
    });
    lic.log('purchase', `${plan.name} bought via ${gatewayName(payment.gateway)}`);
    payment.license = lic._id;
    await payment.save();
  }
  await lic.save();
  return lic;
}
