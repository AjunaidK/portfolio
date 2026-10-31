// Personal profile website + admin panel
// Run: npm start  →  site at http://localhost:3000, admin at http://localhost:3000/admin
// Data lives in ./data/site.db on your computer, or in Turso when TURSO_DATABASE_URL is set (see README).
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { SETTINGS, COLLECTIONS } = require('./schema');
const { db, init, getSettings, saveSettings, listItems, cleanItem } = require('./db');

const PORT = process.env.PORT || 3000;
const OLD_UPLOAD_DIR = path.join(__dirname, 'uploads');   // older versions kept photos here; imported once at start-up
let JWT_SECRET;                                            // set at start-up by init()

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ---------- helpers ----------
const A = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const str = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const hits = new Map();
function limited(key, max, ms) {
  const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < ms);
  arr.push(now); hits.set(key, arr); return arr.length > max;
}
const today = () => new Date().toISOString().slice(0, 10);

// Uploads are stored in the database (files table) so free hosting never loses them
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^(image\/(jpeg|png|webp|gif|avif)|application\/pdf)$/.test(file.mimetype)),
});
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif', 'application/pdf': '.pdf' };
const MIME = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m])); MIME['.jpeg'] = 'image/jpeg';

app.get('/uploads/:name', A(async (req, res) => {
  const name = path.basename(req.params.name);
  const f = await db.get('SELECT mime, data FROM files WHERE name = ?', name);
  if (!f) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=31536000, immutable').type(f.mime);
  if (f.mime === 'application/pdf') res.set('Content-Disposition', 'inline');
  res.send(Buffer.from(f.data));
}));

// photos uploaded with the older version (saved as files in ./uploads) are copied into the database once
async function importOldUploads() {
  if (!fs.existsSync(OLD_UPLOAD_DIR)) return 0;
  let n = 0;
  for (const name of fs.readdirSync(OLD_UPLOAD_DIR)) {
    const mime = MIME[path.extname(name).toLowerCase()];
    if (!mime || (await db.get('SELECT 1 x FROM files WHERE name = ?', name))) continue;
    await db.run('INSERT INTO files (name, mime, data) VALUES (?, ?, ?)', name, mime, fs.readFileSync(path.join(OLD_UPLOAD_DIR, name)));
    n++;
  }
  return n;
}

// Inject title + description into HTML so search engines and link previews see them
const PAGES = {};
async function sendPage(res, file, extra = {}) {
  const s = await getSettings();
  let html = PAGES[file] ??= fs.readFileSync(path.join(__dirname, 'public', file), 'utf8');
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  html = html.replace(/{{TITLE}}/g, esc(extra.title || s.site_title)).replace(/{{DESCRIPTION}}/g, esc(extra.description || s.seo_description)).replace(/{{THEME}}/g, s.default_theme === 'light' ? 'light' : 'dark');
  res.type('html').send(html);
}

// ---------- public ----------
app.get('/', A((req, res) => sendPage(res, 'index.html')));
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/blog/:slug', A(async (req, res) => {
  const post = (await listItems('posts', { onlyVisible: true })).find(p => p.slug === req.params.slug);
  if (!post) return res.redirect('/#writing');
  await sendPage(res, 'post.html', { title: `${post.title} — ${(await getSettings()).name}`, description: post.summary || '' });
}));
app.get('/projects/:slug', A(async (req, res) => {
  const pr = (await listItems('projects', { onlyVisible: true })).find(p => p.slug === req.params.slug);
  if (!pr) return res.redirect('/#work');
  await sendPage(res, 'project.html', { title: `${pr.title} — ${(await getSettings()).name}`, description: pr.summary || '' });
}));
app.get('/api/projects/:slug', A(async (req, res) => {
  const all = await listItems('projects', { onlyVisible: true });
  const i = all.findIndex(p => p.slug === req.params.slug);
  if (i < 0) return res.status(404).json({ error: 'Project not found' });
  const next = all[(i + 1) % all.length];
  res.json({ project: all[i], next: all.length > 1 ? { title: next.title, slug: next.slug } : null });
}));

