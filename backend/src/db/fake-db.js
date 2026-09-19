// backend/src/db/fake-db.js
// In-memory fake database layer mimicking Supabase client and Postgres RPC functions.
// Guarantees all automated tests run 100% offline without hitting a real Supabase instance.

import crypto from 'crypto';

export class FakeDatabase {
  constructor() {
    this.reset();
  }

  reset() {
    this.tables = {
      tracked_products: new Map(),
      price_history: new Map(),
      scrape_log: new Map(),
      scrape_runs: new Map(),
      alerts: new Map()
    };
  }

  genId() {
    return crypto.randomUUID();
  }

  seedProduct(productData) {
    const id = productData.id || this.genId();
    const now = new Date().toISOString();
    const product = {
      id,
      store_product_id: String(productData.store_product_id),
      name: productData.name || 'Test Product',
      url: productData.url || `https://demo.inelabteamdev.com/product/${productData.store_product_id}`,
      image_url: productData.image_url || null,
      category: productData.category || 'Power',
      extra: productData.extra || {},
      scrape_interval_minutes: productData.scrape_interval_minutes || 120,
      is_active: productData.is_active !== undefined ? productData.is_active : true,
      last_scraped_at: productData.last_scraped_at || null,
      last_success_at: productData.last_success_at || null,
      next_scrape_at: productData.next_scrape_at || now,
      created_at: productData.created_at || now
    };
    this.tables.tracked_products.set(id, product);
    return product;
  }

  from(tableName) {
    const table = this.tables[tableName];
    if (!table) {
      throw new Error(`Unknown table in FakeDatabase: ${tableName}`);
    }

    const state = {
      table,
      tableName,
      filters: [],
      orderRule: null,
      limitCount: null,
      rangeBounds: null,
      isSingle: false,
      isMaybeSingle: false,
      insertedRows: null,
      updateFields: null,
      isDelete: false
    };

    const builder = {
      select: (columns = '*') => {
        state.columns = columns;
        return builder;
      },
      eq: (col, val) => {
        state.filters.push(row => row[col] === val || String(row[col]) === String(val));
        return builder;
      },
      neq: (col, val) => {
        state.filters.push(row => row[col] !== val && String(row[col]) !== String(val));
        return builder;
      },
      lte: (col, val) => {
        state.filters.push(row => new Date(row[col]) <= new Date(val));
        return builder;
      },
      gte: (col, val) => {
        state.filters.push(row => new Date(row[col]) >= new Date(val));
        return builder;
      },
      in: (col, vals) => {
        state.filters.push(row => vals.includes(row[col]) || vals.map(String).includes(String(row[col])));
        return builder;
      },
      order: (col, { ascending = true } = {}) => {
        state.orderRule = { col, ascending };
        return builder;
      },
      limit: (n) => {
        state.limitCount = n;
        return builder;
      },
      range: (from, to) => {
        state.rangeBounds = { from, to };
        return builder;
      },
      single: () => {
        state.isSingle = true;
        state.isMaybeSingle = false;
        return builder;
      },
      maybeSingle: () => {
        state.isSingle = true;
        state.isMaybeSingle = true;
        return builder;
      },
      insert: (rows) => {
        const rowArray = Array.isArray(rows) ? rows : [rows];
        const inserted = [];
        for (const r of rowArray) {
          const id = r.id || crypto.randomUUID();
          const record = { ...r, id };
          table.set(id, record);
          inserted.push(record);
        }
        state.insertedRows = inserted;
        return builder;
      },
      update: (fields) => {
        state.updateFields = fields;
        return builder;
      },
      delete: () => {
        state.isDelete = true;
        return builder;
      },
      then: (resolve, reject) => {
        // If an insert was performed
        if (state.insertedRows !== null) {
          if (state.isSingle) {
            resolve({ data: state.insertedRows[0] || null, error: null });
          } else {
            resolve({ data: state.insertedRows, error: null });
          }
          return;
        }

        // Apply filters
        let rows = Array.from(table.values());
        for (const f of state.filters) {
          rows = rows.filter(f);
        }

        // Handle delete
        if (state.isDelete) {
          let count = 0;
          for (const r of rows) {
            table.delete(r.id);
            count++;
          }
          resolve({ data: null, count, error: null });
          return;
        }

        // Handle update
        if (state.updateFields !== null) {
          const updated = [];
          for (const r of rows) {
            const newRecord = { ...r, ...state.updateFields };
            table.set(r.id, newRecord);
            updated.push(newRecord);
          }
          if (state.isSingle) {
            resolve({ data: updated[0] || null, error: null });
          } else {
            resolve({ data: updated, count: updated.length, error: null });
          }
          return;
        }

        // Sorting
        if (state.orderRule) {
          const { col, ascending } = state.orderRule;
          rows.sort((a, b) => {
            if (a[col] < b[col]) return ascending ? -1 : 1;
            if (a[col] > b[col]) return ascending ? 1 : -1;
            return 0;
          });
        }

        // Pagination
        if (state.rangeBounds) {
          const { from, to } = state.rangeBounds;
          rows = rows.slice(from, to + 1);
        } else if (state.limitCount !== null) {
          rows = rows.slice(0, state.limitCount);
        }

        if (state.isSingle) {
          if (rows.length === 0) {
            if (state.isMaybeSingle) {
              resolve({ data: null, error: null });
            } else {
              resolve({ data: null, error: { message: 'Row not found', code: 'PGRST116' } });
            }
          } else {
            resolve({ data: rows[0], error: null });
          }
        } else {
          resolve({ data: rows, error: null });
        }
      }
    };

    return builder;
  }

