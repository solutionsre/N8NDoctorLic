import { Router } from 'express';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { config, GATEWAYS, gatewayReady, planById } from '../config.js';
import { License } from '../models/License.js';
import { Payment } from '../models/Payment.js';
import { HttpError, wrap } from '../lib/http.js';
import { requireUser, requireVerified } from '../middleware/auth.js';
import { normalizeMachineId } from '../lib/machine.js';
import { fulfillPayment } from '../lib/licenseService.js';
import * as khalti from '../payments/khalti.js';
import * as esewa from '../payments/esewa.js';

const router = Router();

const resultUrl = (status, payment, message = '') => {
  const url = new URL(`${config.clientUrl}/payment/result`);
  url.searchParams.set('status', status);
  if (payment) url.searchParams.set('order', payment.orderId);
  if (message) url.searchParams.set('message', message);
  return url.toString();
};

/**
 * Starts a purchase: { plan, gateway, licenseId? | machineId? }. With licenseId the
 * license is renewed; without, a new license for machineId is created once paid
 * (or, if that machine is already this user's license, that license is renewed).
 * Khalti answers { type: 'redirect', url }, eSewa { type: 'form', action, fields }.
 */
router.post(
  '/checkout',
  requireUser,
  requireVerified,
  rateLimit({ windowMs: 60 * 1000, limit: 10 }),
  wrap(async (req, res) => {
    const plan = planById(req.body.plan);
    const gateway = String(req.body.gateway || '');
    if (!plan || !plan.enabled) throw new HttpError(400, 'Pick a plan.');
    if (!GATEWAYS.includes(gateway)) throw new HttpError(400, 'Pick a payment method.');
    if (!gatewayReady(gateway)) throw new HttpError(503, 'This payment method is not available right now.', 'gateway_off');

    let license = null;
    if (req.body.licenseId) {
      if (!mongoose.isValidObjectId(req.body.licenseId)) throw new HttpError(404, 'License not found.');
      license = await License.findOne({ _id: req.body.licenseId, user: req.user._id });
      if (!license) throw new HttpError(404, 'License not found.');
      if (license.status === 'revoked') throw new HttpError(400, 'This license is blocked and cannot be renewed. Contact support.');
    }

    let machineId = null;
    if (!license) {
      machineId = normalizeMachineId(req.body.machineId);
      if (!machineId) throw new HttpError(400, 'Enter a valid Machine ID (16 groups of 4 characters, from n8n Doctor > License Manager).', 'bad_machine');
      const onMachine = await License.findOne({ machineId });
      if (onMachine) {
        if (String(onMachine.user) !== String(req.user._id)) {
          throw new HttpError(400, 'This machine already has a license on another account. Contact support if this is your machine.', 'machine_taken');
        }
        if (onMachine.status === 'revoked') throw new HttpError(400, 'This license is blocked and cannot be renewed. Contact support.');
        license = onMachine; // same user, same machine: add time to the existing license
      }
    }

    const payment = await Payment.create({
      machineId,
      user: req.user._id,
      license: license?._id || null,
      isRenewal: !!license,
      plan: plan.id,
      gateway,
      amount: plan.price,
      orderId: crypto.randomUUID(),
      mode: config.payments.mode,
    });

    try {
      if (gateway === 'khalti') {
        const { pidx, url } = await khalti.initiate({ payment, user: req.user, planName: plan.name });
        payment.gatewayRef = pidx;
        await payment.save();
        return res.json({ type: 'redirect', url });
      }
      return res.json({ type: 'form', ...esewa.formFields(payment) });
    } catch (err) {
      payment.status = 'failed';
      payment.raw = { error: err.message };
      await payment.save();
      throw err;
    }
  })
);

/** Khalti sends the buyer back here; the status is confirmed with Khalti's lookup API. */
router.get(
  '/khalti/return',
  wrap(async (req, res) => {
    const pidx = String(req.query.pidx || '');
    const payment = pidx ? await Payment.findOne({ gatewayRef: pidx, gateway: 'khalti' }) : null;
    if (!payment) return res.redirect(resultUrl('failed', null, 'Unknown payment.'));
    if (payment.status === 'completed') return res.redirect(resultUrl('success', payment));

    const data = await khalti.lookup(pidx, payment.mode);
    if (data.status === 'Completed' && Number(data.total_amount) === Math.round(payment.amount * 100)) {
      await fulfillPayment(payment._id, data.transaction_id || pidx, data);
      return res.redirect(resultUrl('success', payment));
    }
    if (['Pending', 'Initiated'].includes(data.status)) {
      return res.redirect(resultUrl('pending', payment, 'Khalti has not confirmed the payment yet. Refresh the dashboard in a few minutes.'));
    }
    await Payment.updateOne({ _id: payment._id, status: 'pending' }, { status: 'failed', raw: data });
    return res.redirect(resultUrl('failed', payment, `Khalti: ${data.status || 'payment not completed'}`));
  })
);

/** eSewa success redirect: ?data= is signed; the status is then confirmed with eSewa's status API. */
router.get(
  '/esewa/success',
  wrap(async (req, res) => {
    // The signature is checked with the secret of the mode the payment was started in.
    const data = esewa.parseResponse(req.query.data);
    const payment = data?.transaction_uuid ? await Payment.findOne({ orderId: String(data.transaction_uuid), gateway: 'esewa' }) : null;
    if (!payment) return res.redirect(resultUrl('failed', null, 'Unknown payment.'));
    if (!esewa.verifyResponse(data, payment.mode)) {
      return res.redirect(resultUrl('failed', null, 'The eSewa answer could not be verified.'));
    }
    if (payment.status === 'completed') return res.redirect(resultUrl('success', payment));

    const check = await esewa.status(payment);
    if (check.status === 'COMPLETE' && esewa.toNumber(check.total_amount) === payment.amount) {
      await fulfillPayment(payment._id, data.transaction_code || check.ref_id, { redirect: data, status: check });
      return res.redirect(resultUrl('success', payment));
    }
    if (check.status === 'PENDING') {
      return res.redirect(resultUrl('pending', payment, 'eSewa has not confirmed the payment yet.'));
    }
    await Payment.updateOne({ _id: payment._id, status: 'pending' }, { status: 'failed', raw: { redirect: data, status: check } });
    return res.redirect(resultUrl('failed', payment, `eSewa: ${check.status || 'payment not completed'}`));
  })
);

router.get(
  '/esewa/failure',
  wrap(async (req, res) => {
    const payment = await Payment.findOne({ orderId: String(req.query.order || ''), gateway: 'esewa' });
    if (payment) await Payment.updateOne({ _id: payment._id, status: 'pending' }, { status: 'failed' });
    res.redirect(resultUrl('failed', payment, 'The payment was cancelled or failed.'));
  })
);

export default router;
