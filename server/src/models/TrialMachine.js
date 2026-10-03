import mongoose from 'mongoose';

// Every machine that ever had a free trial. Unique, so one machine can never
// get a second trial, even from a new account.
const schema = new mongoose.Schema(
  {
    machineId: { type: String, required: true, unique: true },
    license: { type: mongoose.Schema.Types.ObjectId, ref: 'License' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const TrialMachine = mongoose.model('TrialMachine', schema);
