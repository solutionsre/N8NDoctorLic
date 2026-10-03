import mongoose from 'mongoose';

// Site settings edited in the admin panel (one document, _id "site").
// data.<section> overrides the .env defaults; secrets inside are encrypted.
const settingSchema = new mongoose.Schema(
  {
    _id: { type: String },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);

export const Setting = mongoose.model('Setting', settingSchema);
