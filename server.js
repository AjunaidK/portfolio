// Personal profile website + admin panel
// Run: npm start  →  site at http://localhost:3000, admin at http://localhost:3000/admin
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { SETTINGS, COLLECTIONS } = require('./schema');
const { db, getSettings, saveSettings, listItems, cleanItem } = require('./db');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
const JWT_SECRET = process.env.JWT_SECRET || (fs.existsSync(SECRET_FILE) ? fs.readFileSync(SECRET_FILE, 'utf8')
  : (() => { const s = crypto.randomBytes(48).toString('hex'); fs.writeFileSync(SECRET_FILE, s); return s; })());

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

// ---------- helpers ----------
const str = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const hits = new Map();
function limited(key, max, ms) {
  const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < ms);
  arr.push(now); hits.set(key, arr); return arr.length > max;
}
const today = () => new Date().toISOString().slice(0, 10);

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 6);
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^(image\/(jpeg|png|webp|gif|avif)|application\/pdf)$/.test(file.mimetype)),
});

// Inject title + description into HTML so search engines and link previews see them
function sendPage(res, file, extra = {}) {
  const s = getSettings();
  let html = fs.readFileSync(path.join(__dirname, 'public', file), 'utf8');
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  html = html.replace(/{{TITLE}}/g, esc(extra.title || s.site_title)).replace(/{{DESCRIPTION}}/g, esc(extra.description || s.seo_description)).replace(/{{THEME}}/g, s.default_theme === 'light' ? 'light' : 'dark');
  res.type('html').send(html);
}

// ---------- public ----------
app.get('/', (req, res) => sendPage(res, 'index.html'));
app.get('/blog/:slug', (req, res) => {
  const post = listItems('posts', { onlyVisible: true }).find(p => p.slug === req.params.slug);
  if (!post) return res.redirect('/#writing');
  sendPage(res, 'post.html', { title: `${post.title} — ${getSettings().name}`, description: post.summary || '' });
});
app.get('/projects/:slug', (req, res) => {
  const pr = listItems('projects', { onlyVisible: true }).find(p => p.slug === req.params.slug);
  if (!pr) return res.redirect('/#work');
  sendPage(res, 'project.html', { title: `${pr.title} — ${getSettings().name}`, description: pr.summary || '' });
});
app.get('/api/projects/:slug', (req, res) => {
  const all = listItems('projects', { onlyVisible: true });
  const i = all.findIndex(p => p.slug === req.params.slug);
  if (i < 0) return res.status(404).json({ error: 'Project not found' });
  const next = all[(i + 1) % all.length];
  res.json({ project: all[i], next: all.length > 1 ? { title: next.title, slug: next.slug } : null });
});

// GitHub profile + repos, cached for an hour so visitors never hit GitHub's rate limit
let ghCache = { user: '', at: 0, data: null };
app.get('/api/github', async (req, res) => {
  const user = (getSettings().github_username || '').trim().replace(/[^A-Za-z0-9-]/g, '');
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
});

app.get('/cv', (req, res) => {
  const cv = getSettings().cv_file;
  if (!cv) return res.redirect('/');
  res.redirect(cv);
});

app.get('/api/site', (req, res) => {
  const s = getSettings();
  const publicSettings = {};
  SETTINGS.flatMap(g => g.fields).forEach(f => (publicSettings[f.key] = s[f.key]));
  res.json({
    settings: publicSettings,
    projects: listItems('projects', { onlyVisible: true }).map(({ problem, approach, results, gallery, ...p }) => ({ ...p, has_case: !!(problem || approach || results) })),
    experience: listItems('experience', { onlyVisible: true }),
    skills: listItems('skills', { onlyVisible: true }),
    testimonials: listItems('testimonials', { onlyVisible: true }),
    posts: listItems('posts', { onlyVisible: true }).map(({ body, ...p }) => ({ ...p, has_body: !!body })),
  });
});

