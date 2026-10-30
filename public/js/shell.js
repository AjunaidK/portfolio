// Shared page shell: background, nav, theme toggle, command palette, footer, reveal + spotlight effects
const SITE_P = fetch('/api/site').then(r => r.json());
const IS_HOME = location.pathname === '/';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
};

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch {}
  const b = document.getElementById('themeBtn');
  if (b) { b.innerHTML = t === 'dark' ? ICONS.sun : ICONS.moon; b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'); }
  document.dispatchEvent(new CustomEvent('themechange'));
}
const toggleTheme = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

function applyColors(s) {
  const ok = c => /^#[0-9a-f]{6}$/i.test(c || '');
  if (ok(s.accent_color)) document.documentElement.style.setProperty('--a1', s.accent_color);
  if (ok(s.accent2_color)) document.documentElement.style.setProperty('--a2', s.accent2_color);
}
const initials = n => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const href = id => (IS_HOME ? '#' : '/#') + id;

function buildShell(site) {
  const s = site.settings;
  applyColors(s);
  document.body.insertAdjacentHTML('afterbegin', `
    <div class="mesh" aria-hidden="true"><i></i><i></i><i></i></div><div class="grain" aria-hidden="true"></div><div class="glow" id="glow" aria-hidden="true"></div>
    <header class="nav" id="nav">
      <a class="logo" href="/"><b>${esc(initials(s.name))}</b><span>${esc(s.name)}</span></a>
      <nav class="nav-links" aria-label="Sections">
        <a href="${href('about')}">About</a><a href="${href('work')}">Work</a><a href="${href('experience')}">Experience</a><a href="${href('skills')}">Skills</a>${site.posts.length ? `<a href="${href('writing')}">Writing</a>` : ''}<a href="${href('contact')}">Contact</a>
      </nav>
      <button class="icon-btn" id="cmdBtn" type="button" aria-label="Open command menu">${ICONS.search}<span class="cmd-label">Search</span><kbd>${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} K</kbd></button>
      <button class="icon-btn" id="themeBtn" type="button"></button>
      ${s.cv_file ? '<a class="btn btn-grad btn-sm nav-cta" href="/cv" target="_blank" rel="noopener">CV ↓</a>' : `<a class="btn btn-grad btn-sm nav-cta" href="${href('contact')}">Hire me</a>`}
    </header>`);
  document.body.insertAdjacentHTML('beforeend', `
    <footer><div class="wrap">
      <div class="big-name" aria-hidden="true">${esc(s.name)}</div>
      <div class="foot"><span>© ${new Date().getFullYear()} ${esc(s.name)} · ${esc(s.location)}</span>
        <span class="mono">Press <b>${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'} K</b> to jump anywhere</span></div>
    </div></footer>`);
  setTheme(document.documentElement.dataset.theme || 'dark');
  document.getElementById('themeBtn').onclick = toggleTheme;
  document.getElementById('cmdBtn').onclick = () => openPalette(site);
  addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(site); }
  });
  initEffects();
}

// ---------- effects ----------
let revealObs;
function observeReveal(root = document) {
  if (REDUCED || !('IntersectionObserver' in window)) { root.querySelectorAll('.reveal').forEach(el => el.classList.add('in')); return; }
  revealObs = revealObs || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  root.querySelectorAll('.reveal:not(.in)').forEach(el => revealObs.observe(el));
}
function initEffects() {
  const glow = document.getElementById('glow');
  const fine = matchMedia('(pointer: fine)').matches;
  addEventListener('pointermove', e => {
    const card = e.target.closest && e.target.closest('.spot');
    if (card) { const r = card.getBoundingClientRect(); card.style.setProperty('--mx', `${e.clientX - r.left}px`); card.style.setProperty('--my', `${e.clientY - r.top}px`); }
    if (fine && !REDUCED) { glow.style.opacity = 1; glow.style.left = e.clientX + 'px'; glow.style.top = e.clientY + 'px'; }
  }, { passive: true });
  // highlight the nav link for the section in view
  if (IS_HOME && 'IntersectionObserver' in window) {
    const links = [...document.querySelectorAll('.nav-links a')];
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    setTimeout(() => document.querySelectorAll('main section[id]').forEach(s => io.observe(s)), 300);
  }
  observeReveal();
}

function lightbox(src) {
  const d = document.createElement('div'); d.className = 'lightbox'; d.innerHTML = `<img src="${esc(src)}" alt="">`;
  d.onclick = () => d.remove(); addEventListener('keydown', function k(e) { if (e.key === 'Escape') { d.remove(); removeEventListener('keydown', k); } });
  document.body.append(d);
}