  async rpc(funcName, params = {}) {
    const now = new Date().toISOString();

    if (funcName === 'finalize_scrape_success') {
      const {
        p_scrape_log_id,
        p_product_id,
        p_price_cents,
        p_currency,
        p_in_stock,
        p_stock_quantity,
        p_flagged,
        p_attempts,
        p_status,
        p_duration_ms,
        p_http_status,
        p_extracted
      } = params;

      const product = this.tables.tracked_products.get(p_product_id);
      if (!product) {
        return { data: null, error: { message: `Product ${p_product_id} not found` } };
      }

      // Look up previous price history for product to check for price_drop and back_in_stock
      const prevHistories = Array.from(this.tables.price_history.values())
        .filter(h => h.product_id === p_product_id)
        .sort((a, b) => new Date(b.scraped_at) - new Date(a.scraped_at));
      const prevHistory = prevHistories[0];

      // 1. Update scrape_log
      const log = this.tables.scrape_log.get(p_scrape_log_id) || { id: p_scrape_log_id, product_id: p_product_id };
      log.status = p_status;
      log.attempts = p_attempts;
      log.finished_at = now;
      log.duration_ms = p_duration_ms;
      log.http_status = p_http_status;
      log.error_type = null;
      log.error_message = null;
      log.structure_changed = false;
      log.extracted = p_extracted;
      this.tables.scrape_log.set(p_scrape_log_id, log);

      // 2. Insert price_history (Atomic: only way price_history is inserted)
      const historyId = this.genId();
      const historyRecord = {
        id: historyId,
        product_id: p_product_id,
        price_cents: p_price_cents,
        currency: p_currency || 'INR',
        in_stock: p_in_stock,
        stock_quantity: p_stock_quantity !== undefined ? p_stock_quantity : null,
        flagged: Boolean(p_flagged),
        scraped_at: now,
        scrape_log_id: p_scrape_log_id
      };
      this.tables.price_history.set(historyId, historyRecord);

      // 3. Update tracked_products
      const intervalMins = product.scrape_interval_minutes || 120;
      const nextScrape = new Date(Date.now() + intervalMins * 60 * 1000).toISOString();
      product.last_scraped_at = now;
      product.last_success_at = now;
      product.next_scrape_at = nextScrape;
      this.tables.tracked_products.set(p_product_id, product);

      // 4. Trigger Alerts: price_drop
      if (prevHistory && p_price_cents < prevHistory.price_cents) {
        const alertId = this.genId();
        this.tables.alerts.set(alertId, {
          id: alertId,
          product_id: p_product_id,
          type: 'price_drop',
          message: `Price dropped from ${p_currency || 'INR'} ${(prevHistory.price_cents / 100).toFixed(2)} to ${p_currency || 'INR'} ${(p_price_cents / 100).toFixed(2)}`,
          created_at: now,
          is_read: false
        });
      }

      // 5. Trigger Alerts: back_in_stock
      if (prevHistory && prevHistory.in_stock === false && p_in_stock === true) {
        const alertId = this.genId();
        this.tables.alerts.set(alertId, {
          id: alertId,
          product_id: p_product_id,
          type: 'back_in_stock',
          message: 'Product is back in stock!',
          created_at: now,
          is_read: false
        });
      }

      return {
        data: {
          success: true,
          history_id: historyId,
          scrape_log_id: p_scrape_log_id
        },
        error: null
      };
    }

    if (funcName === 'finalize_scrape_failure') {
      const {
        p_scrape_log_id,
        p_product_id,
        p_attempts,
        p_status,
        p_duration_ms,
        p_http_status,
        p_error_type,
        p_error_message,
        p_structure_changed,
        p_extracted
      } = params;

      const product = this.tables.tracked_products.get(p_product_id);
      
      // 1. Update scrape_log
      const log = this.tables.scrape_log.get(p_scrape_log_id) || { id: p_scrape_log_id, product_id: p_product_id };
      log.status = p_status || 'failed';
      log.attempts = p_attempts;
      log.finished_at = now;
      log.duration_ms = p_duration_ms;
      log.http_status = p_http_status;
      log.error_type = p_error_type;
      log.error_message = p_error_message;
      log.structure_changed = Boolean(p_structure_changed);
      log.extracted = p_extracted || {};
      this.tables.scrape_log.set(p_scrape_log_id, log);

      // 2. Advance next_scrape_at on product if product exists
      if (product) {
        const intervalMins = product.scrape_interval_minutes || 120;
        product.last_scraped_at = now;
        product.next_scrape_at = new Date(Date.now() + intervalMins * 60 * 1000).toISOString();
        this.tables.tracked_products.set(p_product_id, product);
      }

      // 3. Create alert if structure changed
      if (p_structure_changed) {
        const alertId = this.genId();
        this.tables.alerts.set(alertId, {
          id: alertId,
          product_id: p_product_id,
          type: 'structure_changed',
          message: p_error_message || 'Store response structure changed',
          created_at: now,
          is_read: false
        });
      }

      // 4. Create alert if 3 consecutive scrapes failed
      const recentLogs = Array.from(this.tables.scrape_log.values())
        .filter(l => l.product_id === p_product_id)
        .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
        .slice(0, 3);
      
      const consecutiveFailures = recentLogs.filter(l => l.status === 'failed').length;
      if (consecutiveFailures >= 3) {
        const hasUnreadAlert = Array.from(this.tables.alerts.values())
          .some(a => a.product_id === p_product_id && a.type === 'scrape_failing' && !a.is_read);
        if (!hasUnreadAlert) {
          const alertId = this.genId();
          this.tables.alerts.set(alertId, {
            id: alertId,
            product_id: p_product_id,
            type: 'scrape_failing',
            message: `Scrape has failed 3 consecutive times: ${p_error_message || 'Persistent scrape error'}`,
            created_at: now,
            is_read: false
          });
        }
      }

      return {
        data: {
          success: false,
          scrape_log_id: p_scrape_log_id,
          error_type: p_error_type
        },
        error: null
      };
    }

    return { data: null, error: { message: `Unknown RPC function: ${funcName}` } };
  }
}

export const fakeDb = new FakeDatabase();
export function createFakeDatabase() {
  return new FakeDatabase();
}
export default fakeDb;
