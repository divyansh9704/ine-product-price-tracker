# Reconnaissance Report: INE Mock Store (`https://demo.inelabteamdev.com/`)

## 1. Executive Summary & Core Architectural Discovery
During reconnaissance of `https://demo.inelabteamdev.com/`, we conducted static bundle deobfuscation, network API probing, and browser runtime inspection (using Chrome DevTools Protocol).

The mock store is an SPA running React 19 and React Router. The raw HTML served at the root or any product URL is an empty 459-byte shell (`<div id="root"></div>`). However, the store is **fully API-driven** under `/api/*`, equipped with client-side anti-scraping traps and a cryptographic challenge protocol:
1. **Catalog & Product APIs**: Open JSON endpoints (`/api/catalog`, `/api/product/:id`, `/api/layout`).
2. **Price & Stock Challenge Protocol**: Price and stock are **not** present in `/api/product/:id`. They are requested asynchronously via a challenge handshake (`/api/challenge` -> `/api/session` -> `/api/products/:id/price`), secured by WebAssembly execution, SHA-256 proof-of-work, and XOR payload encryption with key derivation from `ine-mock-store-shared-k3y`.
3. **Frontend DOM Traps**: When rendered in a browser DOM, the React client injects hidden decoy prices, zero-width spaces (`\u200B`), unicode full-width digits, scrambled CSS class names from `/api/layout`, a cookie overlay modal, and a randomized flaky delay wrapper (`Xn`).

---

## 2. API Endpoints (Fetch / XHR Analysis)

### 2.1 Catalog Endpoint
- **URL**: `GET https://demo.inelabteamdev.com/api/catalog`
- **Query Params**:
  - `page` (integer, 1-indexed, default: 1)
  - `pageSize` (integer, default: 20, capped at 60)
- **Sample Response**:
```json
{
  "page": 1,
  "pageSize": 20,
  "total": 1000,
  "pages": 50,
  "items": [
    {
      "id": 125,
      "slug": "copperpot-solar-charger-mini",
      "name": "Copperpot Solar Charger Mini",
      "brand": "Copperpot",
      "category": "Power",
      "sku": "COP-10125",
      "description": "The Copperpot Solar Charger Mini. A dependable power pick..."
    }
  ]
}
```
- **Ordering Behavior**: On every request without server-side sorting, the catalog order shuffles/randomizes. Query parameters like `?q=`, `?search=`, and `?category=` return HTTP 200 but do not filter on the server (the store frontend loads pages and assumes client browsing).

### 2.2 Product Details Endpoint
- **URL**: `GET https://demo.inelabteamdev.com/api/product/:id` (e.g. `/api/product/125`)
- **Sample Response**:
```json
{
  "id": 125,
  "slug": "copperpot-solar-charger-mini",
  "name": "Copperpot Solar Charger Mini",
  "brand": "Copperpot",
  "category": "Power",
  "sku": "COP-10125",
  "description": "...",
  "specs": {
    "warranty": "2 years international warranty",
    "inTheBox": "...",
    "countryOfOrigin": "Malaysia",
    "returns": "7-day replacement, unopened",
    "support": "...",
    "weightGrams": 153,
    "material": "Flame-retardant polycarbonate",
    "colour": "Slate Grey",
    "modelYear": 2024
  },
  "reviews": [ ... ]
}
```
*Note*: Neither price nor stock is present in this payload.

### 2.3 Layout Configuration Endpoint
- **URL**: `GET https://demo.inelabteamdev.com/api/layout`
- **Sample Response**:
```json
{
  "revision": 626001,
  "variant": 3,
  "validUntil": 1789818376939,
  "classes": {
    "priceWrap": "pw-m4",
    "priceValue": "pv-m4",
    "mrp": "mr-m4",
    "sale": "sl-m4",
    "badge": "bd-m4",
    "rating": "rt-m4",
    "seller": "sr-m4",
    "delivery": "dl-m4",
    "stock": "st-m4"
  },
  "order": ["delivery", "rating", "stock", "seller"],
  "priceTag": "output",
  "priceCarrier": "split",
  "ratingAria": false,
  "sellerTitle": true
}
```

### 2.4 Cryptographic Price Retrieval Protocol
The price and stock are protected by an interactive challenge protocol:
1. `GET /api/challenge`
   Returns: `{ salt, ts, difficulty, csig, wasm }`
2. **Client Computation**:
   - `s = sha256(attestation_json)`
   - `seed = parseInt(sha256("ine-mock-store-shared-k3y|seed|" + salt + "|" + s).slice(0, 8), 16) | 0`
   - `wasmOut = wasmInstance.exports.f(seed) | 0`
   - `nonce = xr(salt, difficulty)` (finds integer where `sha256(salt + ":" + nonce)` starts with `difficulty` zeroes)
   - `derived = sha256("ine-mock-store-shared-k3y|derive|" + salt + "|" + wasmOut + "|" + s)`
3. `POST /api/session`
   Payload: `{ ...challengeData, nonce, derived, wasmOut, att, productId }`
   Returns: `{ token, expiresInMs: 30000 }`
4. `GET /api/products/:productId/price`
   Headers: `Authorization: Bearer <token>`
   Returns: `{ e: "<base64 cipher>" }`
5. **Decryption**:
   XOR cipher with `sha256("ine-mock-store-shared-k3y|enc|" + token)`.
   Decrypted JSON:
```json
{
  "p": 1475,
  "m": 1695,
  "n": 1585,
  "b": 8,
  "s": 0,
  "c": "INR",
  "t": 1789810868901,
  "r": 3.5,
  "rc": 25011,
  "sl": "Cobblestone Supply",
  "dd": 6,
  "v": "triple",
  "g": 0,
  "f": "trailing",
  "x": 1
}
```