// GitHub profile + repos, cached for an hour so visitors never hit GitHub's rate limit
let ghCache = { user: '', at: 0, data: null };
app.get('/api/github', A(async (req, res) => {
  const user = ((await getSettings()).github_username || '').trim().replace(/[^A-Za-z0-9-]/g, '');
  if (!user) return res.json({ enabled: false });
  if (ghCache.user === user && Date.now() - ghCache.at < 3600e3 && ghCache.data) return res.json(ghCache.data);
  try {
    const h = { 'User-Agent': 'personal-website', Accept: 'application/vnd.github+json' };
    if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const [u, r] = await Promise.all([
      fetch(`https://api.github.com/users/${user}`, { headers: h }).then(x => x.ok ? x.json() : Promise.reject(new Error('GitHub user not found'))),
      fetch(`https://api.github.com/users/${user}/repos?per_page=100&sort=pushed`, { headers: h }).then(x => x.ok ? x.json() : []),
    ]);
    const own = r.filter(x => !x.fork);
    const langs = {};
    own.forEach(x => { if (x.language) langs[x.language] = (langs[x.language] || 0) + 1; });
    const data = {
      enabled: true, username: user, url: u.html_url, avatar: u.avatar_url, bio: u.bio,
      public_repos: u.public_repos, followers: u.followers,
      stars: own.reduce((a, x) => a + x.stargazers_count, 0),
      languages: Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count })),
      repos: own.slice(0, 6).map(x => ({ name: x.name, description: x.description, url: x.html_url, language: x.language, stars: x.stargazers_count, forks: x.forks_count, pushed_at: x.pushed_at })),
    };
    ghCache = { user, at: Date.now(), data };
    res.json(data);
  } catch (e) {
    res.json(ghCache.user === user && ghCache.data ? ghCache.data : { enabled: false, error: e.message });
  }
}));

app.get('/cv', A(async (req, res) => {
  const cv = (await getSettings()).cv_file;
  if (!cv) return res.redirect('/');
  res.redirect(cv);
}));

app.get('/api/site', A(async (req, res) => {
  const s = await getSettings();
  const publicSettings = {};
  SETTINGS.flatMap(g => g.fields).forEach(f => (publicSettings[f.key] = s[f.key]));
  const [projects, experience, skills, testimonials, posts] = await Promise.all(['projects', 'experience', 'skills', 'testimonials', 'posts'].map(c => listItems(c, { onlyVisible: true })));
  res.json({
    settings: publicSettings,
    projects: projects.map(({ problem, approach, results, gallery, ...p }) => ({ ...p, has_case: !!(problem || approach || results) })),
    experience, skills, testimonials,
    posts: posts.map(({ body, ...p }) => ({ ...p, has_body: !!body })),
  });
}));

app.get('/api/posts/:slug', A(async (req, res) => {
  const post = (await listItems('posts', { onlyVisible: true })).find(p => p.slug === req.params.slug);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const s = await getSettings();
  res.json({ post, settings: { name: s.name, accent_color: s.accent_color, linkedin: s.linkedin, email: s.email } });
}));

app.post('/api/contact', A(async (req, res) => {
  if ((await getSettings()).contact_form !== '1') return res.status(403).json({ error: 'The contact form is switched off.' });
  if (limited('contact:' + req.ip, 5, 60 * 60 * 1000)) return res.status(429).json({ error: 'Too many messages. Please email me directly.' });
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot: bots fill hidden field
  const name = str(b.name, 100), email = str(b.email, 200), subject = str(b.subject, 200), body = str(b.message, 5000);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || body.length < 5) return res.status(400).json({ error: 'Please add your name, a valid email and a message.' });
  await db.run('INSERT INTO messages (name, email, subject, body) VALUES (?,?,?,?)', name, email, subject, body);
  res.json({ ok: true });
}));

