// Homepage renderer
const LANG_COLORS = { Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6', 'Jupyter Notebook': '#DA5B0B', HTML: '#e34c26', CSS: '#663399', Java: '#b07219', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600', Go: '#00ADD8', Dart: '#00B4AB', Kotlin: '#A97BFF', Swift: '#F05138', R: '#198CE7', Shell: '#89e051', PHP: '#4F5D95' };
const list = v => (Array.isArray(v) ? v : String(v || '').split(/[,\n]/)).map(x => x.trim()).filter(Boolean);
const lines = v => String(v || '').split('\n').map(x => x.trim()).filter(Boolean);

SITE_P.then(site => {
  buildShell(site);
  const s = site.settings;

  // ----- hero -----
  $('#statusText').textContent = s.status_text;
  $('#status').hidden = !s.status_text;
  $('#dot').hidden = s.open_to_work !== '1';
  const words = String(s.name || '').trim().split(/\s+/);
  const lineWords = words.length > 1 ? [words.slice(0, -1).join(' '), words.at(-1)] : [words[0] || ''];
  let k = 0;
  $('#name').setAttribute('aria-label', s.name);
  $('#name').innerHTML = lineWords.map(w => `<span class="line" aria-hidden="true">${[...w].map(c => `<span class="ch" style="animation-delay:${0.15 + 0.045 * k++}s">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</span>`).join('');
  $('#lede').innerHTML = inline(s.lede);
  if (s.cv_file) { $('#heroCv').hidden = false; $('#contactCv').hidden = false; }

  const roles = list(s.roles);
  const rot = $('#rot');
  rot.innerHTML = roles.map(r => `<span>${esc(r)}</span>`).join('');
  if (roles.length > 1 && !REDUCED) {
    let i = 0;
    setInterval(() => { i = (i + 1) % roles.length; rot.querySelectorAll('span').forEach(el => (el.style.transform = `translateY(-${i * 100}%)`)); }, 2400);
  }
  startNet($('#net'), list(s.net_inputs).slice(0, 6), list(s.net_outputs).slice(0, 5));

  // ----- marquee: every skill, twice so the loop is seamless -----
  const allSkills = site.skills.flatMap(g => g.items || []);
  const chunk = allSkills.map(x => `<span>${esc(x)}</span>`).join('');
  $('#marquee').innerHTML = chunk + chunk;
  if (!allSkills.length) document.querySelector('.marquee').hidden = true;

  // ----- about -----
  $('#aboutTitle').textContent = s.about_title;
  $('#aboutBody').innerHTML = markdown(s.about_body);
  if (s.profile_photo) { $('#portrait').hidden = false; $('#portraitImg').src = s.profile_photo; $('#portraitImg').alt = s.name; }
  $('#stats').innerHTML = lines(s.stats).map(l => {
    const [num, ...label] = l.split('|');
    return `<div class="glass spot stat reveal"><b data-count="${esc(num.trim())}">${esc(num.trim())}</b><span>${esc(label.join('|').trim())}</span></div>`;
  }).join('');

  renderWork(site.projects, s);
  renderTimeline(site.experience, s);
  renderSkills(site.skills, s);
  renderTestimonials(site.testimonials, s);
  renderPosts(site.posts, s);
  renderContact(s);
  renderGitHub(s);
  countUp();
  observeReveal();
  trackView('/');
});

function renderWork(projects, s) {
  $('#workTitle').textContent = s.work_title;
  if (!projects.length) { $('#work').hidden = true; return; }
  const featured = projects.filter(p => p.featured), rest = projects.filter(p => !p.featured);
  const n = rest.length;
  const cls = i => (n % 3 === 2 && i >= n - 2) || n === 2 ? 'half' : (n % 3 === 1 && i === n - 1 ? 'big' : '');
  const card = (p, c) => {
    const metrics = (p.metrics || []).slice(0, 3).map(m => { const [v, ...l] = m.split('|'); return `<div><b class="grad-text">${esc(v)}</b><span>${esc(l.join('|'))}</span></div>`; }).join('');
    return `<a class="glass spot proj ${c} reveal" href="/projects/${encodeURIComponent(p.slug)}">
      <div class="cover">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : `<canvas data-art="${esc(p.title)}" aria-hidden="true"></canvas>`}</div>
      <div class="body">
        <div class="meta mono"><span>${esc(p.category || '')}</span><span>${esc(p.period || '')}</span></div>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.summary)}</p>
        ${c === 'big' && metrics ? `<div class="metrics-row">${metrics}</div>` : ''}
        ${(p.tags || []).length ? `<div class="tags">${p.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
        <span class="go">${p.has_case ? 'Read case study' : 'View project'} <span class="arrow">→</span></span>
      </div></a>`;
  };
  $('#workGrid').innerHTML = featured.map(p => card(p, 'big')).join('') + rest.map((p, i) => card(p, cls(i))).join('');
  document.querySelectorAll('canvas[data-art]').forEach(c => coverArt(c, c.dataset.art));
}

