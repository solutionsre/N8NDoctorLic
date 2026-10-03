import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { HttpError } from './http.js';

let transport = null;
let lastError = null;

/** (Re)builds the SMTP connection from config.smtp; called again after the admin saves SMTP. */
export function resetMailer() {
  const { host, port, user, pass } = config.smtp;
  transport = host
    ? nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user ? { user, pass } : undefined,
        connectionTimeout: 15000,
      })
    : null;
  lastError = null;
}
resetMailer();

// "From" as set, else the site name with the SMTP login (most providers only send from that address).
const fromAddress = () => config.smtp.from || `${config.appName} <${config.smtp.user}>`;

export const mailStatus = () => ({ enabled: !!transport, host: config.smtp.host, from: fromAddress(), lastError });

/** Sends a plain-text e-mail, or prints it when SMTP is not set up. */
export async function sendMail(to, subject, text) {
  if (!transport) {
    console.log(`[mail disabled] to=${to} subject="${subject}"\n${text}\n`);
    return;
  }
  try {
    await transport.sendMail({ from: fromAddress(), to, subject, text });
    lastError = null;
  } catch (err) {
    lastError = { message: err.message, at: new Date() };
    console.error(`[mail] could not send to ${to}:`, err.message);
  }
}

/** Admin "send test e-mail": unlike sendMail, the SMTP error is shown to the admin. */
export async function sendTestMail(to) {
  if (!transport) throw new HttpError(400, 'Save an SMTP server first.', 'smtp_off');
  try {
    await transport.verify();
    await transport.sendMail({
      from: fromAddress(),
      to,
      subject: `${config.appName}: test e-mail`,
      text: `This is a test e-mail from the ${config.appName} admin panel. SMTP works.\n`,
    });
    lastError = null;
  } catch (err) {
    lastError = { message: err.message, at: new Date() };
    throw new HttpError(502, `SMTP error: ${String(err.message).slice(0, 300)}`, 'smtp_error');
  }
}
