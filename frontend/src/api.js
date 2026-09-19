// frontend/src/api.js
// Centralized API client reading VITE_API_URL with cold-start detection.

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

export const coldStartListeners = new Set();
function notifyColdStart(isCold) {
  coldStartListeners.forEach(cb => cb(isCold));
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = {
    'Accept': 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers
  };

  // Detect potential cold-start if request takes longer than 2.5 seconds
  let timerId = setTimeout(() => {
    notifyColdStart(true);
  }, 2500);

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });

    clearTimeout(timerId);
    notifyColdStart(false);

    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      const errorMsg = data?.error || data?.message || `Request failed with status ${res.status}`;
      const err = new Error(errorMsg);
      err.status = res.status;
      err.details = data;
      throw err;
    }

    return data;
  } catch (err) {
    clearTimeout(timerId);
    notifyColdStart(false);
    throw err;
  }
}

export const api = {
  // Health
  getHealth: () => request('/health'),

  // Store Search
  searchCatalog: (query = '') => request(`/api/store/search?q=${encodeURIComponent(query)}`),

  // Products
  getProducts: () => request('/api/products'),
  getProduct: (id) => request(`/api/products/${id}`),
  trackProduct: (productData) => request('/api/products', {
    method: 'POST',
    body: JSON.stringify(productData)
  }),
  updateProduct: (id, updates) => request(`/api/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  }),
  deleteProduct: (id) => request(`/api/products/${id}`, {
    method: 'DELETE'
  }),
  getProductHistory: (id, limit = 500) => request(`/api/products/${id}/history?limit=${limit}`),
  getProductLogs: (id, limit = 50, offset = 0) => request(`/api/products/${id}/logs?limit=${limit}&offset=${offset}`),
  scrapeProductNow: (id) => request(`/api/products/${id}/scrape`, {
    method: 'POST'
  }),

  // Alerts
  getAlerts: (unack = true) => request(`/api/alerts?unacknowledged=${unack}`),
  ackAlert: (id) => request(`/api/alerts/${id}/ack`, {
    method: 'PATCH'
  })
};

export default api;
