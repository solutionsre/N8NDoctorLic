// Machine IDs come from n8n Doctor > License Manager: 16 groups of 4 hex characters.
// Kept exactly as the app prints them (uppercase), because the app compares them as plain text.
const RE = /^([0-9A-F]{4}-){15}[0-9A-F]{4}$/;

/** Trims and upper-cases; returns '' unless it is a well-formed machine ID. */
export function normalizeMachineId(input) {
  const s = String(input || '').trim().toUpperCase().replace(/\s+/g, '');
  return RE.test(s) ? s : '';
}
