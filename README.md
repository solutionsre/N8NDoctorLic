# n8n Doctor license website

MERN site (Express + MongoDB + React/Vite), adapted from the RSS license site. Customers register, confirm their e-mail, then **start a free trial or buy a plan** (Khalti / eSewa) for their **Machine ID**. The site hands back the same signed key the manual `license_generator_tool.py` produces, so **n8n Doctor needs no changes**: the customer pastes the key (or the `.lic` file) into License Manager → Activate / Renew License.

## How keys work
- `server/src/lib/signing.js` signs `base64(JSON)` with the Ed25519 key from `vendor_private_key.hex`, using the same field order as `LicenseRecord.canonical_payload()`.
- Plans: `trial`, `monthly` (30 d), `sixmonth` (sent to the app as `half_yearly`, 182 d), `yearly`. Prices/days are in `.env` and Admin → Settings.
- Keys are built on demand from the license record, so a renewal, extension or admin "± days" just produces a new key; the customer pastes it into **Renew License**.

## Rules enforced
| Rule | Where |
|---|---|
| Trial once per **account**, once per **Machine ID** (even from a new account), never on a machine that already has a license; needs a confirmed e-mail | `licenseService.startTrial`, `TrialMachine` (unique index), `User.trialUsed` (atomic) |
| Machine ID must be 16 groups of 4 hex characters, stored upper-case exactly as the app prints it | `lib/machine.js` |
| One license record per machine (unique index). Buying for a machine that belongs to another account is refused; buying again for your own machine renews it | `routes/payments.js` checkout, `License.machineId` |
| Blocked (revoked) licenses get no key and cannot be renewed | `toPublic`, checkout |
| Paid-only 3-day extension, once per period, in the last 7 days (kept from the reference site) | `licenseService.extendLicense` |
| Lockout after wrong passwords, e-mail codes, reminder e-mails, admin panel, test/live payments | unchanged from the reference site |

Admin can change a license's machine (Licenses → "Change machine") after a hardware change, give licenses (needs a Machine ID), reset a trial (also frees the machine for a new trial) and block users/licenses.

## Run it
```bash
cd server
cp .env.example .env     # fill JWT_SECRET, CLIENT_URL, SMTP, payment keys...
# LICENSE_PRIVATE_KEY_HEX = contents of vendor-license-tool/vendor_keys/vendor_private_key.hex
npm install
npm run keys             # prints the public key: must equal PUBLIC_KEY_HEX in app/backend/license/public_key.py
npm run dev              # http://localhost:5000

cd ../client && npm install && npm run dev   # http://localhost:5173
npm run make-admin -- you@example.com        # in server/, after registering
```
Keep the private key only on the server; never put it in the client or in git.

## Limits to know about
- Licensing is offline, as in the app today: blocking a license stops new keys, but a key already pasted into an app works until it expires (same as the manual tool).
- The app also has its own built-in no-key trial; that is separate and unchanged. Only site-issued trials are limited by machine here.
- `lifetime`/`quarterly` types exist in the app but are not on sale; adding them means a new entry in `PLANS` (`config.js`, `settings.js`) and `APP_TYPE` (`signing.js`).
- Nothing was run or tested (as requested): run `npm install` and a test purchase in `PAYMENT_MODE=test` before going live.
"# N8NDoctorLic" 