app.get('/api/posts/:slug', (req, res) => {
  const post = listItems('posts', { onlyVisible: true }).find(p => p.slug === req.params.slug);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const s = getSettings();
  res.json({ post, settings: { name: s.name, accent_color: s.accent_color, linkedin: s.linkedin, email: s.email } });
});

app.post('/api/contact', (req, res) => {
  if (getSettings().contact_form !== '1') return res.status(403).json({ error: 'The contact form is switched off.' });
  if (limited('contact:' + req.ip, 5, 60 * 60 * 1000)) return res.status(429).json({ error: 'Too many messages. Please email me directly.' });
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot: bots fill hidden field
  const name = str(b.name, 100), email = str(b.email, 200), subject = str(b.subject, 200), body = str(b.message, 5000);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || body.length < 5) return res.status(400).json({ error: 'Please add your name, a valid email and a message.' });
  db.prepare('INSERT INTO messages (name, email, subject, body) VALUES (?,?,?,?)').run(name, email, subject, body);
  res.json({ ok: true });
});

app.post('/api/view', (req, res) => {
  if (req.cookies.pf_admin) return res.json({ ok: true }); // don't count the owner
  if (limited('view:' + req.ip, 60, 60 * 1000)) return res.json({ ok: true });
  const p = str(req.body?.path, 120).replace(/[^\w\-/#]/g, '') || '/';
  db.prepare('INSERT INTO views (day, path, count) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET count = count + 1').run(today(), p);
  res.json({ ok: true });
});

// ---------- admin auth ----------
function requireAdmin(req, res, next) {
  try { req.admin = jwt.verify(req.cookies.pf_admin || '', JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Not logged in' }); }
}
const cookieOpts = req => ({ httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 7 * 24 * 3600 * 1000 });

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));
app.post('/api/admin/login', (req, res) => {
  if (limited('login:' + req.ip, 10, 15 * 60 * 1000)) return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes.' });
  const u = db.prepare('SELECT * FROM admins WHERE username = ?').get(str(req.body?.username, 50));
  if (!u || !bcrypt.compareSync(String(req.body?.password || ''), u.password_hash)) return res.status(401).json({ error: 'Wrong username or password' });
  res.cookie('pf_admin', jwt.sign({ id: u.id, username: u.username }, JWT_SECRET, { expiresIn: '7d' }), cookieOpts(req));
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie('pf_admin'); res.json({ ok: true }); });
app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ username: req.admin.username }));
app.post('/api/admin/account', requireAdmin, (req, res) => {
  const { current_password, new_username, new_password } = req.body || {};
  const u = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!u || !bcrypt.compareSync(String(current_password || ''), u.password_hash)) return res.status(400).json({ error: 'Current password is wrong' });
  if (new_password && String(new_password).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const username = str(new_username, 50) || u.username;
  db.prepare('UPDATE admins SET username = ?, password_hash = ? WHERE id = ?').run(username, new_password ? bcrypt.hashSync(String(new_password), 10) : u.password_hash, u.id);
  res.cookie('pf_admin', jwt.sign({ id: u.id, username }, JWT_SECRET, { expiresIn: '7d' }), cookieOpts(req));
  res.json({ ok: true });
});

// ---------- admin: schema, dashboard ----------
app.get('/api/admin/schema', requireAdmin, (req, res) => res.json({ settings: SETTINGS, collections: COLLECTIONS }));

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); days.push(d); }
  const byDay = Object.fromEntries(db.prepare('SELECT day, SUM(count) c FROM views WHERE day >= ? GROUP BY day').all(days[0]).map(r => [r.day, r.c]));
  const count = col => db.prepare('SELECT COUNT(*) c FROM items WHERE collection = ?').get(col).c;
  res.json({
    views: days.map(d => ({ day: d, count: byDay[d] || 0 })),
    views_today: byDay[today()] || 0,
    views_7: days.slice(-7).reduce((a, d) => a + (byDay[d] || 0), 0),
    unread: db.prepare('SELECT COUNT(*) c FROM messages WHERE is_read = 0').get().c,
    top_pages: db.prepare('SELECT path, SUM(count) c FROM views WHERE day >= ? GROUP BY path ORDER BY c DESC LIMIT 6').all(days[0]),
    counts: { projects: count('projects'), experience: count('experience'), skills: count('skills'), posts: count('posts'), testimonials: count('testimonials') },
    recent_messages: db.prepare('SELECT id, name, subject, created_at, is_read FROM messages ORDER BY id DESC LIMIT 5').all(),
  });
});

