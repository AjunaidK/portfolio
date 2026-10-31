// One-time copy: your local portfolio (data/site.db + uploads/ folder) → your Turso database.
// Usage (Mac terminal, in the project folder):
//   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run copy-to-turso
// It REPLACES what is in Turso with your local content. Your local files are not changed.
const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN first (see README → "Copy your local content to Turso").');
  process.exit(1);
}
const root = path.join(__dirname, '..');
const localFile = path.join(process.env.DATA_DIR || path.join(root, 'data'), 'site.db');
if (!fs.existsSync(localFile)) { console.error('No local database found at ' + localFile); process.exit(1); }

(async () => {
  const src = createClient({ url: 'file:' + localFile });
  const { init, client: dst } = require('../db');   // db.js connects to Turso because the env vars are set
  await init();                                     // makes sure Turso has all the tables
  const have = new Set((await src.execute(`SELECT name FROM sqlite_master WHERE type = 'table'`)).rows.map(r => r[0]));
  for (const t of ['settings', 'meta', 'admins', 'items', 'messages', 'views', 'files']) {
    if (!have.has(t)) continue;
    const r = await src.execute(`SELECT * FROM ${t}`);
    const stmts = [{ sql: `DELETE FROM ${t}`, args: [] }];
    for (const row of r.rows) stmts.push({ sql: `INSERT INTO ${t} (${r.columns.join(',')}) VALUES (${r.columns.map(() => '?').join(',')})`, args: r.columns.map((_, i) => row[i]) });
    // files can be large: send them a few at a time
    const size = t === 'files' ? 5 : 200;
    for (let i = 0; i < stmts.length; i += size) await dst.batch(stmts.slice(i, i + size), 'write');
    console.log(`  ${t}: ${r.rows.length} row(s)`);
  }
  // photos from the older version were saved as files in ./uploads
  const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.pdf': 'application/pdf' };
  const dir = path.join(root, 'uploads'); let n = 0;
  if (fs.existsSync(dir)) for (const name of fs.readdirSync(dir)) {
    const mime = MIME[path.extname(name).toLowerCase()]; if (!mime) continue;
    await dst.execute({ sql: 'INSERT OR REPLACE INTO files (name, mime, data) VALUES (?, ?, ?)', args: [name, mime, fs.readFileSync(path.join(dir, name))] }); n++;
  }
  if (n) console.log(`  uploads folder: ${n} file(s)`);
  console.log('\nDone. Your Turso database now has your local content.');
  process.exit(0);
})().catch(e => { console.error('Copy failed:', e.message); process.exit(1); });
