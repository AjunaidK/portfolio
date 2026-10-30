// Admin panel — forms are built from the schema the server sends, so adding a field in schema.js is enough
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let SCHEMA = null;

async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    body: opts.body instanceof FormData ? opts.body : opts.body && JSON.stringify(opts.body) });
  if (r.status === 401 && !url.includes('/login')) { showLogin(); throw new Error('Please log in'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
let tT;
function toast(m, bad) { const t = $('#toast'); t.textContent = m; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(tT); tT = setTimeout(() => (t.hidden = true), 2600); }
function modal(html) { $('#modalBody').innerHTML = html; $('#modal').hidden = false; return $('#modalBody'); }
const closeModal = () => ($('#modal').hidden = true);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });
function topBtn(label, fn, cls = 'primary') { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + cls; b.textContent = label; b.onclick = fn; $('#topActions').append(b); }

// ---------- auth ----------
function showLogin() { $('#appView').hidden = true; $('#loginView').hidden = false; }
async function boot() {
  try { await api('/api/admin/me'); } catch { return showLogin(); }
  SCHEMA = await api('/api/admin/schema');
  $('#loginView').hidden = true; $('#appView').hidden = false;
  go(location.hash.slice(1) || 'dashboard');
}
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); $('#lErr').hidden = true;
  try { await api('/api/admin/login', { method: 'POST', body: { username: $('#lUser').value, password: $('#lPass').value } }); boot(); }
  catch (ex) { $('#lErr').textContent = ex.message; $('#lErr').hidden = false; }
});
$('#logout').onclick = async () => { await api('/api/admin/logout', { method: 'POST' }); showLogin(); };
$('#burger').onclick = () => $('#side').classList.toggle('open');

// ---------- routing ----------
const TITLES = { dashboard: 'Dashboard', profile: 'Profile & homepage', messages: 'Messages', account: 'Account' };
function go(view) {
  const col = view.startsWith('c:') ? view.slice(2) : null;
  if (col && !SCHEMA.collections[col]) view = 'dashboard';
  if (!col && !TITLES[view]) view = 'dashboard';
  location.hash = view;
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.view === view));
  $('#viewTitle').textContent = col ? SCHEMA.collections[col].label : TITLES[view];
  $('#topActions').innerHTML = ''; $('#side').classList.remove('open');
  $('#view').innerHTML = '<p class="muted">Loading…</p>';
  const run = col ? () => viewCollection(col) : { dashboard: viewDashboard, profile: viewProfile, messages: viewMessages, account: viewAccount }[view];
  run().catch(e => ($('#view').innerHTML = `<p class="err">${esc(e.message)}</p>`));
  refreshUnread();
}
$$('#nav a').forEach(a => (a.onclick = () => go(a.dataset.view)));
async function refreshUnread() {
  try { const m = await api('/api/admin/messages'); const n = m.filter(x => !x.is_read).length; $('#unreadPill').hidden = !n; $('#unreadPill').textContent = n; } catch {}
}

