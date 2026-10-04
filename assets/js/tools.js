/* FragLab — the CS2 tools. Everything runs locally; nothing is sent anywhere. */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const { copy, download, toast, openTool, onDprChange } = window.FragLab;

  // ==========================================================================
  // Shared helpers
  // ==========================================================================

  /** Round to `digits` decimals and drop trailing zeros: 1.50 -> "1.5". */
  const fmt = (n, digits = 2) => String(Number(n.toFixed(digits)) || 0);

  const clampToInput = (el, v) => {
    const min = el.min !== '' ? parseFloat(el.min) : -Infinity;
    const max = el.max !== '' ? parseFloat(el.max) : Infinity;
    return Math.min(max, Math.max(min, v));
  };

  /** Read a numeric input, falling back to its default and clamping to min/max. */
  function num(id) {
    const el = document.getElementById(id);
    let v = parseFloat(el.value);
    if (Number.isNaN(v)) v = parseFloat(el.defaultValue) || 0;
    return clampToInput(el, v);
  }

  /** Set a numeric input (and its paired slider, if any). */
  function setNum(id, value) {
    const el = document.getElementById(id);
    const v = clampToInput(el, value);
    el.value = v;
    const range = el.closest('.range')?.querySelector('input[type="range"]');
    if (range) range.value = v;
  }

  // Keep every slider and its number box in sync. These listeners run before
  // the form-level "input" handlers below, so tools always read fresh values.
  $$('.range').forEach((row) => {
    const range = $('input[type="range"]', row);
    const box = $('input[type="number"]', row);
    range.addEventListener('input', () => { box.value = range.value; });
    box.addEventListener('input', () => { if (box.value !== '') range.value = box.value; });
    box.addEventListener('change', () => {
      box.value = num(box.id);
      range.value = box.value;
    });
  });

  const escapeHtml = (s) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /** Minimal syntax highlighting for .cfg text. */
  function highlight(text) {
    return text
      .split('\n')
      .map((line) => {
        if (/^\s*\/\//.test(line)) return `<span class="c-com">${escapeHtml(line)}</span>`;
        const m = line.match(/^(\S+)(.*)$/);
        if (!m) return escapeHtml(line);
        const rest = escapeHtml(m[2]).replace(
          /(&quot;.*?&quot;|-?\b\d+(?:\.\d+)?\b)/g,
          '<span class="c-val">$1</span>'
        );
        return `<span class="c-cmd">${escapeHtml(m[1])}</span>${rest}`;
      })
      .join('\n');
  }

  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgbToHex = (r, g, b) =>
    '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

  // ==========================================================================
  // 1. Crosshair builder
  // ==========================================================================

  // Built-in cl_crosshaircolor values 0–4. 5 means "custom RGB".
  const XH_COLORS = [[250, 50, 50], [50, 250, 50], [250, 250, 50], [50, 50, 250], [50, 250, 250]];

  const XH_PRESETS = {
    classic: { size: 2, thickness: 0.5, gap: -3, dot: false, t: false, outline: true, outlineThickness: 1, color: 1 },
    cyan: { size: 1.5, thickness: 1, gap: -2.5, dot: false, t: false, outline: true, outlineThickness: 1, color: 5, custom: '#00ffff' },
    dot: { size: 0, thickness: 2, gap: -3, dot: true, t: false, outline: true, outlineThickness: 1, color: 5, custom: '#ffffff' },
    tshape: { size: 3, thickness: 1, gap: -2, dot: false, t: true, outline: true, outlineThickness: 1, color: 4 },
    big: { size: 5, thickness: 1, gap: 0, dot: false, t: false, outline: false, outlineThickness: 1, color: 2 },
  };

  const xhForm = $('#xh-form');
  const xhCanvas = $('#xh-canvas');
  const xhOffscreen = document.createElement('canvas');
  let xhScene = 'desert';

  function readXh() {
    const color = Number($('input[name="xh-color"]:checked').value);
    return {
      style: Number($('#xh-style').value),
      size: num('xh-size'),
      thickness: num('xh-thickness'),
      gap: num('xh-gap'),
      outline: $('#xh-outline').checked,
      outlineThickness: num('xh-outline-thickness'),
      dot: $('#xh-dot').checked,
      t: $('#xh-t').checked,
      recoil: $('#xh-recoil').checked,
      color,
      rgb: color === 5 ? hexToRgb($('#xh-custom').value) : XH_COLORS[color],
      alpha: Math.round(num('xh-alpha')),
    };
  }

  /** The crosshair as [command, value] pairs. */
  function xhCommands(s) {
    const cmds = [
      ['cl_crosshairstyle', s.style],
      ['cl_crosshairsize', fmt(s.size)],
      ['cl_crosshairthickness', fmt(s.thickness)],
      ['cl_crosshairgap', fmt(s.gap)],
      ['cl_crosshair_drawoutline', s.outline ? 1 : 0],
      ['cl_crosshair_outlinethickness', fmt(s.outlineThickness)],
      ['cl_crosshairdot', s.dot ? 1 : 0],
      ['cl_crosshair_t', s.t ? 1 : 0],
      ['cl_crosshair_recoil', s.recoil ? 1 : 0],
      ['cl_crosshairgap_useweaponvalue', 0],
      ['cl_crosshaircolor', s.color],
    ];
    if (s.color === 5) {
      cmds.push(['cl_crosshaircolor_r', s.rgb[0]], ['cl_crosshaircolor_g', s.rgb[1]], ['cl_crosshaircolor_b', s.rgb[2]]);
    }
    cmds.push(['cl_crosshairusealpha', 1], ['cl_crosshairalpha', s.alpha]);
    return cmds;
  }

  /** Paint a simple map-like backdrop so you can judge visibility. */
  function drawScene(ctx, W, H, scene) {
    const vgrad = (y0, y1, stops) => {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      stops.forEach(([o, c]) => g.addColorStop(o, c));
      return g;
    };
    const rect = (color, x, y, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const arch = (color, x, top, w, bottom) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, bottom);
      ctx.lineTo(x, top + w / 2);
      ctx.arc(x + w / 2, top + w / 2, w / 2, Math.PI, 0);
      ctx.lineTo(x + w, bottom);
      ctx.closePath();
      ctx.fill();
    };
    const blob = (color, x, y, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    const floorY = H * 0.78;

    if (scene === 'desert') {
      rect(vgrad(0, H * 0.5, [[0, '#7fb0dc'], [1, '#dbe7ef']]), 0, 0, W, H);
      rect(vgrad(H * 0.3, floorY, [[0, '#e3c693'], [1, '#c8a36b']]), 0, H * 0.32, W, floorY - H * 0.32);
      for (let y = H * 0.32; y < floorY; y += H * 0.06) rect('rgba(90,60,25,0.13)', 0, y, W, Math.max(1, H * 0.006));
      rect('#d8b883', W * 0.05, H * 0.1, W * 0.17, floorY - H * 0.1);
      rect('rgba(0,0,0,0.09)', W * 0.18, H * 0.1, W * 0.04, floorY - H * 0.1);
      arch('#3a2d22', W * 0.53, H * 0.44, W * 0.14, floorY);
      rect('#8d6c3d', W * 0.27, H * 0.6, W * 0.11, floorY - H * 0.6);
      rect('#7a5b31', W * 0.3, H * 0.47, W * 0.08, H * 0.13);
      rect('rgba(0,0,0,0.15)', W * 0.27, H * 0.6, W * 0.11, Math.max(1, H * 0.01));
      rect(vgrad(floorY, H, [[0, '#c29d64'], [1, '#a5824d']]), 0, floorY, W, H - floorY);
    } else if (scene === 'dark') {
      rect('#1a1c21', 0, 0, W, H);
      for (let i = 0; i < 6; i++) rect(i % 2 ? '#20232a' : '#24272e', (W / 6) * i, H * 0.08, W / 6, floorY - H * 0.08);
      const glow = ctx.createRadialGradient(W * 0.68, H * 0.22, 0, W * 0.68, H * 0.22, H * 0.7);
      glow.addColorStop(0, 'rgba(255,210,140,0.35)');
      glow.addColorStop(1, 'rgba(255,210,140,0)');
      rect(glow, 0, 0, W, H);
      rect('#ffe1a8', W * 0.66, H * 0.16, W * 0.04, H * 0.02);
      rect('#30353e', W * 0.12, H * 0.34, W * 0.16, floorY - H * 0.34);
      rect('#0e0f12', W * 0.14, H * 0.38, W * 0.12, floorY - H * 0.38);
      rect('#2c2a25', W * 0.44, H * 0.58, W * 0.14, floorY - H * 0.58);
      rect('#23211d', W * 0.47, H * 0.46, W * 0.1, H * 0.12);
      rect(vgrad(floorY, H, [[0, '#15161a'], [1, '#0c0d0f']]), 0, floorY, W, H - floorY);
    } else if (scene === 'bright') {
      rect(vgrad(0, H * 0.5, [[0, '#e4edf6'], [1, '#ffffff']]), 0, 0, W, H);
      rect('#f4f2ed', 0, H * 0.3, W, floorY - H * 0.3);
      rect('#e3e0d8', W * 0.08, H * 0.12, W * 0.18, floorY - H * 0.12);
      rect('#d9d5cb', W * 0.22, H * 0.12, W * 0.04, floorY - H * 0.12);
      arch('#cfcac0', W * 0.54, H * 0.42, W * 0.14, floorY);
      rect('#ebe8e1', W * 0.32, H * 0.58, W * 0.12, floorY - H * 0.58);
      rect(vgrad(floorY, H, [[0, '#f7f7f5'], [1, '#e9e8e4']]), 0, floorY, W, H - floorY);
    } else {
      // foliage
      rect(vgrad(0, H * 0.6, [[0, '#93c1e6'], [1, '#dcebf4']]), 0, 0, W, H);
      for (let i = 0; i < 9; i++) blob('#6f9a63', (W / 8) * i, H * 0.48, H * 0.16);
      for (let i = 0; i < 7; i++) blob('#4f7f44', (W / 6) * i + W * 0.05, H * 0.6, H * 0.15);
      rect('#5b4330', W * 0.71, H * 0.18, W * 0.025, floorY - H * 0.18);
      blob('#3f6d35', W * 0.72, H * 0.2, H * 0.17);
      blob('#355f2d', W * 0.66, H * 0.3, H * 0.12);
      blob('#2f5528', W * 0.42, H * 0.7, H * 0.12);
      blob('#3a6631', W * 0.5, H * 0.68, H * 0.1);
      rect(vgrad(floorY, H, [[0, '#6c8f4a'], [1, '#4e6f36']]), 0, floorY, W, H - floorY);
    }
  }

  function drawCrosshair() {
    if (!xhCanvas.clientWidth) return; // panel hidden
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(xhCanvas.clientWidth * dpr);
    const H = Math.round(xhCanvas.clientHeight * dpr);
    if (xhCanvas.width !== W || xhCanvas.height !== H) {
      xhCanvas.width = W;
      xhCanvas.height = H;
    }
    if (xhOffscreen.width !== W || xhOffscreen.height !== H) {
      xhOffscreen.width = W;
      xhOffscreen.height = H;
    }
    const ctx = xhCanvas.getContext('2d');
    drawScene(ctx, W, H, xhScene);

    // CS2 scales crosshair units by screenHeight / 480, so we model 1080p.
    // Every value is snapped to whole 1080p pixels, then magnified by `z`.
    const s = readXh();
    const k = 1080 / 480;
    const z = Math.max(1, Math.round(Number($('#xh-zoom').value) * dpr));
    const t = Math.max(1, Math.round(s.thickness * k));
    const len = Math.round(s.size * k);
    const edgeGap = Math.round(((s.gap + 4) * k) / 2);
    const o = s.outline ? Math.round(s.outlineThickness) : 0;
    const a = t / 2 + edgeGap; // distance from centre to the inner end of each arm

    const parts = [];
    if (len > 0) {
      parts.push([a, -t / 2, len, t]); // right
      parts.push([-a - len, -t / 2, len, t]); // left
      parts.push([-t / 2, a, t, len]); // bottom
      if (!s.t) parts.push([-t / 2, -a - len, t, len]); // top
    }
    if (s.dot) parts.push([-t / 2, -t / 2, t, t]);

    // Centre on a pixel boundary or pixel centre so edges land on whole pixels.
    const half = (t * z) % 2 ? 0.5 : 0;
    const cx = Math.floor(W / 2) + half;
    const cy = Math.floor(H / 2) + half;

    // Draw opaque on an offscreen canvas, then composite once with the
    // crosshair alpha so outline + fill don't double up where they overlap.
    const octx = xhOffscreen.getContext('2d');
    octx.clearRect(0, 0, W, H);
    const fill = (x, y, w, h) => {
      const x0 = Math.round(cx + x * z);
      const y0 = Math.round(cy + y * z);
      const x1 = Math.round(cx + (x + w) * z);
      const y1 = Math.round(cy + (y + h) * z);
      octx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    };
    if (o > 0) {
      octx.fillStyle = '#000';
      parts.forEach(([x, y, w, h]) => fill(x - o, y - o, w + o * 2, h + o * 2));
    }
    octx.fillStyle = `rgb(${s.rgb.join(',')})`;
    parts.forEach((p) => fill(...p));

    ctx.globalAlpha = s.alpha / 255;
    ctx.drawImage(xhOffscreen, 0, 0);
    ctx.globalAlpha = 1;
  }

  function renderXhCode() {
    const cmds = xhCommands(readXh());
    $('#xh-code').innerHTML = highlight(cmds.map(([c, v]) => `${c} ${v}`).join('\n'));
  }

  function syncXhVisibility() {
    $('#xh-custom-row').hidden = $('input[name="xh-color"]:checked').value !== '5';
    $('#xh-outline-row').hidden = !$('#xh-outline').checked;
  }

  function updateCrosshair() {
    syncXhVisibility();
    drawCrosshair();
    renderXhCode();
    renderAutoexec();
  }

  function applyXhPreset(name) {
    const p = XH_PRESETS[name];
    if (!p) return;
    setNum('xh-size', p.size);
    setNum('xh-thickness', p.thickness);
    setNum('xh-gap', p.gap);
    setNum('xh-outline-thickness', p.outlineThickness);
    setNum('xh-alpha', 255);
    $('#xh-dot').checked = p.dot;
    $('#xh-t').checked = p.t;
    $('#xh-outline').checked = p.outline;
    $('#xh-recoil').checked = false;
    $('#xh-style').value = '4';
    $(`input[name="xh-color"][value="${p.color}"]`).checked = true;
    if (p.custom) $('#xh-custom').value = p.custom;
    updateCrosshair();
  }

  function importXh(text) {
    if (/CSGO(-[A-Za-z0-9]{5}){5}/.test(text)) {
      toast("Share codes aren't supported yet. Paste console commands instead.");
      return;
    }
    const values = {};
    text.split(/[;\n\r]+/).forEach((part) => {
      const m = part.trim().match(/^(cl_crosshair\w*)\s+"?(-?\d*\.?\d+)"?/i);
      if (m) values[m[1].toLowerCase()] = parseFloat(m[2]);
    });
    const keys = Object.keys(values);
    if (!keys.length) {
      toast('No crosshair commands found');
      return;
    }

    const has = (k) => k in values;
    if (has('cl_crosshairsize')) setNum('xh-size', values.cl_crosshairsize);
    if (has('cl_crosshairthickness')) setNum('xh-thickness', values.cl_crosshairthickness);
    if (has('cl_crosshairgap')) setNum('xh-gap', values.cl_crosshairgap);
    if (has('cl_crosshair_outlinethickness')) setNum('xh-outline-thickness', values.cl_crosshair_outlinethickness);
    if (has('cl_crosshairalpha')) setNum('xh-alpha', values.cl_crosshairalpha);
    if (has('cl_crosshairusealpha') && !values.cl_crosshairusealpha) setNum('xh-alpha', 255);
    if (has('cl_crosshair_drawoutline')) $('#xh-outline').checked = !!values.cl_crosshair_drawoutline;
    if (has('cl_crosshairdot')) $('#xh-dot').checked = !!values.cl_crosshairdot;
    if (has('cl_crosshair_t')) $('#xh-t').checked = !!values.cl_crosshair_t;
    if (has('cl_crosshair_recoil')) $('#xh-recoil').checked = !!values.cl_crosshair_recoil;
    if (has('cl_crosshairstyle')) {
      const opt = $(`#xh-style option[value="${values.cl_crosshairstyle}"]`);
      if (opt) $('#xh-style').value = opt.value;
    }
    if (has('cl_crosshaircolor')) {
      const radio = $(`input[name="xh-color"][value="${Math.round(values.cl_crosshaircolor)}"]`);
      if (radio) radio.checked = true;
    }
    if (has('cl_crosshaircolor_r') || has('cl_crosshaircolor_g') || has('cl_crosshaircolor_b')) {
      const [r, g, b] = hexToRgb($('#xh-custom').value);
      $('#xh-custom').value = rgbToHex(
        values.cl_crosshaircolor_r ?? r,
        values.cl_crosshaircolor_g ?? g,
        values.cl_crosshaircolor_b ?? b
      );
    }
    $('#xh-preset').value = 'custom';
    updateCrosshair();
    toast(`Imported ${keys.length} setting${keys.length === 1 ? '' : 's'}`);
  }

  xhForm.addEventListener('input', (e) => {
    if (e.target.id === 'xh-preset') return;
    $('#xh-preset').value = 'custom';
    updateCrosshair();
  });
  xhForm.addEventListener('submit', (e) => e.preventDefault());
  $('#xh-preset').addEventListener('change', (e) => applyXhPreset(e.target.value));
  $('#xh-zoom').addEventListener('change', drawCrosshair);
  $$('.segmented [data-scene]').forEach((btn) =>
    btn.addEventListener('click', () => {
      xhScene = btn.dataset.scene;
      $$('.segmented [data-scene]').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      drawCrosshair();
    })
  );
  $('#xh-copy').addEventListener('click', () =>
    copy(xhCommands(readXh()).map(([c, v]) => `${c} ${v}`).join('; '), 'Crosshair copied. Paste it into the CS2 console.')
  );
  $('#xh-import-btn').addEventListener('click', () => importXh($('#xh-import').value));

  if ('ResizeObserver' in window) new ResizeObserver(drawCrosshair).observe(xhCanvas);
  else window.addEventListener('resize', drawCrosshair);
  onDprChange(drawCrosshair);
  document.addEventListener('fraglab:tool', (e) => { if (e.detail === 'crosshair') drawCrosshair(); });

  // ==========================================================================
  // 2. Sensitivity converter
  // ==========================================================================

  // Yaw = degrees turned per mouse count at sensitivity 1.
  const GAMES = {
    cs2: { name: 'Counter-Strike 2', yaw: 0.022 },
    csgo: { name: 'CS:GO', yaw: 0.022 },
    valorant: { name: 'Valorant', yaw: 0.07 },
    apex: { name: 'Apex Legends', yaw: 0.022 },
    ow2: { name: 'Overwatch 2', yaw: 0.0066 },
    tf2: { name: 'Team Fortress 2', yaw: 0.022 },
  };
  const CS_YAW = GAMES.cs2.yaw;

  const fromSel = $('#sens-from-game');
  const toSel = $('#sens-to-game');
  Object.entries(GAMES).forEach(([id, g]) => {
    fromSel.add(new Option(g.name, id));
    toSel.add(new Option(g.name, id));
  });
  fromSel.value = 'valorant';
  toSel.value = 'cs2';

  function readSens() {
    const sens = parseFloat($('#sens-from').value);
    const dpi = parseFloat($('#sens-dpi').value);
    const toDpi = parseFloat($('#sens-to-dpi').value) || dpi;
    if (!(sens > 0) || !(dpi > 0) || !(toDpi > 0)) return null;
    const from = GAMES[fromSel.value];
    const to = GAMES[toSel.value];
    const degPerInch = sens * from.yaw * dpi;
    return {
      to,
      result: degPerInch / (to.yaw * toDpi),
      cs2Sens: degPerInch / (CS_YAW * toDpi),
      edpi: degPerInch / CS_YAW, // CS2 sensitivity × DPI; independent of the DPI split
      cm360: (360 / degPerInch) * 2.54,
      in360: 360 / degPerInch,
    };
  }

  let announceTimer;
  const announceSens = (text) => {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { $('#sens-live').textContent = text; }, 600);
  };

  function renderSens() {
    const r = readSens();
    $('#sens-result-label').textContent = `Your ${GAMES[toSel.value].name} sensitivity`;
    if (!r) {
      ['#sens-result', '#sens-edpi', '#sens-cm', '#sens-in'].forEach((id) => { $(id).textContent = '—'; });
      $('#sens-note').textContent = 'Enter a sensitivity and DPI above zero.';
      $('#sens-pin').style.left = '0%';
      return;
    }
    $('#sens-result').textContent = fmt(r.result, 3);
    announceSens(`${GAMES[toSel.value].name} sensitivity ${fmt(r.result, 3)}`);
    $('#sens-edpi').textContent = Math.round(r.edpi).toLocaleString();
    $('#sens-cm').textContent = fmt(r.cm360, 1);
    $('#sens-in').textContent = fmt(r.in360, 1);
    $('#sens-pin').style.left = `${Math.min(100, (r.edpi / 2000) * 100)}%`;
    $('#sens-note').textContent =
      r.edpi < 600
        ? 'Low sensitivity: big arm movements and rock-steady micro-adjustments.'
        : r.edpi <= 1200
          ? "Right in the range where most CS players land. A solid all-round sensitivity."
          : 'High sensitivity: fast flicks, but harder to hold tight angles.';
  }

  $('#sens-form').addEventListener('input', renderSens);
  $('#sens-form').addEventListener('submit', (e) => e.preventDefault());
  // Changing the source DPI also moves the target DPI until the user sets it explicitly.
  let toDpiTouched = false;
  $('#sens-to-dpi').addEventListener('input', () => { toDpiTouched = true; });
  $('#sens-dpi').addEventListener('input', () => {
    if (!toDpiTouched) $('#sens-to-dpi').value = $('#sens-dpi').value;
  });
  $('#sens-copy').addEventListener('click', () => {
    const r = readSens();
    if (!r) return toast('Enter a valid sensitivity first');
    // Source-engine games take the same console command.
    const usesSensitivityCmd = ['cs2', 'csgo', 'tf2'].includes(toSel.value);
    copy(usesSensitivityCmd ? `sensitivity ${fmt(r.result, 3)}` : fmt(r.result, 3));
  });
  $('#sens-to-autoexec').addEventListener('click', () => {
    const r = readSens();
    if (!r) return toast('Enter a valid sensitivity first');
    setNum('ae-sens', Number(fmt(r.cs2Sens, 3)));
    renderAutoexec();
    openTool('autoexec', { scroll: true });
    $('#ae-sens').focus({ preventScroll: true });
    toast(`CS2 sensitivity ${fmt(r.cs2Sens, 3)} added to your autoexec`);
  });

  // ==========================================================================
  // 3. Autoexec generator
  // ==========================================================================

  const VM_PRESETS = {
    classic: { fov: 68, x: 2.5, y: 0, z: -1.5 },
    default: { fov: 60, x: 1, y: 1, z: -1 },
  };

  function autoexecText() {
    const lines = [];
    const set = (cmd, value) => lines.push(`${cmd} ${value}`);
    const section = (title) => lines.push('', `// --- ${title} ---`);
    const on = (id) => ($('#' + id).checked ? 1 : 0);

    lines.push(
      '// =============================================',
      '//  autoexec.cfg - generated by FragLab',
      '//  Launch option: +exec autoexec',
      '// ============================================='
    );

    section('Mouse');
    set('sensitivity', fmt(num('ae-sens'), 3));
    set('zoom_sensitivity_ratio', fmt(num('ae-zoom'), 2));

    section('Performance');
    set('fps_max', Math.round(num('ae-fps')));

    if ($('#ae-xh').checked) {
      section('Crosshair');
      xhCommands(readXh()).forEach(([c, v]) => set(c, v));
    }

    section('Viewmodel');
    set('viewmodel_fov', Math.round(num('ae-vm-fov')));
    set('viewmodel_offset_x', fmt(num('ae-vm-x'), 1));
    set('viewmodel_offset_y', fmt(num('ae-vm-y'), 1));
    set('viewmodel_offset_z', fmt(num('ae-vm-z'), 1));

    section('HUD & radar');
    set('hud_scaling', fmt(num('ae-hud-scale'), 2));
    set('cl_hud_color', $('#ae-hud-color').value);
    set('cl_radar_scale', fmt(num('ae-radar-scale'), 2));
    set('cl_hud_radar_scale', fmt(num('ae-radar-hud'), 2));
    set('cl_radar_rotate', on('ae-radar-rotate'));
    set('cl_radar_always_centered', on('ae-radar-center'));

    section('Audio');
    set('volume', fmt(num('ae-volume'), 2));
    set('snd_mute_losefocus', on('ae-mute-focus') ? 0 : 1);

    if ($('#ae-jump-wheel').checked) {
      section('Binds');
      lines.push('bind "mwheeldown" "+jump"');
    }

    if ($('#ae-console').checked) {
      section('Misc');
      set('con_enable', 1);
    }

    lines.push('', 'host_writeconfig', 'echo "FragLab autoexec loaded"');
    return lines.join('\n') + '\n';
  }

  function renderAutoexec() {
    $('#ae-code').innerHTML = highlight(autoexecText());
  }

  function applyVmPreset(name) {
    const p = VM_PRESETS[name];
    if (!p) return;
    setNum('ae-vm-fov', p.fov);
    setNum('ae-vm-x', p.x);
    setNum('ae-vm-y', p.y);
    setNum('ae-vm-z', p.z);
    renderAutoexec();
  }

  $('#ae-form').addEventListener('input', (e) => {
    // Touching any viewmodel slider means we're no longer on a preset.
    const row = e.target.closest('.range');
    if (row && $('[id^="ae-vm-"]', row)) $('#ae-vm-preset').value = 'custom';
    renderAutoexec();
  });
  $('#ae-form').addEventListener('submit', (e) => e.preventDefault());
  $('#ae-vm-preset').addEventListener('change', (e) => applyVmPreset(e.target.value));
  $('#ae-copy').addEventListener('click', () => copy(autoexecText()));
  $('#ae-download').addEventListener('click', () => download('autoexec.cfg', autoexecText()));

  // ==========================================================================
  // 4. Practice config
  // ==========================================================================

  /** Keep key names safe inside a quoted bind. */
  const cleanKey = (v) => v.trim().toLowerCase().replace(/["';\s]/g, '');

  function practiceText() {
    const lines = [
      '// =============================================',
      '//  practice.cfg - generated by FragLab',
      '//  Usage: map de_mirage, then: exec practice',
      '// =============================================',
      '',
      'sv_cheats 1',
    ];
    const block = (id, title, cmds) => {
      if ($('#' + id).checked) lines.push('', `// ${title}`, ...cmds);
    };

    block('pr-round', 'Endless round', [
      'mp_roundtime 60',
      'mp_roundtime_defuse 60',
      'mp_freezetime 0',
      'mp_ignore_round_win_conditions 1',
    ]);
    block('pr-money', 'Money', ['mp_maxmoney 60000', 'mp_startmoney 60000', 'mp_afterroundmoney 60000']);
    block('pr-buy', 'Buying', ['mp_buy_anywhere 1', 'mp_buytime 9999']);
    block('pr-teams', 'Teams', ['mp_limitteams 0', 'mp_autoteambalance 0']);
    block('pr-respawn', 'Respawning', ['mp_respawn_on_death_ct 1', 'mp_respawn_on_death_t 1']);
    block('pr-ammo', 'Ammo', ['sv_infinite_ammo 1']);
    block('pr-nades', 'Grenades', ['ammo_grenade_limit_total 5']);
    block('pr-traj', 'Trajectory preview', ['sv_grenade_trajectory_prac_pipreview 1']);
    block('pr-impacts', 'Bullet impacts', ['sv_showimpacts 1']);

    const noclip = cleanKey($('#pr-noclip').value);
    const rethrow = cleanKey($('#pr-rethrow').value);
    if (noclip || rethrow) {
      lines.push('', '// Binds');
      if (noclip) lines.push(`bind "${noclip}" "noclip"`);
      if (rethrow) lines.push(`bind "${rethrow}" "sv_rethrow_last_grenade"`);
    }

    if ($('#pr-bots').checked) lines.push('', '// Bots', 'bot_kick');
    lines.push('', 'mp_warmup_end', 'mp_restartgame 1', 'echo "FragLab practice config loaded"');
    return lines.join('\n') + '\n';
  }

  function renderPractice() {
    $('#pr-code').innerHTML = highlight(practiceText());
  }

  $('#pr-form').addEventListener('input', renderPractice);
  $('#pr-form').addEventListener('submit', (e) => e.preventDefault());
  $('#pr-copy').addEventListener('click', () => copy(practiceText()));
  $('#pr-download').addEventListener('click', () => download('practice.cfg', practiceText()));

  // ==========================================================================
  // Initial render
  // ==========================================================================
  applyXhPreset('classic');
  renderSens();
  renderAutoexec();
  renderPractice();
})();
