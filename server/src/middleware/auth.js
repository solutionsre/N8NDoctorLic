import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { HttpError, wrap } from '../lib/http.js';

export const COOKIE = 'n8nd_session';

export function setSession(res, user, remember = true) {
  // `v` must match user.tokenVersion; raising that ends every older session.
  const days = remember ? 30 : 1;
  const token = jwt.sign({ sub: String(user._id), v: user.tokenVersion || 0 }, config.jwtSecret, { algorithm: 'HS256', expiresIn: `${days}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Secure whenever the visitor came over https (ngrok, nginx), not only in production.
    secure: config.isProd || !!res.req?.secure,
    // Without "remember me" it is a browser-session cookie.
    ...(remember ? { maxAge: days * 24 * 60 * 60 * 1000 } : {}),
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.isProd || !!res.req?.secure });
}

/** Puts the logged-in user on req.user, or answers 401. */
export const requireUser = wrap(async (req, res, next) => {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'Please log in.', 'unauthenticated');
  let sub;
  let v;
  try {
    ({ sub, v } = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }));
  } catch {
    throw new HttpError(401, 'Your session has ended. Please log in again.', 'unauthenticated');
  }
  const user = await User.findById(sub);
  if (!user || (v || 0) !== (user.tokenVersion || 0)) {
    clearSession(res);
    throw new HttpError(401, 'Your session has ended. Please log in again.', 'unauthenticated');
  }
  if (user.blocked) {
    clearSession(res);
    throw new HttpError(403, BLOCKED_MESSAGE, 'blocked');
  }
  req.user = user;
  next();
});

export const BLOCKED_MESSAGE = 'This account is blocked. Contact support if you think this is a mistake.';

/** After requireUser: admins and super admins only. */
export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return next(new HttpError(403, 'Admins only.', 'forbidden'));
  next();
}

/** After requireUser: super admins only (site settings, roles). */
export function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'superadmin') return next(new HttpError(403, 'Super admins only.', 'forbidden'));
  next();
}

/** After requireUser: blocks accounts whose e-mail is not confirmed yet. */
export function requireVerified(req, res, next) {
  if (!req.user.isVerified) {
    return next(new HttpError(403, 'Confirm your e-mail address first. We sent you a 6-digit code.', 'unverified'));
  }
  next();
}