// ---------- admin: settings ----------
app.get('/api/admin/settings', requireAdmin, (req, res) => res.json(getSettings()));
app.put('/api/admin/settings', requireAdmin, (req, res) => { saveSettings(req.body || {}); res.json({ ok: true }); });

// ---------- admin: uploads ----------
app.post('/api/admin/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an image (JPG, PNG, WEBP) or a PDF, max 10MB' });
  res.json({ url: '/uploads/' + req.file.filename, name: req.file.originalname });
});

// ---------- admin: collections ----------
function checkCol(req, res, next) { if (!COLLECTIONS[req.params.col]) return res.status(404).json({ error: 'Unknown section' }); next(); }
function uniqueSlug(col, data, ignoreId) {
  if (!COLLECTIONS[col].slugged) return data;
  const others = listItems(col).filter(p => p.id !== ignoreId).map(p => p.slug);
  let s = data.slug, n = 2; while (others.includes(s)) s = `${data.slug}-${n++}`;
  return { ...data, slug: s };
}
app.get('/api/admin/c/:col', requireAdmin, checkCol, (req, res) => res.json(listItems(req.params.col)));
app.post('/api/admin/c/:col', requireAdmin, checkCol, (req, res) => {
  try {
    const data = uniqueSlug(req.params.col, cleanItem(req.params.col, req.body || {}));
    const max = db.prepare('SELECT COALESCE(MAX(sort), -1) m FROM items WHERE collection = ?').get(req.params.col).m;
    const r = db.prepare('INSERT INTO items (collection, data, sort, visible) VALUES (?,?,?,?)').run(req.params.col, JSON.stringify(data), max + 1, req.body?.visible === false ? 0 : 1);
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.put('/api/admin/c/:col/:id', requireAdmin, checkCol, (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = uniqueSlug(req.params.col, cleanItem(req.params.col, req.body || {}), id);
    db.prepare(`UPDATE items SET data = ?, visible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND collection = ?`)
      .run(JSON.stringify(data), req.body?.visible === false ? 0 : 1, id, req.params.col);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.patch('/api/admin/c/:col/:id/visible', requireAdmin, checkCol, (req, res) => {
  db.prepare('UPDATE items SET visible = ? WHERE id = ? AND collection = ?').run(req.body?.visible ? 1 : 0, req.params.id, req.params.col);
  res.json({ ok: true });
});
app.post('/api/admin/c/:col/reorder', requireAdmin, checkCol, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  const up = db.prepare('UPDATE items SET sort = ? WHERE id = ? AND collection = ?');
  db.transaction(() => ids.forEach((id, i) => up.run(i, id, req.params.col)))();
  res.json({ ok: true });
});
app.delete('/api/admin/c/:col/:id', requireAdmin, checkCol, (req, res) => {
  db.prepare('DELETE FROM items WHERE id = ? AND collection = ?').run(req.params.id, req.params.col);
  res.json({ ok: true });
});

// ---------- admin: messages ----------
app.get('/api/admin/messages', requireAdmin, (req, res) => res.json(db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 500').all()));
app.patch('/api/admin/messages/:id', requireAdmin, (req, res) => {
  db.prepare('UPDATE messages SET is_read = ? WHERE id = ?').run(req.body?.is_read ? 1 : 0, req.params.id); res.json({ ok: true });
});
app.delete('/api/admin/messages/:id', requireAdmin, (req, res) => { db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id); res.json({ ok: true }); });

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10MB)' : 'Server error' });
});

app.listen(PORT, () => console.log(`Portfolio running → http://localhost:${PORT}  (admin: /admin)`));
