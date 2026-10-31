// Database layer (libSQL — the same SQLite you had, but it can also live in the cloud)
// - On your computer: no env vars needed → a normal SQLite file at ./data/site.db
// - Free hosting (Render free + Turso): set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
// Uploaded images and your CV are stored in the database too, so a server restart never loses them.
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { SETTINGS, COLLECTIONS, SEED } = require('./schema');

let url = process.env.TURSO_DATABASE_URL;
if (!url) {
  const dir = process.env.DATA_DIR || path.join(__dirname, 'data');
  fs.mkdirSync(dir, { recursive: true });
  url = 'file:' + path.join(dir, 'site.db');
}
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

function wrap(ex) {
  const norm = a => a.map(x => (x === undefined ? null : typeof x === 'boolean' ? (x ? 1 : 0) : x));
  const objs = r => r.rows.map(row => Object.fromEntries(r.columns.map((c, i) => [c, row[i]])));
  return {
    all: async (sql, ...a) => objs(await ex.execute({ sql, args: norm(a) })),
    get: async (sql, ...a) => objs(await ex.execute({ sql, args: norm(a) }))[0],
    run: async (sql, ...a) => { const r = await ex.execute({ sql, args: norm(a) }); return { id: Number(r.lastInsertRowid ?? 0), changes: r.rowsAffected }; },
  };
}
const db = wrap(client);
db.batch = stmts => client.batch(stmts.map(([sql, ...args]) => ({ sql, args })), 'write');

const ALL_SETTING_FIELDS = SETTINGS.flatMap(g => g.fields);

// create tables, defaults, first admin; returns the login-signing secret
async function init() {
  await client.batch([
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
    `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`,
    `CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, collection TEXT NOT NULL, data TEXT NOT NULL,
      sort INTEGER DEFAULT 0, visible INTEGER DEFAULT 1, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS idx_items_col ON items(collection, sort)`,
    `CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, subject TEXT, body TEXT,
      is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS views (day TEXT, path TEXT, count INTEGER DEFAULT 0, PRIMARY KEY (day, path))`,
    `CREATE TABLE IF NOT EXISTS files (name TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
  ], 'write');

  await client.batch(ALL_SETTING_FIELDS.map(f => ({ sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', args: [f.key, String(f.default ?? '')] })), 'write');

  for (const [col, rows] of Object.entries(SEED)) {
    if ((await db.get('SELECT COUNT(*) c FROM items WHERE collection = ?', col)).c) continue;
    await db.batch(rows.map((r, i) => ['INSERT INTO items (collection, data, sort) VALUES (?, ?, ?)', col, JSON.stringify(r), i]));
  }

  if (!(await db.get('SELECT COUNT(*) c FROM admins')).c) {
    const u = process.env.ADMIN_USER || 'admin', p = process.env.ADMIN_PASSWORD || 'changeme123';
    await db.run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', u, bcrypt.hashSync(p, 10));
    console.log(`\n  Admin account created → username: ${u}\n  (password from ADMIN_PASSWORD, or "changeme123" if not set — change it in Admin → Account)\n`);
  }

  // the key that signs admin logins: JWT_SECRET if set, otherwise made once and kept in the database
  let secret = process.env.JWT_SECRET || (await db.get(`SELECT value FROM meta WHERE key = 'jwt_secret'`))?.value;
  if (!secret) { secret = crypto.randomBytes(48).toString('hex'); await db.run(`INSERT INTO meta (key, value) VALUES ('jwt_secret', ?)`, secret); }
  return { secret, where: process.env.TURSO_DATABASE_URL ? 'Turso cloud database' : url };
}

async function getSettings() {
  const s = {};
  (await db.all('SELECT key, value FROM settings')).forEach(r => (s[r.key] = r.value));
  return s;
}
async function saveSettings(obj) {
  const types = Object.fromEntries(ALL_SETTING_FIELDS.map(f => [f.key, f.type]));
  const stmts = [];
  for (let [k, v] of Object.entries(obj)) {
    if (!types[k]) continue;
    if (Array.isArray(v)) v = v.map(x => String(x).trim()).filter(Boolean).join(types[k] === 'tags' ? ', ' : '\n');
    if (typeof v === 'boolean') v = v ? '1' : '0';
    stmts.push(['INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, String(v ?? '').slice(0, 100000)]);
  }
  if (stmts.length) await db.batch(stmts);
}

async function listItems(col, { onlyVisible = false } = {}) {
  return (await db.all(`SELECT * FROM items WHERE collection = ? ${onlyVisible ? 'AND visible = 1' : ''} ORDER BY sort, id`, col))
    .map(r => ({ id: r.id, visible: !!r.visible, sort: r.sort, ...JSON.parse(r.data) }));
}

// Keep only fields defined in the schema, coerced to the right type
function cleanItem(col, input) {
  const def = COLLECTIONS[col];
  const out = {};
  for (const f of def.fields) {
    let v = input[f.key];
    switch (f.type) {
      case 'bool': v = v === true || v === 'true' || v === '1' || v === 1; break;
      case 'number': v = v === '' || v == null ? '' : Number(v) || 0; break;
      case 'tags': v = Array.isArray(v) ? v : String(v ?? '').split(','); v = v.map(x => String(x).trim()).filter(Boolean).slice(0, 50); break;
      case 'lines': v = Array.isArray(v) ? v : String(v ?? '').split('\n'); v = v.map(x => String(x).trim()).filter(Boolean).slice(0, 50); break;
      case 'images': v = (Array.isArray(v) ? v : []).map(x => String(x).trim()).filter(x => /^(\/uploads\/|https?:\/\/)/.test(x)).slice(0, 30); break;
      case 'select': v = f.options.includes(v) ? v : f.options[0]; break;
      case 'date': v = /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : ''; break;
      default: v = String(v ?? '').slice(0, f.type === 'markdown' ? 100000 : 2000);
    }
    out[f.key] = v;
  }
  const missing = def.fields.find(f => f.required && !out[f.key]);
  if (missing) throw new Error(`${missing.label} is required`);
  if (def.slugged) {
    out.slug = (out.slug || out.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'post';
  }
  return out;
}

module.exports = { db, client, init, getSettings, saveSettings, listItems, cleanItem, ALL_SETTING_FIELDS };
