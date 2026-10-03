import mongoose from 'mongoose';

// Every change made in the admin panel: who, what, on which record.
const adminLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminEmail: String,
    action: String,
    targetType: String, // user | license | settings
    targetId: String,
    note: String,
  },
  { timestamps: true }
);
adminLogSchema.index({ createdAt: -1 });

export const AdminLog = mongoose.model('AdminLog', adminLogSchema);
