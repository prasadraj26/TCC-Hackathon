/**
 * authValidators.js
 *
 * Centralized email validation rules for Kongu College domain restriction.
 * Only accounts ending in exactly '@kongu.edu' are permitted on CampusBid.
 */

export const KONGU_EMAIL_DOMAIN = 'kongu.edu';

export const AUTH_ERROR_MESSAGES = {
  REGISTRATION_DOMAIN_DISALLOWED: 'CampusBid is restricted to Kongu Engineering College email addresses ending in @kongu.edu.',
  LOGIN_DOMAIN_DISALLOWED: 'Please sign in using your Kongu college email address.',
  BACKEND_FORBIDDEN_DOMAIN: 'Access forbidden: CampusBid is restricted to @kongu.edu email addresses.'
};

/**
 * Validates whether an email address belongs to the allowed Kongu domain (@kongu.edu).
 * - Ignores surrounding whitespace.
 * - Case-insensitive.
 * - Requires exact domain 'kongu.edu'.
 * - Rejects subdomains, lookalike domains, and public providers (gmail, yahoo, etc.).
 *
 * @param {string} email
 * @returns {boolean}
 */
export function isKonguEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();

  const match = trimmed.match(/^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)$/);
  if (!match) return false;

  const [, local, domain] = match;
  if (!local || local.length === 0) return false;
  return domain === KONGU_EMAIL_DOMAIN;
}

/**
 * Normalizes an email address by trimming and lowercasing.
 *
 * @param {string} email
 * @returns {string}
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}
