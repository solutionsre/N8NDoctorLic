import cron from 'node-cron';
import { config, formatDate } from '../config.js';
import { License } from '../models/License.js';
import { User } from '../models/User.js';
import { DAY, licenseState } from '../lib/licenseService.js';
import { sendMail } from '../lib/mailer.js';

/**
 * Once a day: e-mails owners whose license expires in REMINDER_DAYS day(s), and
 * once when it has expired. n8n Doctor shows its own reminder too.
 */
export async function sendExpiryReminders(now = new Date()) {
  const horizon = new Date(now.getTime() + Math.max(...config.reminderDays) * DAY);
  const since = new Date(now.getTime() - 2 * DAY);
  const due = await License.find({ status: 'active', expiresAt: { $gt: since, $lte: horizon } });

  for (const lic of due) {
    const s = licenseState(lic, now);
    const mark = s.status === 'expired' ? 0 : config.reminderDays.filter((d) => s.daysLeft <= d).sort((a, b) => a - b)[0];
    if (mark === undefined || lic.remindersSent.includes(mark)) continue;

    const user = await User.findById(lic.user);
    if (!user) continue;
    const when = formatDate(lic.expiresAt);
    const site = '';
    let subject;
    let body;
    if (mark === 0) {
      subject = `Your ${config.appName} license has expired`;
      body = `Your ${s.isTrial ? 'free trial' : 'license'} ${lic.key}${site} expired on ${when}. n8n Doctor locks until you renew:\n${config.clientUrl}/dashboard`;
    } else {
      subject = `Your ${config.appName} license expires in ${s.daysLeft} day(s)`;
      body = `Your ${s.isTrial ? 'free trial' : 'license'} ${lic.key}${site} expires on ${when}.\n\nRenew here: ${config.clientUrl}/dashboard`;
      if (s.canExtend) {
        body += `\n\nNeed a few more days? You can extend it once by ${config.extendDays} days from the dashboard.`;
      }
    }
    await sendMail(user.email, subject, `Hello ${user.name},\n\n${body}\n`);
    lic.remindersSent.push(mark);
    await lic.save();
  }
}

export function startDailyJobs() {
  cron.schedule(
    config.reminderCron,
    () => sendExpiryReminders().catch((err) => console.error('[daily] reminders failed:', err)),
    { timezone: config.timezone }
  );
}
