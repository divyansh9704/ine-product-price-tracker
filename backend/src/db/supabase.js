// backend/src/db/supabase.js
// Database client manager supporting real Supabase Postgres and injected FakeDatabase for offline tests.

import { createClient } from '@supabase/supabase-js';
import config from '../config.js';
import { fakeDb } from './fake-db.js';

let activeClient = null;

export function createSupabaseClient(cfg = config) {
  const url = cfg.supabase?.url || cfg.SUPABASE_URL || process.env.SUPABASE_URL;
  const key = cfg.supabase?.serviceRoleKey || cfg.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to create a Supabase client');
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    realtime: {
      transport: class NodeWebSocketShim {}
    }
  });
}

export function getDb() {
  if (activeClient) {
    return activeClient;
  }

  // If in test environment or credentials are not supplied, default to fakeDb
  if (config.isTest || !config.supabase.url || !config.supabase.serviceRoleKey) {
    activeClient = fakeDb;
    return activeClient;
  }

  activeClient = createSupabaseClient(config);
  return activeClient;
}

// Allows injecting a mock database client for tests
export function setDbClient(client) {
  activeClient = client;
}

// Resets back to default
export function resetDbClient() {
  activeClient = null;
}

// Health check to test database connectivity
export async function checkDbConnection() {
  try {
    const db = getDb();
    // Test simple select on tracked_products
    const { data, error } = await db.from('tracked_products').select('id').limit(1);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, isFake: db === fakeDb };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export default getDb;
