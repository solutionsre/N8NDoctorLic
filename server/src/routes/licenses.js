import { Router } from 'express';
import mongoose from 'mongoose';
import { gatewayName, PLANS } from '../config.js';
import { License } from '../models/License.js';
import { Payment } from '../models/Payment.js';
import { HttpError, wrap } from '../lib/http.js';
import { requireUser, requireVerified } from '../middleware/auth.js';
import { normalizeMachineId } from '../lib/machine.js';
import { extendLicense, startTrial, toPublic } from '../lib/licenseService.js';
import { publicSettings } from '../lib/settings.js';
import { LEGAL_PAGES, legalText, publishedLegalPages } from '../lib/legal.js';

const router = Router();

/** Public: everything the website shows that comes from server settings. */
router.get('/settings', (req, res) => res.json(publicSettings()));
router.get('/plans', (req, res) => res.json(publicSettings()));

/** Public: terms, privacy and refund pages. */
router.get('/legal/:page', (req, res) => {
  const { page } = req.params;
  if (!publishedLegalPages().includes(page)) throw new HttpError(404, 'This page has not been published yet.');
  res.json({ id: page, title: LEGAL_PAGES[page], body: legalText(page) });
});

router.use('/licenses', requireUser);

async function ownLicense(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'License not found.');
  const lic = await License.findOne({ _id: req.params.id, user: req.user._id });
  if (!lic) throw new HttpError(404, 'License not found.');
  return lic;
}

router.get(
  '/licenses',
  wrap(async (req, res) => {
    const [licenses, payments] = await Promise.all([
      License.find({ user: req.user._id }).sort({ createdAt: -1 }),
      Payment.find({ user: req.user._id, status: { $ne: 'pending' } }).sort({ createdAt: -1 }).limit(50),
    ]);
    res.json({
      user: req.user.toPublic(),
      licenses: licenses.map((l) => toPublic(l, req.user)),
      payments: payments.map((p) => ({
        id: p._id,
        plan: PLANS[p.plan]?.name || p.plan,
        gateway: p.gateway,
        gatewayName: gatewayName(p.gateway),
        amount: p.amount,
        mode: p.mode,
        status: p.status,
        isRenewal: p.isRenewal,
        license: p.license,
        orderId: p.orderId,
        createdAt: p.createdAt,
      })),
    });
  })
);

router.post(
  '/licenses/trial',
  requireVerified,
  wrap(async (req, res) => {
    const lic = await startTrial(req.user, normalizeMachineId(req.body.machineId));
    res.status(201).json({ license: toPublic(lic, req.user) });
  })
);

router.post(
  '/licenses/:id/extend',
  wrap(async (req, res) => {
    const lic = await extendLicense(await ownLicense(req));
    res.json({ license: toPublic(lic, req.user) });
  })
);

/** Records that the customer downloaded / copied the key (shown to admins). */
router.post(
  '/licenses/:id/downloaded',
  wrap(async (req, res) => {
    const lic = await ownLicense(req);
    lic.lastDownloadAt = new Date();
    await lic.save();
    res.json({ ok: true });
  })
);

export default router;