async function copyEmail(email, out) {
  try { await navigator.clipboard.writeText(email); if (out) out.textContent = 'Email copied to clipboard.'; return true; }
  catch { if (out) out.textContent = `Copy blocked — the address is ${email}`; return false; }
}

// ---------- command palette ----------
function paletteItems(site) {
  const s = site.settings, items = [];
  const go = url => () => { if (url.startsWith('http')) window.open(url, '_blank', 'noopener'); else location.href = url; };
  [['about', 'About', '◎'], ['work', 'Work', '◆'], ['experience', 'Experience', '↗'], ['skills', 'Skills', '✦'], ['github', 'GitHub', '⌥'], ['writing', 'Writing', '✎'], ['contact', 'Contact', '✉']]
    .filter(([id]) => id !== 'github' || s.github_username).filter(([id]) => id !== 'writing' || site.posts.length)
    .forEach(([id, label, icon]) => items.push({ group: 'Jump to', label, icon, run: go(href(id)) }));
  site.projects.forEach(p => items.push({ group: 'Projects', label: p.title, hint: p.category, icon: '◆', run: go(`/projects/${encodeURIComponent(p.slug)}`) }));
  site.posts.forEach(p => {
    const ext = safeUrl(p.external_url);
    items.push({ group: 'Writing', label: p.title, hint: p.read_minutes ? `${p.read_minutes} min` : '', icon: '✎', run: go(ext && !p.has_body ? ext : `/blog/${encodeURIComponent(p.slug)}`) });
  });
  items.push({ group: 'Actions', label: 'Toggle light / dark theme', icon: '◐', run: toggleTheme });
  if (s.email) items.push({ group: 'Actions', label: 'Copy email address', hint: s.email, icon: '@', run: () => copyEmail(s.email) });
  if (s.cv_file) items.push({ group: 'Actions', label: 'Download CV', icon: '↓', run: go('/cv') });
  if (safeUrl(s.linkedin)) items.push({ group: 'Links', label: 'Open LinkedIn', icon: 'in', run: go(s.linkedin) });
  if (s.github_username) items.push({ group: 'Links', label: 'Open GitHub', hint: '@' + s.github_username, icon: '⌥', run: go('https://github.com/' + s.github_username) });
  if (!IS_HOME) items.push({ group: 'Links', label: 'Back to homepage', icon: '⌂', run: go('/') });
  return items;
}
function openPalette(site) {
  if (document.getElementById('palette')) return;
  const all = paletteItems(site);
  const wrap = document.createElement('div');
  wrap.className = 'palette'; wrap.id = 'palette';
  wrap.innerHTML = `<div class="palette-box" role="dialog" aria-modal="true" aria-label="Command menu">
    <div class="palette-in">${ICONS.search}<input id="palQ" placeholder="Search projects, posts, actions…" autocomplete="off" aria-label="Search"></div>
    <ul class="palette-list" id="palList" role="listbox"></ul>
    <div class="palette-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div></div>`;
  document.body.append(wrap);
  const q = wrap.querySelector('#palQ'), list = wrap.querySelector('#palList');
  let shown = [], sel = 0;
  const close = () => { wrap.remove(); removeEventListener('keydown', onKey, true); };
  function render() {
    const t = q.value.trim().toLowerCase();
    shown = all.filter(i => !t || (i.label + ' ' + (i.hint || '') + ' ' + i.group).toLowerCase().includes(t));
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    let g = '', html = '';
    shown.forEach((it, i) => {
      if (it.group !== g) { g = it.group; html += `<li class="grp">${esc(g)}</li>`; }
      html += `<li class="it ${i === sel ? 'on' : ''}" role="option" data-i="${i}" aria-selected="${i === sel}"><i>${esc(it.icon)}</i>${esc(it.label)}${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</li>`;
    });
    list.innerHTML = html || '<li class="grp">No matches</li>';
    const on = list.querySelector('.it.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function run(i) { const it = shown[i]; if (!it) return; close(); it.run(); }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, shown.length); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(1, shown.length); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
  }
  addEventListener('keydown', onKey, true);
  q.oninput = () => { sel = 0; render(); };
  list.onclick = e => { const it = e.target.closest('.it'); if (it) run(Number(it.dataset.i)); };
  list.onmousemove = e => { const it = e.target.closest('.it'); if (it && Number(it.dataset.i) !== sel) { sel = Number(it.dataset.i); render(); } };
  wrap.onclick = e => { if (e.target === wrap) close(); };
  render(); q.focus();
}
