// Hero neural network: layered nodes, signals flowing input → output in the two brand hues.
// The cursor excites nearby neurons; scrolling drifts the network; it pauses when off-screen.
function startNet(canvas, inputs, outputs) {
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1, layers = [], edges = [], pulses = [], colors = {}, mouse = { x: -999, y: -999 }, visible = true, last = 0, t0 = performance.now();

  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const hex = h => { const m = h.replace('#', '').match(/.{2}/g); return m ? m.map(x => parseInt(x, 16)) : [124, 92, 255]; };
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  function readColors() {
    colors = { a1: hex(css('--a1') || '#7c5cff'), a2: hex(css('--a2') || '#21d4fd'), ink: css('--ink') || '#fff', muted: css('--muted') || '#999', dark: document.documentElement.dataset.theme === 'dark' };
  }
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function layout() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const narrow = W < 1000;
    const x0 = narrow ? W * 0.12 : Math.max(W * 0.56, 780), x1 = narrow ? W * 0.84 : W * 0.86;
    const top = narrow ? H * 0.12 : H * 0.18, bot = narrow ? H * 0.88 : H * 0.84;
    const sizes = [inputs.length, narrow ? 5 : 7, narrow ? 5 : 7, narrow ? 4 : 5, outputs.length];
    layers = sizes.map((n, li) => {
      const x = x0 + (x1 - x0) * (li / (sizes.length - 1));
      return Array.from({ length: n }, (_, i) => ({
        li, i, x, y: top + (bot - top) * ((i + 0.5) / n), phase: Math.random() * 6.28, heat: 0,
        label: li === 0 ? inputs[i] : li === sizes.length - 1 ? outputs[i] : null,
      }));
    });
    edges = [];
    for (let l = 0; l < layers.length - 1; l++) layers[l].forEach(a => layers[l + 1].forEach(b => edges.push({ a, b, w: Math.random() })));
  }

  function spawn(from) {
    const outs = edges.filter(e => e.a === from);
    const e = outs[Math.floor(Math.random() * outs.length)];
    if (e) pulses.push({ e, t: 0, speed: 0.55 + Math.random() * 0.6 });
  }
  const pos = (n, time) => ({ x: n.x, y: n.y + Math.sin(time / 1400 + n.phase) * 5 - scrollY * 0.12 });

  function frame(now) {
    if (!visible) { last = now; requestAnimationFrame(frame); return; }
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    const time = now - t0;
    ctx.clearRect(0, 0, W, H);

    // edges
    ctx.lineWidth = 1;
    for (const e of edges) {
      const p = pos(e.a, time), q = pos(e.b, time);
      const g = ctx.createLinearGradient(p.x, p.y, q.x, q.y);
      const base = colors.dark ? 0.07 : 0.1, hot = Math.max(e.a.heat, e.b.heat) * 0.35;
      g.addColorStop(0, rgba(mix(colors.a1, colors.a2, e.a.li / 4), base + hot * e.w));
      g.addColorStop(1, rgba(mix(colors.a1, colors.a2, e.b.li / 4), base + hot * e.w));
      ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }

    // spawn signals: steady trickle + extra near the cursor
    if (!reduced && Math.random() < dt * 5) spawn(layers[0][Math.floor(Math.random() * layers[0].length)]);
    for (const L of layers) for (const n of L) {
      const p = pos(n, time), d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
      if (d < 140) { n.heat = Math.min(1, n.heat + dt * 3); if (!reduced && Math.random() < dt * 4 && n.li < layers.length - 1) spawn(n); }
      n.heat = Math.max(0, n.heat - dt * 0.9);
    }

    // pulses
    for (let k = pulses.length - 1; k >= 0; k--) {
      const s = pulses[k];
      s.t += dt * s.speed;
      const p = pos(s.e.a, time), q = pos(s.e.b, time);
      const x = p.x + (q.x - p.x) * s.t, y = p.y + (q.y - p.y) * s.t;
      const c = mix(colors.a1, colors.a2, (s.e.a.li + s.t) / 4);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
      g.addColorStop(0, rgba(c, 0.95)); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 12, 0, 6.283); ctx.fill();
      if (s.t >= 1) {
        pulses.splice(k, 1);
        s.e.b.heat = Math.min(1, s.e.b.heat + 0.6);
        if (s.e.b.li < layers.length - 1 && Math.random() < 0.72) spawn(s.e.b);
      }
    }
    if (pulses.length > 160) pulses.splice(0, pulses.length - 160);

    // nodes + labels
    ctx.font = '500 12px "JetBrains Mono", monospace';
    for (const L of layers) for (const n of L) {
      const p = pos(n, time), c = mix(colors.a1, colors.a2, n.li / 4), r = n.label ? 6 : 4.5;
      if (n.heat > 0.02) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26);
        g.addColorStop(0, rgba(c, 0.5 * n.heat)); g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = colors.dark ? '#0b0d17' : '#ffffff';
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 1.5, 0, 6.283); ctx.fill();
      ctx.fillStyle = rgba(c, 0.55 + n.heat * 0.45);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      if (n.label && W >= 560) {
        ctx.fillStyle = n.li === 0 ? colors.muted : colors.ink;
        ctx.textAlign = n.li === 0 ? 'right' : 'left'; ctx.textBaseline = 'middle';
        if (n.li !== 0) ctx.font = '700 13px "JetBrains Mono", monospace';
        ctx.fillText(n.label, p.x + (n.li === 0 ? -14 : 14), p.y);
        ctx.font = '500 12px "JetBrains Mono", monospace';
      }
    }
    requestAnimationFrame(frame);
  }

  readColors(); layout();
  addEventListener('resize', layout);
  document.addEventListener('themechange', readColors);
  canvas.parentElement.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
  canvas.parentElement.addEventListener('pointerleave', () => (mouse = { x: -999, y: -999 }));
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  // pre-warm so the first frame already shows signals in flight
  for (let i = 0; i < 14; i++) { spawn(layers[0][i % layers[0].length]); pulses[pulses.length - 1].t = Math.random(); }
  requestAnimationFrame(frame);
  return { recolor: () => { readColors(); } };
}

