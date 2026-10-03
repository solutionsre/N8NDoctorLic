import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Set for a renewal; for a new license it is filled in once the payment completes.
    license: { type: mongoose.Schema.Types.ObjectId, ref: 'License', default: null },
    machineId: { type: String, default: null }, // new license: the machine it is for
    isRenewal: { type: Boolean, default: false },
    plan: { type: String, required: true },
    gateway: { type: String, enum: ['khalti', 'esewa'], required: true },
    // Gateway environment the payment ran in. Only "live" counts as revenue.
    // Payments from before this field existed were made while testing.
    mode: { type: String, enum: ['test', 'live'], default: 'test', index: true },
    amount: { type: Number, required: true }, // NPR
    orderId: { type: String, required: true, unique: true },
    gatewayRef: { type: String, default: null, index: true }, // Khalti pidx / eSewa transaction code
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    completedAt: { type: Date, default: null },
    raw: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

export const Payment = mongoose.model('Payment', paymentSchema);
