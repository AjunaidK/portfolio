// SQLite storage: settings, collections (projects/experience/skills/posts), messages, page views, admins
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { SETTINGS, COLLECTIONS, SEED } = require('./schema');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'site.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection TEXT NOT NULL,
  data TEXT NOT NULL,          -- JSON object with the collection's fields
  sort INTEGER DEFAULT 0,
  visible INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_items_col ON items(collection, sort);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, email TEXT, subject TEXT, body TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS views (day TEXT, path TEXT, count INTEGER DEFAULT 0, PRIMARY KEY (day, path));
`);

// default settings
const ALL_SETTING_FIELDS = SETTINGS.flatMap(g => g.fields);
const insS = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
ALL_SETTING_FIELDS.forEach(f => insS.run(f.key, f.default ?? ''));

// seed collections on first run
for (const [col, rows] of Object.entries(SEED)) {
  if (db.prepare('SELECT COUNT(*) c FROM items WHERE collection = ?').get(col).c) continue;
  const ins = db.prepare('INSERT INTO items (collection, data, sort) VALUES (?, ?, ?)');
  rows.forEach((r, i) => ins.run(col, JSON.stringify(r), i));
}

// first admin
if (!db.prepare('SELECT COUNT(*) c FROM admins').get().c) {
  const u = process.env.ADMIN_USER || 'admin', p = process.env.ADMIN_PASSWORD || 'changeme123';
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(u, bcrypt.hashSync(p, 10));
  console.log(`\n  Admin account created → username: ${u}  password: ${p}\n  Change it in Admin → Account after logging in.\n`);
}

function getSettings() {
  const s = {};
  db.prepare('SELECT key, value FROM settings').all().forEach(r => (s[r.key] = r.value));
  return s;
}
function saveSettings(obj) {
  const types = Object.fromEntries(ALL_SETTING_FIELDS.map(f => [f.key, f.type]));
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  db.transaction(() => {
    for (let [k, v] of Object.entries(obj)) {
      if (!types[k]) continue;
      if (Array.isArray(v)) v = v.map(x => String(x).trim()).filter(Boolean).join(types[k] === 'tags' ? ', ' : '\n');
      if (typeof v === 'boolean') v = v ? '1' : '0';
      up.run(k, String(v ?? '').slice(0, 100000));
    }
  })();
}

function listItems(col, { onlyVisible = false } = {}) {
  return db.prepare(`SELECT * FROM items WHERE collection = ? ${onlyVisible ? 'AND visible = 1' : ''} ORDER BY sort, id`).all(col)
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

module.exports = { db, getSettings, saveSettings, listItems, cleanItem, ALL_SETTING_FIELDS };
