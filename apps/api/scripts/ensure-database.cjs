/**
 * Crée la base de données de `DATABASE_URL` si elle n'existe pas (utilisé par les E2E UI,
 * qui tournent sur une base dédiée à côté de celle de la démo).
 */
const { Client } = require('pg');

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z0-9_]+$/i.test(database)) throw new Error(`Invalid database name: ${database}`);

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      database,
    ]);
    if (rowCount === 0) await client.query(`CREATE DATABASE "${database}"`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
