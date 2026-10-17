import pg from 'pg';

export function databaseClient(connectionString) {
  if (!connectionString) throw new Error('Database connection is not configured');
  let url;
  try { url = new URL(connectionString); } catch { throw new Error('Invalid database connection configuration'); }
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  // URL SSL options can overwrite pg's verified TLS settings. Reject them instead.
  if ([...url.searchParams.keys()].some(k => k.startsWith('ssl'))) throw new Error('Remove SSL query options; configure OPS_DB_CA instead');
  return new pg.Client({ connectionString, connectionTimeoutMillis: 8000,
    statement_timeout: 10000, query_timeout: 15000, application_name: 'pulse-operations',
    ssl: local ? false : { rejectUnauthorized: true, ...(process.env.OPS_DB_CA ? { ca: process.env.OPS_DB_CA } : {}) } });
}