app.post('/api/view', A(async (req, res) => {
  if (req.cookies.pf_admin) return res.json({ ok: true }); // don't count the owner
  if (limited('view:' + req.ip, 60, 60 * 1000)) return res.json({ ok: true });
  const p = str(req.body?.path, 120).replace(/[^\w\-/#]/g, '') || '/';
  await db.run('INSERT INTO views (day, path, count) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET count = count + 1', today(), p);
  res.json({ ok: true });
}));

// ---------- admin auth ----------
function requireAdmin(req, res, next) {
  try { req.admin = jwt.verify(req.cookies.pf_admin || '', JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Not logged in' }); }
}
const cookieOpts = req => ({ httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 7 * 24 * 3600 * 1000 });

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));
app.post('/api/admin/login', A(async (req, res) => {
  if (limited('login:' + req.ip, 10, 15 * 60 * 1000)) return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes.' });
  const u = await db.get('SELECT * FROM admins WHERE username = ?', str(req.body?.username, 50));
  if (!u || !bcrypt.compareSync(String(req.body?.password || ''), u.password_hash)) return res.status(401).json({ error: 'Wrong username or password' });
  res.cookie('pf_admin', jwt.sign({ id: u.id, username: u.username }, JWT_SECRET, { expiresIn: '7d' }), cookieOpts(req));
  res.json({ ok: true });
}));
app.post('/api/admin/logout', (req, res) => { res.clearCookie('pf_admin'); res.json({ ok: true }); });
app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ username: req.admin.username }));
app.post('/api/admin/account', requireAdmin, A(async (req, res) => {
  const { current_password, new_username, new_password } = req.body || {};
  const u = await db.get('SELECT * FROM admins WHERE id = ?', req.admin.id);
  if (!u || !bcrypt.compareSync(String(current_password || ''), u.password_hash)) return res.status(400).json({ error: 'Current password is wrong' });
  if (new_password && String(new_password).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const username = str(new_username, 50) || u.username;
  await db.run('UPDATE admins SET username = ?, password_hash = ? WHERE id = ?', username, new_password ? bcrypt.hashSync(String(new_password), 10) : u.password_hash, u.id);
  res.cookie('pf_admin', jwt.sign({ id: u.id, username }, JWT_SECRET, { expiresIn: '7d' }), cookieOpts(req));
  res.json({ ok: true });
}));

// ---------- admin: schema, dashboard ----------
app.get('/api/admin/schema', requireAdmin, (req, res) => res.json({ settings: SETTINGS, collections: COLLECTIONS }));

app.get('/api/admin/stats', requireAdmin, A(async (req, res) => {
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); days.push(d); }
  const byDay = Object.fromEntries((await db.all('SELECT day, SUM(count) c FROM views WHERE day >= ? GROUP BY day', days[0])).map(r => [r.day, r.c]));
  const counts = {};
  for (const r of await db.all('SELECT collection, COUNT(*) c FROM items GROUP BY collection')) counts[r.collection] = r.c;
  res.json({
    views: days.map(d => ({ day: d, count: byDay[d] || 0 })),
    views_today: byDay[today()] || 0,
    views_7: days.slice(-7).reduce((a, d) => a + (byDay[d] || 0), 0),
    unread: (await db.get('SELECT COUNT(*) c FROM messages WHERE is_read = 0')).c,
    top_pages: await db.all('SELECT path, SUM(count) c FROM views WHERE day >= ? GROUP BY path ORDER BY c DESC LIMIT 6', days[0]),
    counts: Object.fromEntries(['projects', 'experience', 'skills', 'posts', 'testimonials'].map(c => [c, counts[c] || 0])),
    recent_messages: await db.all('SELECT id, name, subject, created_at, is_read FROM messages ORDER BY id DESC LIMIT 5'),
  });
}));

// ---------- admin: settings ----------
app.get('/api/admin/settings', requireAdmin, A(async (req, res) => res.json(await getSettings())));
app.put('/api/admin/settings', requireAdmin, A(async (req, res) => { await saveSettings(req.body || {}); res.json({ ok: true }); }));

