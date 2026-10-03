// Makes an existing account a super admin (full admin panel access).
//   npm run make-admin -- you@example.com
// Sign up on the website first. More admins can then be added from the
// admin panel (Users → a user → Role).
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { User } from '../src/models/User.js';

const email = String(process.argv[2] || '').toLowerCase().trim();
if (!email) {
  console.error('Usage: npm run make-admin -- you@example.com');
  process.exit(1);
}

await mongoose.connect(config.mongoUri);
const user = await User.findOne({ email });
if (!user) {
  console.error(`No account with ${email}. Sign up on the website first, then run this again.`);
  await mongoose.disconnect();
  process.exit(1);
}
user.role = 'superadmin';
user.emailVerified = true;
user.blocked = false;
await user.save();
console.log(`${email} is now a super admin. Log in and open /admin.`);
await mongoose.disconnect();
