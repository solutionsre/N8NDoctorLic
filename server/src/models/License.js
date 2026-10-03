import mongoose from 'mongoose';

const historySchema = new mongoose.Schema(
  { at: { type: Date, default: Date.now }, type: String, note: String },
  { _id: false }
);

const licenseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    key: { type: String, required: true, unique: true },
    plan: { type: String, enum: ['trial', 'monthly', 'sixmonth', 'yearly'], required: true },
    // Expiry is by date. "revoked" = blocked by an admin (admin panel).
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    blockedReason: { type: String, default: '' },
    blockedAt: { type: Date, default: null },
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },

    // Paid-only 3-day extension, once per paid period. extensionDays is what
    // the next purchase takes back (when EXTENSION_DEDUCTED is on).
    extensionUsedAt: { type: Date, default: null },
    extensionDays: { type: Number, default: 0 },

    // Id inside the signed key, and the one machine the key works on (unique:
    // a machine has one license record; renewals extend it).
    licenseId: { type: String, required: true, unique: true },
    machineId: { type: String, required: true, unique: true },
    lastDownloadAt: { type: Date, default: null },

    // Reminder e-mails already sent for the current expiry (days before, 0 = expired).
    remindersSent: { type: [Number], default: [] },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true }
);

licenseSchema.methods.log = function log(type, note = '') {
  this.history.push({ type, note });
  if (this.history.length > 100) {
    this.history = this.history.slice(-100);
  }
};

export const License = mongoose.model('License', licenseSchema);
