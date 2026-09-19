// backend/src/server.js
// Production server entrypoint.

import { config } from './config.js';
import { createApp } from './app.js';
import { createSupabaseClient } from './db/supabase.js';
import { createFakeDatabase } from './db/fake-db.js';

let db;
if (config.supabase.url && config.supabase.serviceRoleKey) {
  console.log('🔌 Connecting to Supabase PostgreSQL at:', config.supabase.url);
  db = createSupabaseClient(config);
} else {
  console.log('⚠️  No Supabase credentials provided. Initializing in-memory FakeDatabase for local development.');
  db = createFakeDatabase();
}

const app = createApp({ db, config });

const server = app.listen(config.port, config.host, () => {
  console.log(`====================================================`);
  console.log(`🚀 Server listening on http://${config.host}:${config.port} (${config.nodeEnv})`);
  console.log(`📡 Health check:  http://${config.host}:${config.port}/health`);
  console.log(`🔍 Store search:  http://${config.host}:${config.port}/api/store/search?q=125`);
  console.log(`📦 Tracked list:  http://${config.host}:${config.port}/api/products`);
  console.log(`====================================================`);
});

// Graceful shutdown
function shutdown() {
  console.log('\n🛑 Gracefully shutting down HTTP server...');
  server.close(() => {
    console.log('👋 HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