// ---------- field rendering (shared by profile + collections) ----------
function fieldHTML(f, value) {
  const id = 'f_' + f.key, hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '';
  const v = value ?? '';
  switch (f.type) {
    case 'bool': return `<label class="check" for="${id}"><input type="checkbox" id="${id}" data-k="${f.key}" data-t="bool" ${v === true || v === '1' ? 'checked' : ''}> ${esc(f.label)}</label>`;
    case 'textarea': return `<label for="${id}">${esc(f.label)}${hint}<textarea id="${id}" data-k="${f.key}" rows="3">${esc(v)}</textarea></label>`;
    case 'markdown': return `<label for="${id}">${esc(f.label)}${hint}<textarea class="md" id="${id}" data-k="${f.key}">${esc(v)}</textarea></label>`;
    case 'lines': return `<label for="${id}">${esc(f.label)}${hint}<textarea id="${id}" data-k="${f.key}" data-t="lines" rows="${f.key === 'stats' ? 3 : 4}">${esc((v || []).join ? v.join('\n') : v)}</textarea></label>`;
    case 'tags': return `<label for="${id}">${esc(f.label)}${hint}<input id="${id}" data-k="${f.key}" data-t="tags" value="${esc((v || []).join ? v.join(', ') : v)}"></label>`;
    case 'select': return `<label for="${id}">${esc(f.label)}${hint}<select id="${id}" data-k="${f.key}">${f.options.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    case 'date': return `<label for="${id}">${esc(f.label)}${hint}<input type="date" id="${id}" data-k="${f.key}" value="${esc(v)}"></label>`;
    case 'number': return `<label for="${id}">${esc(f.label)}${hint}<input type="number" id="${id}" data-k="${f.key}" value="${esc(v)}"></label>`;
    case 'color': return `<label for="${id}">${esc(f.label)}${hint}<span class="color-row"><input type="color" id="${id}" data-k="${f.key}" value="${esc(v || '#e2531b')}"><code>${esc(v)}</code></span></label>`;
    case 'images': {
      const arr = Array.isArray(v) ? v : [];
      return `<div><label>${esc(f.label)}${hint}</label><div class="gal" data-gal="${f.key}" style="margin:-8px 0 14px">
        <div class="gal-list">${arr.map(u => `<span class="gal-it" data-url="${esc(u)}" style="background-image:url('${esc(u)}')"><button type="button" aria-label="Remove image">×</button></span>`).join('')}</div>
        <label class="btn sm" style="margin:0;width:max-content">Add images<input type="file" accept="image/*" multiple hidden></label></div></div>`;
    }
    case 'image': case 'file': return `<div><label>${esc(f.label)}${hint}</label><div class="upl" data-upl="${f.key}" style="margin:-8px 0 14px">
        <input type="hidden" data-k="${f.key}" value="${esc(v)}">
        ${f.type === 'image' ? `<span class="thumb" style="${v ? `background-image:url('${esc(v)}')` : ''}">${v ? '' : 'No image'}</span>` : `<span class="fname">${v ? `<a href="${esc(v)}" target="_blank">Current file ↗</a>` : 'No file yet'}</span>`}
        <label class="btn sm" style="margin:0">Upload<input type="file" accept="${f.type === 'image' ? 'image/*' : 'application/pdf'}" hidden></label>
        <button type="button" class="btn sm danger" data-clear>Remove</button></div></div>`;
    default: return `<label for="${id}">${esc(f.label)}${hint}<input id="${id}" data-k="${f.key}" value="${esc(v)}"></label>`;
  }
}
function wireFields(root) {
  root.querySelectorAll('[data-upl]').forEach(box => {
    const hidden = box.querySelector('input[type=hidden]'), thumb = box.querySelector('.thumb'), fname = box.querySelector('.fname');
    const paint = url => {
      hidden.value = url;
      if (thumb) { thumb.style.backgroundImage = url ? `url('${url}')` : ''; thumb.textContent = url ? '' : 'No image'; }
      if (fname) fname.innerHTML = url ? `<a href="${esc(url)}" target="_blank">Current file ↗</a>` : 'No file yet';
    };
    box.querySelector('input[type=file]').onchange = async e => {
      const fd = new FormData(); fd.append('file', e.target.files[0]);
      try { toast('Uploading…'); const r = await api('/api/admin/upload', { method: 'POST', body: fd }); paint(r.url); toast('Uploaded. Remember to save.'); }
      catch (ex) { toast(ex.message, true); }
      e.target.value = '';
    };
    box.querySelector('[data-clear]').onclick = () => paint('');
  });
  root.querySelectorAll('[data-gal]').forEach(box => {
    const listEl = box.querySelector('.gal-list');
    const add = u => listEl.insertAdjacentHTML('beforeend', `<span class="gal-it" data-url="${esc(u)}" style="background-image:url('${esc(u)}')"><button type="button" aria-label="Remove image">×</button></span>`);
    listEl.onclick = e => { if (e.target.tagName === 'BUTTON') e.target.parentElement.remove(); };
    box.querySelector('input[type=file]').onchange = async e => {
      const files = [...e.target.files];
      for (const file of files) {
        const fd = new FormData(); fd.append('file', file);
        try { toast(`Uploading ${file.name}…`); const r = await api('/api/admin/upload', { method: 'POST', body: fd }); add(r.url); } catch (ex) { toast(ex.message, true); }
      }
      if (files.length) toast('Uploaded. Remember to save.');
      e.target.value = '';
    };
  });
  root.querySelectorAll('input[type=color]').forEach(c => (c.oninput = () => (c.nextElementSibling.textContent = c.value)));
}
function readFields(root) {
  const out = {};
  root.querySelectorAll('[data-k]').forEach(el => {
    if (el.dataset.t === 'bool') out[el.dataset.k] = el.checked;
    else if (el.dataset.t === 'lines') out[el.dataset.k] = el.value.split('\n');
    else if (el.dataset.t === 'tags') out[el.dataset.k] = el.value.split(',');
    else out[el.dataset.k] = el.value;
  });
  root.querySelectorAll('[data-gal]').forEach(box => (out[box.dataset.gal] = [...box.querySelectorAll('.gal-it')].map(x => x.dataset.url)));
  return out;
}

// ---------- dashboard ----------
async function viewDashboard() {
  const s = await api('/api/admin/stats');
  const max = Math.max(1, ...s.views.map(v => v.count));
  const d = x => { const [, m, day] = x.split('-'); return `${Number(day)}/${Number(m)}`; };
  $('#view').innerHTML = `
    <div class="tiles">
      <div class="tile"><span>Visits today</span><b>${s.views_today}</b></div>
      <div class="tile"><span>Visits, 7 days</span><b>${s.views_7}</b></div>
      <div class="tile"><span>Unread messages</span><b>${s.unread}</b></div>
      <div class="tile"><span>Projects · posts</span><b>${s.counts.projects} · ${s.counts.posts}</b></div>
    </div>
    <div class="grid2">
      <div class="panel"><h3>Page views, last 14 days</h3>
        <div class="chart">${s.views.map((v, i) => `<div class="${i === 13 ? 'today' : ''}" style="height:${(v.count / max) * 100}%" title="${v.day}: ${v.count}">${v.count ? `<i>${v.count}</i>` : ''}</div>`).join('')}</div>
        <div class="chart-x">${s.views.map((v, i) => `<span>${i % 2 ? '' : d(v.day)}</span>`).join('')}</div>
        <p class="muted small" style="margin:12px 0 0">Your own visits while logged in aren't counted.</p>
      </div>
      <div>
        <div class="panel"><h3>Top pages</h3>${s.top_pages.length ? `<ul class="list-plain">${s.top_pages.map(p => `<li><span>${esc(p.path)}</span><b>${p.c}</b></li>`).join('')}</ul>` : '<p class="empty">No visits yet.</p>'}</div>
        <div class="panel"><h3>Latest messages</h3>${s.recent_messages.length ? `<ul class="list-plain">${s.recent_messages.map(m => `<li><span>${m.is_read ? '' : '● '}${esc(m.name)}${m.subject ? ' — ' + esc(m.subject) : ''}</span><span class="muted small">${esc(m.created_at.slice(0, 10))}</span></li>`).join('')}</ul>` : '<p class="empty">No messages yet.</p>'}</div>
      </div>
    </div>`;
}

// ---------- profile (settings) ----------
async function viewProfile() {
  const s = await api('/api/admin/settings');
  $('#view').innerHTML = `<form id="sf">${SCHEMA.settings.map(g => `
    <div class="panel"><h3>${esc(g.group)}</h3>
      ${g.fields.map(f => fieldHTML(f, f.type === 'bool' ? s[f.key] : s[f.key])).join('')}
    </div>`).join('')}
    <div class="savebar"><button class="btn primary">Save changes</button></div></form>`;
  const f = $('#sf'); wireFields(f);
  f.onsubmit = async e => {
    e.preventDefault();
    const data = readFields(f);
    for (const k in data) if (typeof data[k] === 'boolean') data[k] = data[k] ? '1' : '0';
    try { await api('/api/admin/settings', { method: 'PUT', body: data }); toast('Saved — refresh your website to see it'); } catch (ex) { toast(ex.message, true); }
  };
  topBtn('View website ↗', () => window.open('/', '_blank'), '');
}

// ---------- collections ----------
async function viewCollection(col) {
  const def = SCHEMA.collections[col];
  const items = await api(`/api/admin/c/${col}`);
  topBtn(`+ Add ${def.singular}`, () => itemForm(col));
  const sub = it => { const v = it[def.subField]; return Array.isArray(v) ? v.join(', ') : (v || ''); };
  $('#view').innerHTML = items.length ? `<div class="items">${items.map((it, i) => `
    <div class="item ${it.visible ? '' : 'off'}" data-id="${it.id}">
      <div class="order"><button type="button" data-up ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button><button type="button" data-down ${i === items.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button></div>
      <div class="title"><b>${esc(it[def.titleField])}</b>${it.featured ? '<span class="badge">featured</span>' : ''}${col === 'posts' && it.body ? '<span class="badge">on site</span>' : ''}${col === 'projects' && (it.problem || it.approach || it.results) ? '<span class="badge">case study</span>' : ''}<div>${esc(sub(it))}</div></div>
      <div class="acts">
        <label class="switch" title="Show on website"><input type="checkbox" data-vis ${it.visible ? 'checked' : ''} aria-label="Show on website"><span></span></label>
        <button type="button" class="btn sm" data-edit>Edit</button>
      </div>
    </div>`).join('')}</div>
    <p class="muted small">Use ▲▼ to change the order on the website. The switch hides an item without deleting it.</p>`
    : `<div class="panel"><p class="empty">Nothing here yet. Click "+ Add ${esc(def.singular)}".</p></div>`;

  $$('.item').forEach(row => {
    const id = Number(row.dataset.id), it = items.find(x => x.id === id);
    row.querySelector('[data-edit]').onclick = () => itemForm(col, it);
    row.querySelector('[data-vis]').onchange = async e => {
      await api(`/api/admin/c/${col}/${id}/visible`, { method: 'PATCH', body: { visible: e.target.checked } });
      row.classList.toggle('off', !e.target.checked); toast(e.target.checked ? 'Shown on website' : 'Hidden from website');
    };
    const move = async dir => {
      const ids = items.map(x => x.id), i = ids.indexOf(id), j = i + dir;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      await api(`/api/admin/c/${col}/reorder`, { method: 'POST', body: { ids } }); viewCollection(col);
    };
    row.querySelector('[data-up]').onclick = () => move(-1);
    row.querySelector('[data-down]').onclick = () => move(1);
  });
  $('#topActions').innerHTML = ''; topBtn(`+ Add ${def.singular}`, () => itemForm(col));
}

function itemForm(col, it = null) {
  const def = SCHEMA.collections[col];
  const short = def.fields.filter(f => ['text', 'date', 'number', 'select'].includes(f.type));
  const long = def.fields.filter(f => !short.includes(f));
  const m = modal(`<h3>${it ? 'Edit' : 'New'} ${esc(def.singular)}</h3>
    <form id="itf">
      <div class="fields2">${short.map(f => fieldHTML(f, it?.[f.key])).join('')}</div>
      ${long.map(f => fieldHTML(f, it?.[f.key])).join('')}
      <label class="check"><input type="checkbox" data-vis ${!it || it.visible ? 'checked' : ''}> Show on website</label>
      <div class="mfoot">
        ${it ? '<button type="button" class="btn danger" id="del">Delete</button>' : ''}
        ${it && col === 'posts' && it.body ? `<a class="btn" href="/blog/${encodeURIComponent(it.slug)}" target="_blank">View post ↗</a>` : ''}${it && col === 'projects' ? `<a class="btn" href="/projects/${encodeURIComponent(it.slug)}" target="_blank">View page ↗</a>` : ''}
        <span style="flex:1"></span><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Save</button>
      </div>
    </form>`);
  const f = m.querySelector('#itf'); wireFields(f);
  f.onsubmit = async e => {
    e.preventDefault();
    const body = { ...readFields(f), visible: f.querySelector('[data-vis]').checked };
    try {
      await api(it ? `/api/admin/c/${col}/${it.id}` : `/api/admin/c/${col}`, { method: it ? 'PUT' : 'POST', body });
      closeModal(); toast('Saved'); viewCollection(col);
    } catch (ex) { toast(ex.message, true); }
  };
  const del = m.querySelector('#del');
  if (del) del.onclick = async () => {
    if (!confirm(`Delete "${it[def.titleField]}"? This can't be undone. Tip: use the switch to hide it instead.`)) return;
    await api(`/api/admin/c/${col}/${it.id}`, { method: 'DELETE' }); closeModal(); toast('Deleted'); viewCollection(col);
  };
}