function renderTimeline(exp, s) {
  $('#expTitle').textContent = s.exp_title;
  if (!exp.length) { $('#experience').hidden = true; return; }
  $('#timeline').innerHTML = exp.map(e => `
    <li class="glass spot reveal ${e.kind === 'education' ? 'edu' : ''}">
      <div class="when mono">${esc(e.period)}<br><span class="kind">${esc(e.kind || 'work')}</span></div>
      <div><h3>${esc(e.title)}</h3><p class="org">${esc(e.org)}</p>
        ${(e.bullets || []).length ? `<ul>${e.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>
    </li>`).join('');
}

function renderSkills(groups, s) {
  $('#skillsTitle').textContent = s.skills_title;
  if (!groups.length) { $('#skills').hidden = true; return; }
  $('#skillsGrid').innerHTML = groups.map((g, i) => `
    <div class="glass spot skill reveal"><span class="n">0${i + 1}</span><h3>${esc(g.group)}</h3>
      <div class="chips">${(g.items || []).map(x => `<span>${esc(x)}</span>`).join('')}</div></div>`).join('');
}

function renderTestimonials(items, s) {
  if (!items.length) return;
  $('#testimonials').hidden = false;
  $('#tTitle').textContent = s.testimonials_title;
  $('#quotes').innerHTML = items.map(t => {
    const link = safeUrl(t.link);
    const who = `<div class="by">${t.photo ? `<img src="${esc(t.photo)}" alt="">` : `<span class="ini">${esc(initials(t.name))}</span>`}<div><b>${esc(t.name)}</b><span>${esc(t.role)}</span></div></div>`;
    return `<figure class="glass spot quote reveal" style="margin:0"><blockquote>${esc(t.quote)}</blockquote>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener" style="text-decoration:none">${who}</a>` : who}</figure>`;
  }).join('');
}

function renderPosts(posts, s) {
  if (!posts.length) return;
  $('#writing').hidden = false;
  $('#wTitle').textContent = s.writing_title;
  $('#posts').innerHTML = [...posts].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(p => {
    const ext = safeUrl(p.external_url), url = ext && !p.has_body ? ext : `/blog/${encodeURIComponent(p.slug)}`, out = url.startsWith('http');
    return `<a class="post" href="${esc(url)}" ${out ? 'target="_blank" rel="noopener"' : ''}>
      <span class="mono muted">${esc(prettyDate(p.date))}${p.read_minutes ? ` · ${p.read_minutes} min` : ''}</span>
      <div><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p></div>
      <span class="arrow" aria-hidden="true">${out ? '↗' : '→'}</span></a>`;
  }).join('');
}

