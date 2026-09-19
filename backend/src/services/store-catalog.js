// backend/src/services/store-catalog.js
// In-memory cached catalog search for INE store products with 15-minute TTL.

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
let catalogCache = [];
let cacheTimestamp = 0;

/**
 * Refreshes catalog cache from upstream store.
 */
export async function refreshCatalogCache(options = {}) {
  const baseUrl = options.baseUrl || 'https://demo.inelabteamdev.com';
  const customFetch = options.fetch || globalThis.fetch;

  try {
    // Fetch first 2 pages (120 items) with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await customFetch(`${baseUrl}/api/catalog?pageSize=60&page=1`, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.items)) {
        catalogCache = data.items;
        cacheTimestamp = Date.now();
      }
    }
  } catch (err) {
    // Non-fatal: if catalog fetch fails, preserve existing cache or empty array
    console.warn(`[StoreCatalog] Failed to refresh catalog cache: ${err.message}`);
  }

  return catalogCache;
}

/**
 * Searches the store catalog by keyword or exact product ID.
 */
export async function searchStoreCatalog(query, options = {}) {
  const baseUrl = options.baseUrl || 'https://demo.inelabteamdev.com';
  const customFetch = options.fetch || globalThis.fetch;

  const now = Date.now();
  if (catalogCache.length === 0 || now - cacheTimestamp > CACHE_TTL_MS) {
    await refreshCatalogCache(options);
  }

  const cleanQuery = String(query || '').trim().toLowerCase();
  const results = [];
  const seenIds = new Set();

  // If query is a numeric store product ID, attempt direct lookup first
  const numericId = parseInt(cleanQuery, 10);
  if (!Number.isNaN(numericId) && numericId > 0 && String(numericId) === cleanQuery) {
    try {
      const pRes = await customFetch(`${baseUrl}/api/product/${numericId}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData && pData.id) {
          results.push({
            id: pData.id,
            name: pData.name,
            brand: pData.brand,
            category: pData.category,
            sku: pData.sku,
            description: pData.description,
            slug: pData.slug
          });
          seenIds.add(pData.id);
        }
      }
    } catch {
      // Direct lookup failed; proceed to search cache
    }
  }

  // Filter cached catalog
  for (const item of catalogCache) {
    if (seenIds.has(item.id)) continue;

    if (!cleanQuery) {
      results.push(item);
      seenIds.add(item.id);
      if (results.length >= 20) break;
      continue;
    }

    const matches =
      String(item.id).includes(cleanQuery) ||
      (item.name && item.name.toLowerCase().includes(cleanQuery)) ||
      (item.brand && item.brand.toLowerCase().includes(cleanQuery)) ||
      (item.category && item.category.toLowerCase().includes(cleanQuery)) ||
      (item.sku && item.sku.toLowerCase().includes(cleanQuery));

    if (matches) {
      results.push(item);
      seenIds.add(item.id);
      if (results.length >= 20) break;
    }
  }

  return results;
}

/**
 * Resets cache (useful for testing).
 */
export function resetCatalogCache() {
  catalogCache = [];
  cacheTimestamp = 0;
}