---

## 3. Product Fields & Search Mechanics

### Fields Available
- `id`: Unique integer (e.g. 125, range 1 to 1000).
- `store_product_id`: `prod_${id}` or integer string `125`.
- `name`: Product name (e.g., "Copperpot Solar Charger Mini").
- `slug`: URL slug (e.g., `copperpot-solar-charger-mini`).
- `brand`: Brand string (e.g., `Copperpot`, `Nordkraft`, `Cobalt`).
- `category`: Category string (`Power`, `Audio`, `Laptops`, `Wearables`, `Monitors`, `Peripherals`, `Smart Home`, `Bags`, `Kitchen`, `Footwear`).
- `sku`: SKU code (e.g. `COP-10125`).
- `description`: Text overview.
- `price_cents`: `shown * 100` (e.g., `p = 1475` -> ₹1475 -> 147500 cents).
- `currency`: Currency code (e.g. `INR`).
- `in_stock`: `stock > 0` boolean (`s: 0` -> false).
- `stock_quantity`: integer `s` (nullable).
- `extra`: JSON containing `specs`, `reviews_count`, `rating`, `mrp`, `sale_price`, `seller`.

### How Search Works
The mock store does not expose a server-side search filter endpoint; `/api/catalog` returns 20 items per page from a total pool of 1,000 products.
Therefore, for our backend API (`GET /api/store/search?q=`):
- The backend will fetch and cache the catalog items (17 pages at 60 items/page, cached in-memory with a 15-minute TTL).
- Searches are executed in memory against `name`, `brand`, `category`, and `sku` using case-insensitive substring matching.
- Partial matches (e.g. "copper", "solar charger", "nord") return instant, accurate results without pounding the upstream server.

---

## 4. Async Delays, Placeholders & Anti-Scraping Traps

### In the Browser DOM:
1. **Initial Idle State**: Shows "Price hidden" with subtitle "Hover over the price area to load the current price." The button "Reveal price" is initially `disabled`.
2. **Dwell & Movement Requirement**: The component requires at least 8 mouse move events separated by $\ge 40\text{ ms}$ and $\ge 600\text{ ms}$ total dwell time before enabling the button.
3. **Cookie Consent Overlay**: An overlay (`.cookie-overlay`) intercepts all pointer events until the "Accept" or "Decline" button is dismissed.
4. **Flaky Wrapper (`Xn`)**: Click handlers have a 35% probability of either dropping the click or introducing a 900ms delay.
5. **Decoy Prices**:
   - `<span class="price-value" aria-hidden="true" style="display:none">{d1}</span>`
   - `<span class="amount" data-price="true" aria-hidden="true" style="display:none">{d2}</span>`
   Any scraper using standard selectors like `.price-value` or `[data-price="true"]` extracts calculated decoys ($d_1$ or $d_2$).
6. **Scrambled Formatting & Zero-Width Spaces**:
   - Digits split across `<span>` tags with `\u200B` zero-width separators.
   - Varied formatting: `spaced` (`1 475`), `euro` (`1.475,00`), `trailing` (`₹1,475/-`), `unicode` (fullwidth digits), `lakh` (`Rs. ...`).
   - Dynamic tag names (`<output>`, `<data>`, `<span>`) and classes (`pv-m4`, `pw-m4`) from `/api/layout`.

### In the Price Protocol:
- **Placeholder / Stale Flag (`g: 1`)**:
  When `g: 1` and `v: 'stale'`, the store has not finished computing or refreshing the price. Storing this as valid price history would violate rule #1. It must be treated as `PLACEHOLDER_CONTENT` and retried.

---

## 5. Error Behavior & Rate Limits
1. **HTTP 503 / 500 (Upstream Error)**: Seen intermittently on `/api/products/:id/price` (~15-20% of calls). Must be classified as `HTTP_5XX` and retried with exponential backoff.
2. **HTTP 429 (Too Many Requests)**: Triggered if session creation or price requests are hammered without throttling. Must be classified as `RATE_LIMITED` and respect `Retry-After`.
3. **HTTP 401 (Unauthorized)**: Triggered if the environment attestation (`att`), wasm output, proof-of-work nonce, or signature fails.
4. **Transient Slowness**: Responses from `/api/products/:id/price` occasionally take 2-4 seconds. Hard timeouts of 10s with `AbortController` prevent hanging.

---

## 6. Architectural Decision: Primary Path vs Headed/Fallback

### The Decision
- **Primary Scraper Path**: **Lightweight Direct HTTP + Protocol Parser** in Node.js.
- **Observable / Verification Mode (Headed)**: **Playwright Browser** (`npm run scrape:headed`).

### Justification
1. **Resource Constraints on Free-Tier Render (512 MB RAM)**:
   Running Chromium/Playwright in the background on Render free tier consumes 300–450 MB RAM, leading to memory spikes, OOM (SIGKILL) crashes, and high failure rates during unattended runs every 2 hours.
2. **Immunity to DOM Traps & Scrambling**:
   The direct protocol operates directly on the un-scrambled, exact integer values (`p`, `s`, `c`, `t`, `g`). It completely bypasses zero-width spaces, randomized class names, hidden decoy elements, and cookie overlays.
3. **Latency & Reliability**:
   The direct HTTP flow executes in $\approx 146\text{ ms} - 2,400\text{ ms}$ (vs. 6–10 seconds in a full browser with artificial dwell and move simulation).
4. **Observable Headed Mode**:
   Playwright will be fully implemented and supported via `npm run scrape:headed` for the required live visual demonstration, fault injection, and screen recording script. It cross-checks the browser-rendered DOM price against the direct protocol result.