function renderContact(s) {
  $('#contactTitle').innerHTML = inline(s.contact_title).replace(/(\S+)\.?$/, m => `<span class="grad-text">${m}</span>`);
  const rows = [];
  if (s.email) rows.push(`<a href="mailto:${esc(s.email)}"><i>@</i>${esc(s.email)}</a>`);
  if (s.phone) rows.push(`<a href="tel:${esc(s.phone.replace(/\s/g, ''))}"><i>☏</i>${esc(s.phone)}</a>`);
  if (safeUrl(s.linkedin)) rows.push(`<a href="${esc(s.linkedin)}" target="_blank" rel="noopener"><i>in</i>${esc(s.linkedin.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`);
  if (s.github_username) rows.push(`<a href="https://github.com/${esc(s.github_username)}" target="_blank" rel="noopener"><i>⌥</i>github.com/${esc(s.github_username)}</a>`);
  if (s.location) rows.push(`<span><i>⌖</i>${esc(s.location)}</span>`);
  $('#contactLines').innerHTML = rows.join('');
  $('#copyBtn').hidden = !s.email;
  $('#copyBtn').onclick = () => copyEmail(s.email, $('#copied'));
  $('#cform').hidden = s.contact_form !== '1';
  $('#cform').onsubmit = async e => {
    e.preventDefault();
    const msg = $('#cMsg'), btn = $('#cSend');
    msg.className = 'form-msg'; msg.textContent = '';
    btn.disabled = true; btn.firstChild.textContent = 'Sending… ';
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        name: $('#cName').value, email: $('#cEmail').value, subject: $('#cSubject').value, message: $('#cMessage').value, website: $('#cWebsite').value }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not send. Please email me instead.');
      msg.className = 'form-msg ok'; msg.textContent = "Thanks — it's in my inbox. I'll reply by email soon.";
      e.target.reset();
    } catch (ex) { msg.className = 'form-msg err'; msg.textContent = ex.message; }
    finally { btn.disabled = false; btn.firstChild.textContent = 'Send message '; }
  };
}

async function renderGitHub(s) {
  if (!s.github_username) return;
  let g;
  try { g = await (await fetch('/api/github')).json(); } catch { return; }
  if (!g.enabled) return;
  $('#github').hidden = false;
  $('#ghTitle').textContent = s.github_title;
  $('#ghLink').href = g.url;
  const total = g.languages.reduce((a, l) => a + l.count, 0) || 1;
  const col = l => LANG_COLORS[l] || 'var(--a1)';
  $('#ghBody').innerHTML = `
    <div class="glass spot gh-card reveal">
      <div class="who">${g.avatar ? `<img src="${esc(g.avatar)}" alt="">` : ''}<div><b>@${esc(g.username)}</b>${g.bio ? `<div class="muted" style="font-size:.9rem">${esc(g.bio)}</div>` : ''}</div></div>
      <div class="gh-nums"><div><b>${g.public_repos}</b><span>Repos</span></div><div><b>${g.stars}</b><span>Stars</span></div><div><b>${g.followers}</b><span>Followers</span></div></div>
      ${g.languages.length ? `<div><div class="mono muted" style="margin-bottom:8px">Languages by repo</div>
        <div class="langbar">${g.languages.map(l => `<span style="flex:${l.count};background:${col(l.name)}"></span>`).join('')}</div>
        <div class="langs" style="margin-top:10px">${g.languages.map(l => `<span><i style="background:${col(l.name)}"></i>${esc(l.name)} ${Math.round((l.count / total) * 100)}%</span>`).join('')}</div></div>` : ''}
    </div>
    <div class="repos">${g.repos.map(r => `
      <a class="glass spot repo reveal" href="${esc(r.url)}" target="_blank" rel="noopener">
        <h3>${esc(r.name)}</h3><p>${esc(r.description || 'No description yet.')}</p>
        <div class="rm">${r.language ? `<span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col(r.language)};margin-right:5px"></i>${esc(r.language)}</span>` : ''}<span>★ ${r.stars}</span><span>⑂ ${r.forks}</span></div>
      </a>`).join('')}</div>`;
  observeReveal($('#github'));
}

// Animate stat numbers from 0 when they scroll into view
function countUp() {
  const els = document.querySelectorAll('[data-count]');
  const run = el => {
    const m = el.dataset.count.match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/);
    if (!m || REDUCED) return;
    const [, pre, num, post] = m, target = parseFloat(num), dec = (num.split('.')[1] || '').length, t0 = performance.now();
    const tick = now => { const p = Math.min(1, (now - t0) / 1400), e = 1 - Math.pow(1 - p, 3); el.textContent = pre + (target * e).toFixed(dec) + post; if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { threshold: 0.6 });
  els.forEach(el => io.observe(el));
}
