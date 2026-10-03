import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { HttpError, wrap } from '../lib/http.js';
import { sendMail } from '../lib/mailer.js';
import { sha256 } from '../lib/signing.js';
import { BLOCKED_MESSAGE, requireUser, setSession, clearSession } from '../middleware/auth.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const strictLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 6, standardHeaders: true, legacyHeaders: false });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Compared against when the e-mail is unknown, so both cases take the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const {
  passwordMinLength: PASSWORD_MIN,
  maxFailedLogins: MAX_FAILED,
  lockMinutes: LOCK_MINUTES,
  codeMinutes: CODE_MINUTES,
  codeAttempts: CODE_ATTEMPTS,
  resendSeconds: RESEND_SECONDS,
  resetMinutes: RESET_MINUTES,
} = config.auth;

const cleanEmail = (v) => String(v || '').toLowerCase().trim();

/** Throws when the new password is too weak. */
function checkPassword(password, email) {
  if (password.length < PASSWORD_MIN) throw new HttpError(400, `The password must be at least ${PASSWORD_MIN} characters.`);
  if (password.length > 200) throw new HttpError(400, 'The password is too long.');
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, 'Use at least one letter and one number in the password.');
  }
  if (email && password.toLowerCase().includes(email.split('@')[0])) {
    throw new HttpError(400, 'The password must not contain your e-mail name.');
  }
}

/**
 * E-mail + password check shared by the website login and the plugin
 * activation. Returns { user } or { error, code }. MAX_FAILED wrong passwords
 * in a row lock the account for LOCK_MINUTES.
 */
export async function checkCredentials(email, password) {
  const user = await User.findOne({ email: cleanEmail(email) });
  const ok = await bcrypt.compare(String(password || ''), user ? user.passwordHash : DUMMY_HASH);
  if (!user) return { error: 'Wrong e-mail or password.', code: 'bad_login' };

  if (user.lockUntil && user.lockUntil > new Date()) {
    const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return { error: `Too many wrong passwords. Try again in ${mins} minute(s), or reset your password.`, code: 'locked' };
  }
  if (!ok) {
    user.failedLogins = (user.failedLogins || 0) + 1;
    if (user.failedLogins >= MAX_FAILED) {
      user.failedLogins = 0;
      user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
    }
    await user.save();
    return { error: 'Wrong e-mail or password.', code: 'bad_login' };
  }
  if (user.failedLogins || user.lockUntil) {
    user.failedLogins = 0;
    user.lockUntil = null;
  }
  // Only after the password matched, so "blocked" does not reveal anything to a guesser.
  if (user.blocked) {
    await user.save();
    return { error: BLOCKED_MESSAGE, code: 'blocked' };
  }
  user.lastLoginAt = new Date();
  await user.save();
  return { user };
}

/** Makes a new 6-digit code, stores its hash and e-mails it. */
async function sendVerifyCode(user) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  user.verifyCodeHash = sha256(`${user._id}:${code}`);
  user.verifyCodeExpires = new Date(Date.now() + CODE_MINUTES * 60000);
  user.verifyCodeSentAt = new Date();
  user.verifyAttempts = 0;
  await user.save();
  await sendMail(
    user.email,
    `${code} is your ${config.appName} code`,
    `Hello ${user.name},\n\nYour confirmation code is: ${code}\n\nIt works for ${CODE_MINUTES} minutes. If you did not create an account, ignore this e-mail.\n`
  );
}

router.post(
  '/register',
  limiter,
  wrap(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!name) throw new HttpError(400, 'Enter your name.');
    if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid e-mail address.');
    checkPassword(password, email);
    if (await User.exists({ email })) throw new HttpError(409, 'An account with this e-mail already exists. Log in instead.');

    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), emailVerified: false, lastLoginAt: new Date() });
    await sendVerifyCode(user);
    setSession(res, user);
    res.status(201).json({ user: user.toPublic() });
  })
);

router.post(
  '/login',
  limiter,
  wrap(async (req, res) => {
    const { user, error, code } = await checkCredentials(req.body.email, req.body.password);
    if (!user) throw new HttpError({ locked: 423, blocked: 403 }[code] || 401, error, code);
    setSession(res, user, req.body.remember !== false);
    res.json({ user: user.toPublic() });
  })
);

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', requireUser, (req, res) => res.json({ user: req.user.toPublic() }));

/* ---------------------------- E-mail verification ---------------------------- */

router.post(
  '/verify-email',
  requireUser,
  limiter,
  wrap(async (req, res) => {
    const user = req.user;
    if (user.isVerified) return res.json({ user: user.toPublic() });
    const code = String(req.body.code || '').replace(/\D/g, '');
    if (!user.verifyCodeHash || !user.verifyCodeExpires || user.verifyCodeExpires < new Date()) {
      throw new HttpError(400, 'This code has expired. Send a new one.', 'code_expired');
    }
    if (user.verifyAttempts >= CODE_ATTEMPTS) {
      throw new HttpError(429, 'Too many wrong codes. Send a new one.', 'code_expired');
    }
    const expected = Buffer.from(user.verifyCodeHash);
    const given = Buffer.from(sha256(`${user._id}:${code}`));
    if (code.length !== 6 || !crypto.timingSafeEqual(expected, given)) {
      user.verifyAttempts += 1;
      await user.save();
      throw new HttpError(400, `That code is not right. ${CODE_ATTEMPTS - user.verifyAttempts} attempt(s) left.`, 'bad_code');
    }
    user.emailVerified = true;
    user.verifyCodeHash = null;
    user.verifyCodeExpires = null;
    user.verifyAttempts = 0;
    await user.save();
    res.json({ user: user.toPublic() });
  })
);

