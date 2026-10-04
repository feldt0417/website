/* FragLab — site chrome: nav, app preview, particles, tabs, toasts. */

// ---------------------------------------------------------------------------
// Site links. Paste your real URLs here and every Download / Discord button
// on the page will use them. Left empty, the buttons show "coming soon".
// ---------------------------------------------------------------------------
const SITE = {
  downloadUrl: '', // e.g. 'https://github.com/you/fraglab/releases/latest'
  discordUrl: '', // e.g. 'https://discord.gg/your-invite'
  buyUrl: '', // checkout / store page for the Pricing buttons
};

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.remove('no-js');

  // ---------- Toast ----------
  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2400);
  }

  // ---------- Clipboard + downloads ----------
  async function copy(text, message = 'Copied to clipboard') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* nothing else to try */ }
      ta.remove();
    }
    toast(message);
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Downloaded ${filename}`);
  }

  // ---------- Download / Discord links ----------
  $$('[data-link]').forEach((a) => {
    const kind = a.dataset.link;
    const url = { download: SITE.downloadUrl, discord: SITE.discordUrl, buy: SITE.buyUrl }[kind];
    if (url) {
      a.href = url;
      if (kind !== 'download') {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      return;
    }
    a.addEventListener('click', (e) => {
      e.preventDefault();
      toast({ download: 'Download link coming soon', discord: 'Discord invite coming soon', buy: 'Store coming soon' }[kind]);
    });
  });

  // ---------- Header: scroll state ----------
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Accent color (also driven by the app preview) ----------
  const ACCENTS = {
    violet: ['#8b5cf6', '#d946ef', '139 92 246'],
    crimson: ['#ef4444', '#f97316', '239 68 68'],
    ocean: ['#06b6d4', '#3b82f6', '6 182 212'],
    toxic: ['#22c55e', '#a3e635', '34 197 94'],
  };
  let accentRgb = ACCENTS.crimson[2];

  function setAccent(name, { save = true } = {}) {
    const a = ACCENTS[name];
    if (!a) return;
    const root = document.documentElement.style;
    root.setProperty('--accent', a[0]);
    root.setProperty('--accent-2', a[1]);
    root.setProperty('--accent-rgb', a[2]);
    accentRgb = a[2];
    $$('.accent-swatch').forEach((s) => s.setAttribute('aria-checked', String(s.dataset.accent === name)));
    if (save) {
      try { localStorage.setItem('fraglab-accent', name); } catch { /* storage unavailable */ }
    }
  }
  try {
    const saved = localStorage.getItem('fraglab-accent');
    if (saved && ACCENTS[saved]) setAccent(saved, { save: false });
  } catch { /* storage unavailable */ }

  // ---------- Hero particles ----------
  (function particles() {
    const canvas = $('#particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const hero = canvas.parentElement;
    const LINK = 130;
    let W = 0;
    let H = 0;
    let pts = [];
    let raf = 0;
    const pointer = { x: -9999, y: -9999 };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(90, Math.round((W * H) / 15000));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.3 + 0.5,
      }));
      if (!raf) draw(false);
    }

    function draw(move) {
      const rgb = accentRgb.replace(/ /g, ',');
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        if (move) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -10) p.x = W + 10;
          if (p.x > W + 10) p.x = -10;
          if (p.y < -10) p.y = H + 10;
          if (p.y > H + 10) p.y = -10;
        }
      }
      const nodes = pointer.x > -999 ? [...pts, { ...pointer, r: 0 }] : pts;
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.hypot(dx, dy);
          if (d < LINK) {
            ctx.strokeStyle = `rgba(${rgb},${(1 - d / LINK) * 0.28})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.fillStyle = `rgba(${rgb},0.75)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function loop() {
      draw(true);
      raf = requestAnimationFrame(loop);
    }
    const start = () => { if (!raf && !reducedMotion) raf = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    hero.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
    });
    hero.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999; });

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    resize();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(hero);
    } else {
      start();
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  })();

  // ---------- Card spotlight ----------
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.spot');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });

  // ---------- App preview ----------
  (function appPreview() {
    const app = $('#app-preview');
    if (!app) return;
    const tabs = $$('.app-tab', app);
    const panes = $$('.app-pane', app);

    function showPane(name, focus = false) {
      tabs.forEach((t) => {
        const on = t.dataset.pane === name;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      panes.forEach((p) => {
        const on = p.dataset.pane === name;
        p.hidden = !on;
        p.classList.toggle('is-active', on);
      });
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => showPane(t.dataset.pane));
      t.addEventListener('keydown', (e) => {
        const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        showPane(tabs[(i + step + tabs.length) % tabs.length].dataset.pane, true);
      });
    });

    // Switches
    $$('.app-switch', app).forEach((sw) =>
      sw.addEventListener('click', () => {
        sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true'));
        if (sw.dataset.flag) updateSpeedo();
      })
    );

    // Segmented buttons
    $$('.app-seg', app).forEach((seg) =>
      seg.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        $$('button', seg).forEach((b) => b.classList.toggle('is-active', b === btn));
      })
    );

    // Keybind capture
    const keyBtn = $('[data-keybind]', app);
    let listening = false;
    let previous = keyBtn.textContent;
    const stopListening = (label) => {
      listening = false;
      keyBtn.classList.remove('is-listening');
      keyBtn.textContent = label;
    };
    keyBtn.addEventListener('click', () => {
      if (listening) return stopListening(previous);
      previous = keyBtn.textContent;
      listening = true;
      keyBtn.classList.add('is-listening');
      keyBtn.textContent = 'Press a key…';
    });
    keyBtn.addEventListener('blur', () => { if (listening) stopListening(previous); });
    document.addEventListener(
      'keydown',
      (e) => {
        if (!listening) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') return stopListening(previous);
        const name = e.key === ' ' ? 'SPACE' : e.key.length === 1 ? e.key.toUpperCase() : e.key.toUpperCase().replace('ARROW', '');
        stopListening(name);
      },
      true
    );

    // Profiles
    $$('.app-item', app).forEach((item) =>
      item.addEventListener('click', () => {
        $$('.app-item', app).forEach((i) => {
          const on = i === item;
          i.classList.toggle('is-active', on);
          i.setAttribute('aria-selected', String(on));
        });
        $('#app-profile-name').textContent = item.dataset.profile;
      })
    );

    // Accent swatches
    $$('.accent-swatch', app).forEach((s) => s.addEventListener('click', () => setAccent(s.dataset.accent)));

    // Mini crosshair
    const mini = $('#mini-xh');
    const scale = { len: 3, gap: 3, thick: 2 };
    $$('[data-mini]', app).forEach((input) => {
      const apply = () => mini.style.setProperty(`--${input.dataset.mini}`, `${input.value * scale[input.dataset.mini]}px`);
      input.addEventListener('input', apply);
      apply();
    });

    // Speed overlay demo: speed climbs with each "hop" while the helper is on.
    const speedo = $('#speedo');
    const value = $('#speedo-value');
    const line = $('#speedo-line');
    const samples = Array(48).fill(250);
    let speed = 250;
    let tick = 0;
    let timer = 0;

    const flag = (name) => $(`.app-switch[data-flag="${name}"]`, app).getAttribute('aria-checked') === 'true';

    function step() {
      tick++;
      if (flag('bhop')) {
        if (tick % 6 === 0) speed += 9 + Math.random() * 9; // a clean hop
        speed -= 0.6;
        if (speed > 330 || tick % 90 === 0) speed = 252; // land, start a new chain
      } else {
        speed += (250 - speed) * 0.2 + (Math.random() - 0.5) * 2;
      }
      samples.push(speed);
      samples.shift();
      value.textContent = Math.round(speed);
      line.setAttribute(
        'points',
        samples.map((v, i) => `${(i / (samples.length - 1)) * 200},${48 - ((v - 230) / 120) * 44}`).join(' ')
      );
    }
    function updateSpeedo() {
      speedo.classList.toggle('is-off', !flag('speed'));
    }
    const run = () => { if (!timer && !reducedMotion) timer = setInterval(step, 70); };
    const halt = () => { clearInterval(timer); timer = 0; };
    step();
    updateSpeedo();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => (entry.isIntersecting ? run() : halt())).observe(app);
    } else {
      run();
    }
  })();

  // ---------- Tool tabs ----------
  const tabs = $$('.tool-tab');

  function openTool(name, { scroll = false, focus = false } = {}) {
    const target = tabs.find((t) => t.dataset.tool === name);
    if (!target) return;
    tabs.forEach((tab) => {
      const selected = tab === target;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      $('#' + tab.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) target.focus();
    if (scroll) $('#tools').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    document.dispatchEvent(new CustomEvent('fraglab:tool', { detail: name }));
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => openTool(tab.dataset.tool));
    tab.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') next = tabs[0];
      if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) {
        e.preventDefault();
        openTool(next.dataset.tool, { focus: true });
      }
    });
  });

  // Any link with data-tool-link jumps to that tool.
  $$('[data-tool-link]').forEach((link) =>
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openTool(link.dataset.toolLink, { scroll: true });
      history.replaceState(null, '', link.getAttribute('href'));
    })
  );

  // Deep links like /#tool-sens open the right tab on load.
  const hashTool = location.hash.match(/^#tool-(\w+)$/);
  if (hashTool) {
    openTool(hashTool[1]);
    requestAnimationFrame(() => $('#tools').scrollIntoView());
  }

  // ---------- Reveal on scroll ----------
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    $$('.reveal').forEach((el) => io.observe(el));
  } else {
    document.documentElement.classList.add('no-observer');
  }

  // ---------- Misc ----------
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  window.FragLab = { toast, copy, download, openTool, setAccent };
})();
