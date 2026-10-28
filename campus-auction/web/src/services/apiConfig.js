const rawApiBase = import.meta.env.VITE_API_BASE_URL;

/**
 * Dynamically resolves the API base URL:
 * 1. Uses explicit VITE_API_BASE_URL if configured.
 * 2. In production (e.g. deployed on Vercel), defaults to relative '/api' which
 *    is handled by the same origin reverse-proxy rewrite in vercel.json.
 *    This avoids mixed-content (HTTPS -> HTTP localhost) and cross-origin preflight errors.
 * 3. In local development, defaults to 'http://localhost:5000/api'.
 */
export const API_BASE = rawApiBase
  ? rawApiBase.replace(/\/+$/, '')
  : (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');