router.post(
  '/resend-verification',
  requireUser,
  strictLimiter,
  wrap(async (req, res) => {
    const user = req.user;
    if (user.isVerified) return res.json({ ok: true });
    const wait = user.verifyCodeSentAt ? RESEND_SECONDS - Math.floor((Date.now() - user.verifyCodeSentAt) / 1000) : 0;
    if (wait > 0) throw new HttpError(429, `Wait ${wait} seconds before asking for a new code.`, 'too_soon');
    await sendVerifyCode(user);
    res.json({ ok: true });
  })
);

/* ------------------------------ Password reset ------------------------------ */

router.post(
  '/forgot-password',
  strictLimiter,
  wrap(async (req, res) => {
    const email = cleanEmail(req.body.email);
    if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid e-mail address.');
    const user = await User.findOne({ email });
    // Same answer either way, so nobody can test which e-mails have accounts.
    // Within the resend cooldown the earlier code stays valid and no new mail goes out.
    const recent = user?.resetCodeSentAt && Date.now() - user.resetCodeSentAt < RESEND_SECONDS * 1000;
    if (user && !recent) {
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      user.resetCodeHash = sha256(`reset:${user._id}:${code}`);
      user.resetCodeExpires = new Date(Date.now() + RESET_MINUTES * 60000);
      user.resetCodeSentAt = new Date();
      user.resetAttempts = 0;
      await user.save();
      await sendMail(
        user.email,
        `${code} is your ${config.appName} password reset code`,
        `Hello ${user.name},\n\nYour password reset code is: ${code}\n\nEnter it on the "Forgot password" page to choose a new password. It works for ${RESET_MINUTES} minutes, once.\n\nIf you did not ask for this, ignore this e-mail; your password stays the same.\n`
      );
    }
    res.json({ ok: true });
  })
);

router.post(
  '/reset-password',
  limiter,
  wrap(async (req, res) => {
    const email = cleanEmail(req.body.email);
    const code = String(req.body.code || '').replace(/\D/g, '');
    const password = String(req.body.password || '');
    checkPassword(password, email);

    const invalid = new HttpError(400, 'This code is not right or has expired. Ask for a new one.', 'bad_code');
    const user = EMAIL.test(email) ? await User.findOne({ email }) : null;
    if (!user || !user.resetCodeHash || !user.resetCodeExpires || user.resetCodeExpires < new Date()) throw invalid;
    if (user.resetAttempts >= CODE_ATTEMPTS) {
      throw new HttpError(429, 'Too many wrong codes. Ask for a new one.', 'code_expired');
    }
    const expected = Buffer.from(user.resetCodeHash);
    const given = Buffer.from(sha256(`reset:${user._id}:${code}`));
    if (code.length !== 6 || !crypto.timingSafeEqual(expected, given)) {
      user.resetAttempts += 1;
      await user.save();
      const left = CODE_ATTEMPTS - user.resetAttempts;
      throw new HttpError(400, left > 0 ? `That code is not right. ${left} attempt(s) left.` : 'Too many wrong codes. Ask for a new one.', 'bad_code');
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordChangedAt = new Date();
    user.resetCodeHash = null;
    user.resetCodeExpires = null;
    user.resetAttempts = 0;
    user.failedLogins = 0;
    user.lockUntil = null;
    user.emailVerified = true; // The code reached their inbox.
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Log out every other device.
    user.lastLoginAt = new Date();
    await user.save();
    await sendMail(user.email, 'Your password was changed', `Hello ${user.name},\n\nYour ${config.appName} password was just reset. If this was not you, reset it again right away.\n`);
    setSession(res, user);
    res.json({ user: user.toPublic() });
  })
);

/* ------------------------------ Account settings ------------------------------ */

router.patch(
  '/profile',
  requireUser,
  wrap(async (req, res) => {
    const name = String(req.body.name || '').trim();
    if (!name) throw new HttpError(400, 'Enter your name.');
    if (name.length > 100) throw new HttpError(400, 'The name is too long.');
    req.user.name = name;
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  })
);

router.post(
  '/change-password',
  requireUser,
  limiter,
  wrap(async (req, res) => {
    const user = req.user;
    const current = String(req.body.currentPassword || '');
    const password = String(req.body.newPassword || '');
    if (!(await bcrypt.compare(current, user.passwordHash))) throw new HttpError(400, 'Your current password is not right.', 'bad_password');
    if (current === password) throw new HttpError(400, 'Choose a password different from the current one.');
    checkPassword(password, user.email);

    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    await sendMail(user.email, 'Your password was changed', `Hello ${user.name},\n\nYour ${config.appName} password was just changed. If this was not you, reset it right away at ${config.clientUrl}/forgot-password.\n`);
    setSession(res, user); // Keep this device logged in.
    res.json({ user: user.toPublic() });
  })
);

/** Ends every session, including this one. Activated plugins keep working. */
router.post(
  '/logout-all',
  requireUser,
  wrap(async (req, res) => {
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    await req.user.save();
    clearSession(res);
    res.json({ ok: true });
  })
);

export default router;