// ---------- messages ----------
async function viewMessages() {
  const list = await api('/api/admin/messages');
  $('#view').innerHTML = list.length ? `<div class="items">${list.map(m => `
    <details class="msg ${m.is_read ? '' : 'unread'}" data-id="${m.id}">
      <summary><span><b>${esc(m.name)}</b>${m.subject ? ' — ' + esc(m.subject) : ''}<div>${esc(m.email)}</div></span><span class="muted small">${esc(m.created_at.replace('T', ' ').slice(0, 16))} UTC</span></summary>
      <div class="body">${esc(m.body)}</div>
      <div class="acts">
        <a class="btn sm primary" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: ' + (m.subject || 'your message'))}">Reply by email</a>
        <button type="button" class="btn sm" data-toggle>${m.is_read ? 'Mark unread' : 'Mark read'}</button>
        <button type="button" class="btn sm danger" data-del>Delete</button>
      </div>
    </details>`).join('')}</div>` : '<div class="panel"><p class="empty">No messages yet. They arrive here from the contact form on your website.</p></div>';
  $$('.msg').forEach(el => {
    const id = el.dataset.id, m = list.find(x => String(x.id) === id);
    el.addEventListener('toggle', async () => { if (el.open && !m.is_read) { m.is_read = 1; el.classList.remove('unread'); el.querySelector('[data-toggle]').textContent = 'Mark unread'; await api(`/api/admin/messages/${id}`, { method: 'PATCH', body: { is_read: true } }); refreshUnread(); } });
    el.querySelector('[data-toggle]').onclick = async () => { await api(`/api/admin/messages/${id}`, { method: 'PATCH', body: { is_read: !m.is_read } }); viewMessages(); refreshUnread(); };
    el.querySelector('[data-del]').onclick = async () => { if (!confirm('Delete this message?')) return; await api(`/api/admin/messages/${id}`, { method: 'DELETE' }); viewMessages(); refreshUnread(); };
  });
}

// ---------- account ----------
async function viewAccount() {
  const me = await api('/api/admin/me');
  $('#view').innerHTML = `<form class="panel" id="af" style="max-width:520px">
    <h3>Login details</h3><p class="muted small" style="margin-top:-6px">Signed in as <b>${esc(me.username)}</b>.</p>
    <label for="a1">New username <span class="hint">optional</span><input id="a1" name="new_username" autocomplete="username"></label>
    <label for="a2">New password <span class="hint">at least 8 characters</span><input id="a2" name="new_password" type="password" autocomplete="new-password"></label>
    <label for="a3">Current password<input id="a3" name="current_password" type="password" required autocomplete="current-password"></label>
    <button class="btn primary">Update account</button></form>`;
  $('#af').onsubmit = async e => {
    e.preventDefault();
    try { await api('/api/admin/account', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast('Account updated'); viewAccount(); }
    catch (ex) { toast(ex.message, true); }
  };
}

boot();
