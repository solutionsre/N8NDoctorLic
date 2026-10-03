import { config } from '../config.js';

/** Page id => title. The text of each page is written in Admin → Settings → Legal pages. */
export const LEGAL_PAGES = {
  terms: 'Terms of service',
  privacy: 'Privacy policy',
  refund: 'Refund policy',
};

/** Pages that have text, so the footer only links to pages that exist. */
export const publishedLegalPages = () => Object.keys(LEGAL_PAGES).filter((id) => config.legal[id]?.trim());

/**
 * A legal page as visitors see it: the admin's text with {site}, {company}
 * and {email} filled in from the site settings. Empty when not written yet.
 */
export function legalText(page) {
  const raw = config.legal[page] || '';
  return raw
    .replaceAll('{site}', config.appName)
    .replaceAll('{company}', config.site.company || config.appName)
    .replaceAll('{email}', config.site.supportEmail);
}