// ---------- admin: uploads ----------
app.post('/api/admin/upload', requireAdmin, upload.single('file'), A(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an image (JPG, PNG, WEBP) or a PDF, max 10MB' });
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${EXT[req.file.mimetype] || ''}`;
  await db.run('INSERT INTO files (name, mime, data) VALUES (?, ?, ?)', name, req.file.mimetype, req.file.buffer);
  res.json({ url: '/uploads/' + name, name: req.file.originalname });
}));

// ---------- admin: collections ----------
function checkCol(req, res, next) { if (!COLLECTIONS[req.params.col]) return res.status(404).json({ error: 'Unknown section' }); next(); }
async function uniqueSlug(col, data, ignoreId) {
  if (!COLLECTIONS[col].slugged) return data;
  const others = (await listItems(col)).filter(p => p.id !== ignoreId).map(p => p.slug);
  let s = data.slug, n = 2; while (others.includes(s)) s = `${data.slug}-${n++}`;
  return { ...data, slug: s };
}
app.get('/api/admin/c/:col', requireAdmin, checkCol, A(async (req, res) => res.json(await listItems(req.params.col))));
app.post('/api/admin/c/:col', requireAdmin, checkCol, A(async (req, res) => {
  let data;
  try { data = await uniqueSlug(req.params.col, cleanItem(req.params.col, req.body || {})); } catch (e) { return res.status(400).json({ error: e.message }); }
  const max = (await db.get('SELECT COALESCE(MAX(sort), -1) m FROM items WHERE collection = ?', req.params.col)).m;
  const r = await db.run('INSERT INTO items (collection, data, sort, visible) VALUES (?,?,?,?)', req.params.col, JSON.stringify(data), max + 1, req.body?.visible === false ? 0 : 1);
  res.json({ ok: true, id: r.id });
}));
app.put('/api/admin/c/:col/:id', requireAdmin, checkCol, A(async (req, res) => {
  const id = Number(req.params.id);
  let data;
  try { data = await uniqueSlug(req.params.col, cleanItem(req.params.col, req.body || {}), id); } catch (e) { return res.status(400).json({ error: e.message }); }
  await db.run(`UPDATE items SET data = ?, visible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND collection = ?`,
    JSON.stringify(data), req.body?.visible === false ? 0 : 1, id, req.params.col);
  res.json({ ok: true });
}));
app.patch('/api/admin/c/:col/:id/visible', requireAdmin, checkCol, A(async (req, res) => {
  await db.run('UPDATE items SET visible = ? WHERE id = ? AND collection = ?', req.body?.visible ? 1 : 0, req.params.id, req.params.col);
  res.json({ ok: true });
}));
app.post('/api/admin/c/:col/reorder', requireAdmin, checkCol, A(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  if (ids.length) await db.batch(ids.map((id, i) => ['UPDATE items SET sort = ? WHERE id = ? AND collection = ?', i, id, req.params.col]));
  res.json({ ok: true });
}));
app.delete('/api/admin/c/:col/:id', requireAdmin, checkCol, A(async (req, res) => {
  await db.run('DELETE FROM items WHERE id = ? AND collection = ?', req.params.id, req.params.col);
  res.json({ ok: true });
}));

// ---------- admin: messages ----------
app.get('/api/admin/messages', requireAdmin, A(async (req, res) => res.json(await db.all('SELECT * FROM messages ORDER BY id DESC LIMIT 500'))));
app.patch('/api/admin/messages/:id', requireAdmin, A(async (req, res) => {
  await db.run('UPDATE messages SET is_read = ? WHERE id = ?', req.body?.is_read ? 1 : 0, req.params.id); res.json({ ok: true });
}));
app.delete('/api/admin/messages/:id', requireAdmin, A(async (req, res) => { await db.run('DELETE FROM messages WHERE id = ?', req.params.id); res.json({ ok: true }); }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10MB)' : 'Server error' });
});

init().then(async ({ secret, where }) => {
  JWT_SECRET = secret;
  const n = await importOldUploads();
  if (n) console.log(`  Copied ${n} uploaded file(s) from ./uploads into the database.`);
  app.listen(PORT, () => console.log(`Portfolio running → http://localhost:${PORT}  (admin: /admin) · data: ${where}`));
}).catch(e => { console.error('Could not open the database:', e.message); process.exit(1); });
