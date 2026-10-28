import { API_BASE } from './apiConfig';

/**
 * Calls POST /api/pricing/estimate
 * Returns the structured price estimate from the server.
 * @param {object} params
 * @param {object} headers  — auth headers from getAuthHeaders()
 */
export async function fetchPriceEstimate(params, headers) {
  const res = await fetch(`${API_BASE}/pricing/estimate`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Price estimation failed');
  return data.estimate;
}
