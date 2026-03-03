const BASE = import.meta.env.VITE_API_URL;

/**
 * Centralized fetch helper.
 * @param {string} path - API path (e.g. '/api/v1/calls/...')
 * @param {object} opts
 * @param {string} [opts.token] - Bearer token
 * @param {Function} [opts.onUnauthorized] - Called on 401 (e.g. logout)
 * @param {string} [opts.method='GET']
 * @param {object|FormData} [opts.body]
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, { token, onUnauthorized, method = 'GET', body } = {}) {
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData — browser sets it with the boundary
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body instanceof FormData
      ? body
      : body
        ? JSON.stringify(body)
        : undefined,
  });

  if (response.status === 401) {
    if (onUnauthorized) onUnauthorized();
    throw new Error('Unauthorized');
  }

  return response;
}