// Generative cover art for projects without an image: a small network drawn from the title
function coverArt(canvas, seedText) {
  const ctx = canvas.getContext('2d');
  let seed = [...seedText].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const draw = () => {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const W = r.width || 400, H = r.height || 250;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const a1 = css('--a1'), a2 = css('--a2'), dark = document.documentElement.dataset.theme === 'dark';
    const s0 = seed;
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, dark ? '#0d0f1c' : '#eef0fb'); bg.addColorStop(1, dark ? '#131733' : '#e4e8ff');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 3; i++) {
      const x = rnd() * W, y = rnd() * H, rad = (0.4 + rnd() * 0.5) * Math.max(W, H);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, (i % 2 ? a2 : a1) + (dark ? '66' : '44')); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    const pts = Array.from({ length: 22 }, () => [W * (0.08 + rnd() * 0.84), H * (0.12 + rnd() * 0.76)]);
    ctx.lineWidth = 1;
    pts.forEach((p, i) => pts.forEach((q, j) => {
      if (j <= i) return; const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d < Math.min(W, H) * 0.42) { ctx.strokeStyle = (dark ? 'rgba(255,255,255,' : 'rgba(20,24,60,') + (0.18 * (1 - d / (Math.min(W, H) * 0.42))).toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); }
    }));
    pts.forEach((p, i) => { ctx.fillStyle = i % 3 ? a1 : a2; ctx.beginPath(); ctx.arc(p[0], p[1], 2.5 + (i % 4), 0, 6.283); ctx.fill(); });
    seed = s0;
  };
  draw();
  document.addEventListener('themechange', draw);
  addEventListener('resize', draw);
}
