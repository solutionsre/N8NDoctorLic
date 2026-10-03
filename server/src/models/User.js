import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // One free trial per account (and one per machine, see TrialMachine).
    trialUsed: { type: Boolean, default: false },

    // No default on purpose: accounts made before e-mail verification existed
    // have no value and count as verified; new accounts are created with false.
    emailVerified: { type: Boolean },
    verifyCodeHash: { type: String, default: null },
    verifyCodeExpires: { type: Date, default: null },
    verifyCodeSentAt: { type: Date, default: null },
    verifyAttempts: { type: Number, default: 0 },

    resetCodeHash: { type: String, default: null },
    resetCodeExpires: { type: Date, default: null },
    resetCodeSentAt: { type: Date, default: null },
    resetAttempts: { type: Number, default: 0 },

    // Part of every session token; raising it logs out every device.
    tokenVersion: { type: Number, default: 0 },
    failedLogins: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },

    // user: customer. admin: runs the admin panel (users, licenses, payments).
    // superadmin: also site settings (prices, payment keys, SMTP) and roles.
    role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user', index: true },
    // Blocked by an admin: no website log in or purchase.
    blocked: { type: Boolean, default: false, index: true },
    blockedReason: { type: String, default: '' },
    blockedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.virtual('isAdmin').get(function isAdmin() {
  return this.role === 'admin' || this.role === 'superadmin';
});

userSchema.virtual('isVerified').get(function isVerified() {
  return this.emailVerified !== false;
});

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    emailVerified: this.isVerified,
    trialUsed: this.trialUsed,
    lastLoginAt: this.lastLoginAt,
    passwordChangedAt: this.passwordChangedAt,
    createdAt: this.createdAt,
    role: this.role || 'user',
    blocked: !!this.blocked,
  };
};

export const User = mongoose.model('User', userSchema);
