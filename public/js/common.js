// Shared helpers for the public pages
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Only allow http(s), mailto and site-relative links
const safeUrl = u => { u = String(u || '').trim(); return /^(https?:\/\/|mailto:|\/(?!\/))/i.test(u) ? u : ''; };

// Inline formatting: **bold**, *accent/italic*, `code`, [text](url)
function inline(text, starClass) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, starClass ? '<em>$1</em>' : '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => { const s = safeUrl(u.replace(/&amp;/g, '&')); return s ? `<a href="${esc(s)}" target="_blank" rel="noopener">${t}</a>` : t; });
}

// Small, safe Markdown renderer for About text and blog posts
function markdown(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  let html = '', i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; html += `<pre><code>${esc(buf.join('\n'))}</code></pre>`; continue;
    }
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) { const n = Math.min(3, m[1].length + 1); html += `<h${n}>${inline(m[2])}</h${n}>`; i++; continue; }
    if (/^\s*[-*]\s+/.test(l)) {
      let items = '';
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items += `<li>${inline(lines[i++].replace(/^\s*[-*]\s+/, ''))}</li>`;
      html += `<ul>${items}</ul>`; continue;
    }
    if (/^\s*\d+[.)]\s+/.test(l)) {
      let items = '';
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items += `<li>${inline(lines[i++].replace(/^\s*\d+[.)]\s+/, ''))}</li>`;
      html += `<ol>${items}</ol>`; continue;
    }
    if (/^>\s?/.test(l)) {
      const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      html += `<blockquote>${inline(buf.join(' '))}</blockquote>`; continue;
    }
    if ((m = l.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/))) { const u = safeUrl(m[2]); if (u) html += `<p><img src="${esc(u)}" alt="${esc(m[1])}" loading="lazy"></p>`; i++; continue; }
    if (!l.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|\s*[-*]\s|\s*\d+[.)]\s|>)/.test(lines[i])) buf.push(lines[i++]);
    html += `<p>${inline(buf.join(' '))}</p>`;
  }
  return html;
}

function applyAccent(color) {
  if (/^#[0-9a-f]{6}$/i.test(color || '')) document.documentElement.style.setProperty('--accent', color);
}

function trackView(p) {
  try { fetch('/api/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p }) }); } catch {}
}

function prettyDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return '';
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
}
