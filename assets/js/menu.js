/* Revenant menu: a web port of the in-game menu (menu.*.cpp). Visual only. */
(() => {
  'use strict';

  const root = document.getElementById('rv-menu');
  if (!root) return;

  const toast = (msg) => window.FragLab?.toast?.(msg);

  // ---------- Control constructors (mirror the xui calls) ----------
  const ACC = '#e82c3a';
  const c = (label, on = false, pop = null) => ({ t: 'c', label, on, pop });
  const s = (label, min, max, val, fmt = '') => ({ t: 's', label, min, max, val, fmt });
  const d = (label, opts, val = 0, pop = null) => ({ t: 'd', label, opts, val, multi: Array.isArray(val), pop });
  const col = (label, val = ACC) => ({ t: 'col', label, val });
  const k = (label, val) => ({ t: 'k', label, val });
  const ti = (label, val = '', ph = '') => ({ t: 'ti', label, val, ph });
  const note = (text) => ({ t: 'note', text });
  const sep = () => ({ t: 'sep' });
  const card = (title, rows) => ({ title, rows });

  // ---------- Shared option lists ----------
  const MATS = [
    'Metallic', 'Matte', 'Flat', 'Bloom', 'Outlines', 'Glow', 'Glow 2', 'Flow', 'Dark Matter', 'Data',
    'Metallic (iz)', 'Matte (iz)', 'Flat (iz)', 'Bloom (iz)', 'Outlines (iz)', 'Glow (iz)', 'Glow 2 (iz)',
    'Flow (iz)', 'Dark Matter (iz)', 'Data (iz)',
  ];
  const WEAPON_GROUPS = ['Pistol', 'SMG', 'Rifle', 'Shotgun', 'Sniper', 'LMG'];
  const DISPLAY = ['Text', 'Icon', 'Text + icon'];
  const SOUNDS = ['Shop click', 'Home click', 'Bell', 'Killcard', 'Bullet casing', 'Coin pickup', 'Item drop', 'Popcan', 'Key press', 'Custom'];

  const chams = (label, on = false) =>
    c(label, on, ['Primary', 'Secondary', 'Render'].flatMap((name, i) => [
      ...(i ? [sep()] : []),
      c(name, i === 0 && on),
      d('Material', MATS, i === 0 ? 1 : 5),
      col('Color', i === 0 ? ACC : '#ffffff'),
      col('Invisible color', '#3b82f6'),
    ]));

  const bar = (full) => [
    d('Position', ['Left', 'Right', 'Top', 'Bottom']),
    c('Outline', true), c('Gradient'), c('Show value'), c('Glow'),
    col('Full color', full), col('Low color', ACC), col('Background', '#000000'),
    col('Outline color', '#000000'), col('Text color', '#ffffff'), col('Glow color', full),
    s('Glow strength', 0, 100, 50, '%'),
  ];

  // ---------- Pages ----------
  const ragePage = () => [
    [
      card('Aimbot', [
        c('Enabled', true), c('Autostop', true), c('Autostop between shots'), c('Air autostop'),
        c('Autostop on land'), c('Silent', true), c('Double tap'), c('Rapid fire'), c('Instant shot'),
        c('Fire on hit chance', false, [note('Uses current hit chance, even while moving or recovering accuracy. Skips Delay shot. Damage, line checks and duck peek still apply. No spread keeps its own firing mode.')]),
        c('Autoscope', true),
        sep(),
        c('Resolver', true), c('Force shot in air'), c('Force shot on ground'),
        c('Extrapolation', false, [s('Max ticks', 1, 16, 4)]),
        sep(),
        s('Max fov', 1, 180, 180, '°'), s('Hit chance', 0, 100, 62, '%'),
        s('Min damage', 1, 120, 32), s('Min damage (head hidden)', 1, 120, 40),
        c('Hit chance override', false, [s('Value', 0, 100, 40, '%')]),
        c('Min damage override', false, [s('Value', 1, 120, 10), c('Min damage hp+1')]),
      ]),
      card('Other', [
        d('History', ['Off', 'Last record', 'All records'], 2),
        d('Delay shot', ['Off', 'On', 'Smart'], 0, [
          s('Lookahead ticks', 1, 8, 2), s('Max hold ticks', 1, 8, 4),
          note('Hit chance holds up to 8 ticks while the autostop brakes.'),
        ]),
        d('Remove spread', ['Off', 'Compensate', 'No spread']),
      ]),
    ],
    [
      card('Targeting', [
        c('Force b-aim'), c('Dynamic point scale', true), s('Point scale', 0, 100, 70, '%'),
        d('Hitboxes', ['Head', 'Neck', 'Chest', 'Stomach', 'Pelvis', 'Arms', 'Legs'], [0, 2, 3, 4]),
        c('Adaptive hit chance', false, [s('Misses', 1, 10, 2), s('Boost per step', 0, 20, 5, '%')]),
        c('Baim if head hc low', false, [s('Threshold', 0, 100, 40, '%')]),
        c('Adaptive min damage'), c('Target priority', true), c('Safe line check'),
      ]),
      card('Anti aim', [
        c('Anti aim'),
        d('Pitch', ['None', 'Down', 'Up', 'Zero'], 1),
        d('Yaw mode', ['Backward', 'Spin', 'Jitter', 'Static']),
        s('Spin speed', 1, 100, 30), s('Jitter range', 0, 180, 45, '°'), s('Jitter speed', 1, 100, 20),
        c('Hide head'), c('Left'), c('Right'), c('Hide onshot'), c('Avoid backstab', true), c('Bhop priority'),
        c('Indicator', false, [col('Color'), c('Glow'), s('Glow strength', 0, 100, 50, '%')]),
      ]),
      card('Weapons', [
        c('Auto revolver', true),
        c('Zeusbot', false, [s('Max fov', 1, 180, 30, '°'), c('Drop after')]),
        c('Knifebot', false, [s('Max fov', 1, 180, 60, '°')]),
      ]),
      card('Peek', [
        c('Quick peek', false, [col('Base color', '#ffffff'), col('Retracting color')]),
        c('Duck peek'),
      ]),
    ],
  ];

  const legitPage = () => [
    [
      card('General', [c('Enabled', true)]),
      card('Aimbot', [
        c('Aimbot', true, [d('Enable after', ['Always', 'First shot', 'Second shot'])]),
        s('Fov', 1, 30, 4, '°'), s('Smooth', 1, 100, 25), s('Aim speed', 1, 100, 40), s('Aim speed (attack)', 1, 100, 55),
        s('Speed scale fov', 0, 100, 50, '%'), s('Reaction time', 0, 500, 120, 'ms'), s('Max lock-on', 0, 2000, 800, 'ms'),
        d('Hitboxes', ['Head', 'Neck', 'Chest', 'Stomach', 'Pelvis'], [0, 2]),
        c('Visible check', true), s('Switch target delay', 0, 1000, 200, 'ms'),
        c('Aim through smoke'), c('Aim while flashed'), c('Autoscope'), c('Silent aim'),
        c('Visualize fov', false, [col('Color', '#ffffff')]),
      ]),
    ],
    [
      card('Triggerbot', [
        c('Triggerbot'), s('Delay', 0, 300, 40, 'ms'), s('Hitchance', 0, 100, 70, '%'),
        s('Min damage', 1, 120, 20), c('Always on'), c('Autostop'),
      ]),
      card('Other', [
        c('Autowall', false, [s('Min damage', 1, 120, 30)]),
        c('No spread'),
      ]),
    ],
  ];

  const playerPage = (enemy) => [
    [
      card('ESP', [
        c('Esp overlay', true, [d('Font', ['Inter', 'Verdana', 'Tahoma', 'Pixel']), d('Font size', ['Small', 'Normal', 'Large'], 1)]),
        c('Bounding box', true, [
          d('Style', ['Full', 'Corner']), c('Fill'), c('Outline', true), s('Corner length', 1, 50, 25, '%'),
          col('Visible color', enemy ? ACC : '#3b82f6'), col('Occluded color', '#ffffff'),
        ]),
        c('Skeleton', false, [s('Thickness', 1, 4, 1, 'px'), col('Visible color', '#ffffff'), col('Occluded color', '#808088')]),
        c('Health bar', true, bar('#22c55e')),
        c('Ammo bar', false, bar('#3b82f6')),
        c('Name', true, [col('Color', '#ffffff')]),
        c('Weapon', false, [d('Display', DISPLAY, 2), col('Text color', '#ffffff'), col('Icon color', '#ffffff')]),
        c('Info flags', false, [
          d('Flags', ['Money', 'Armor', 'Kit', 'Scoped', 'Defusing', 'Flashed', 'Distance'], [0, 1, 3]),
          col('Money', '#22c55e'), col('Armor', '#ffffff'), col('Kit', '#3b82f6'), col('Scoped', '#38bdf8'),
          col('Defusing', ACC), col('Flashed', '#facc15'), col('Distance', '#ffffff'),
        ]),
        c('Off screen arrow', false, [
          c('Glow'), s('Width', 4, 40, 14, 'px'), s('Height', 4, 40, 16, 'px'), s('Radius x', 50, 500, 200, 'px'),
          s('Radius y', 50, 500, 160, 'px'), s('Glow strength', 0, 100, 50, '%'), col('Visible color'), col('Occluded color', '#ffffff'),
        ]),
      ]),
      card('Glow', [c('Glow', false, [col('Color')]), c('Ragdoll', false, [col('Color')])]),
    ],
    [
      card('Chams', [
        chams('Chams', true), sep(), chams('Ragdoll chams'),
        ...(enemy ? [sep(), chams('Backtrack chams'), chams('Onshot chams')] : []),
      ]),
    ],
  ];

  const localPage = () => [
    [
      card('Chams', [
        chams('Chams'), sep(), chams('Ragdoll chams'), sep(),
        c('Glow', false, [col('Color')]), c('Ragdoll', false, [col('Color')]),
      ]),
    ],
    [card('Viewmodel', [chams('Weapon chams'), sep(), chams('Arms chams')])],
  ];

  const worldPage = () => [
    [
      card('Items', [
        d('Group', ['Weapons', 'Grenades', 'Utility', 'Defuse kits']),
        sep(),
        c('Item esp', true, [d('Display', DISPLAY, 1), s('Max dist', 0, 100, 40, 'm'), col('Text color', '#ffffff'), col('Icon color', '#ffffff')]),
        c('Item chams', false, [d('Material', MATS), col('Color'), col('Invisible color', '#3b82f6')]),
        c('Item glow', false, [col('Color')]),
      ]),
      card('Other', [c('Bomb timer', true), c('Spectator list', true)]),
    ],
    [
      card('Projectiles', [
        d('Group', ['Grenades', 'Molotov', 'Smoke', 'Flashbang', 'Decoy']),
        sep(),
        c('Projectile esp', true, [d('Display', DISPLAY, 2), s('Max dist', 0, 100, 60, 'm'), col('Text color', '#ffffff'), col('Icon color', '#ffffff')]),
        c('Inferno esp', false, [col('Fill color', '#f97316'), col('Outline color'), s('Outline thickness', 1, 4, 1, 'px'), c('Glow'), s('Glow strength', 0, 100, 50, '%')]),
        c('Landing indicator', true, [
          col('Arc color'), col('Icon color', '#ffffff'), col('Background', '#000000'), c('Glow'),
          s('Glow strength', 0, 100, 50, '%'), c('Damage text', true), col('Damage text color', '#ffffff'),
        ]),
      ]),
    ],
  ];

  const scenePage = () => [
    [
      card('Scene', [
        c('Skybox material', false, [d('Material', ['Default', 'Night', 'Cloudy', 'Vertigo', 'Space'])]),
        c('Skybox color', false, [col('Sky color', '#1e1b4b'), col('Cloud color', '#ffffff'), col('Sun color', '#fde68a')]),
        c('World color', false, [col('Color', '#9ca3af')]),
        c('Lighting', false, [s('Intensity', 0, 200, 100, '%'), col('Color', '#ffffff')]),
        c('Bloom', false, [s('Value', 0, 100, 30, '%')]),
        c('Gamma', false, [s('Value', 50, 200, 100, '%')]),
        sep(),
        c('Weather', false, [d('Type', ['Rain', 'Snow', 'Ash']), s('Intensity', 0, 100, 50, '%'), col('Color', '#ffffff')]),
        c('Fog', false, [s('Density', 0, 100, 30, '%'), s('Anisotropy', 0, 100, 50, '%'), s('Draw distance', 100, 5000, 2000), col('Color', '#808088')]),
        c('Rain', false, [s('Density', 0, 100, 50, '%'), s('Speed', 0, 100, 50, '%')]),
        c('Wind', false, [s('Strength', 0, 100, 30, '%'), s('Direction', 0, 360, 90, '°'), s('Turbulence', 0, 100, 20, '%')]),
      ]),
    ],
    [
      card('Effects', [
        c('Depth of field', false, [s('Near blurry', 0, 500, 0), s('Near crisp', 0, 500, 50), s('Far crisp', 0, 5000, 800), s('Far blurry', 0, 5000, 2000)]),
      ]),
    ],
  ];

  const miscGeneral = () => [
    [
      card('Impacts', [
        c('Hit sound', true, [d('Type', SOUNDS, 2), s('Volume', 1, 100, 60, '%')]),
        c('Hit marker', false, [d('Type', ['Classic', 'Damage', 'Both']), s('Duration', 1, 10, 2, 's'), col('Color', '#ffffff')]),
        c('Hit effect', false, [col('Color'), s('Duration', 1, 10, 1, 's'), s('Strength', 0, 100, 50, '%')]),
        c('Death sound', false, [d('Type', SOUNDS, 3), s('Volume', 1, 100, 60, '%')]),
        c('Death effect', false, [d('Type', ['Fade', 'Stars']), col('Color')]),
        c('Reveal score board weapons', false, [col('Color', '#ffffff')]),
        c('Bullet impacts', false, [
          d('Type', ['Overlay', 'Sparks', 'Both']), s('Duration', 1, 10, 4, 's'), col('Fill', '#3b82f6'), col('Edge', '#ffffff'),
          c('Glow'), s('Glow strength', 0, 100, 50, '%'), col('Spark', '#f59e0b'),
        ]),
        c('Bullet tracers', false, [s('Duration', 1, 10, 2, 's'), col('Color'), s('Thickness', 1, 5, 2, 'px')]),
        c('Event log', true),
        c('Console logs'),
        c('Chat logs', false, [c('Votekick'), c('Hit logs', true), c('Miss logs', true)]),
      ]),
      card('Visuals', [
        c('Projectile trajectory', true, [
          c('Straight throw'), col('Held color'), col('Thrown color', '#ffffff'),
          col('Will damage held color', '#f59e0b'), col('Will damage thrown color', '#f59e0b'),
        ]),
        c('Penetration crosshair', false, [
          c('Glow'), s('Glow strength', 0, 100, 50, '%'), col('Can penetrate', '#22c55e'),
          col('Can pen outline', '#000000'), col('Blocked'), col('Blocked outline', '#000000'),
        ]),
        c('Auto buy', false, [
          d('Primary', ['None', 'Rifle', 'Scoped rifle', 'Scout', 'Awp', 'Auto sniper']),
          d('Secondary', ['None', 'Dual elites', 'Five-seven/tec-9', 'Deagle', 'Revolver']),
          c('Armor', true), c('Defuser', true), c('Taser'),
          d('Grenades', ['Molotov', 'He grenade', 'Smoke', 'Flashbang', 'Decoy'], [0, 1, 2]),
        ]),
      ]),
    ],
    [
      card('Movement', [
        c('Bhop'), c('Airstrafe', false, [c('Directional')]), c('Subtick strafer'), c('Jumpbug'),
        c('Fastladder'), c('Edgejump'), c('Edgestop'),
        c('Edgebug', false, [d('Mode', ['Fast', 'Accurate']), s('Passes', 1, 10, 4), c('Jump steps')]),
        c('Slowwalk', false, [s('Speed', 1, 100, 35, '%')]),
        sep(),
        c('Quickswitch'), c('Quick plant'), c('No land inaccuracy'),
      ]),
      card('Other', [
        c('Preserve killfeed'), c('Auto accept', true), c('Anti afk'),
        sep(),
        c('Clantag', false, [s('Step time', 1, 10, 3, 's')]),
        c('Name Changer', false, [ti('Name', '', 'name')]),
      ]),
    ],
  ];

  const miscView = () => [
    [
      card('Camera', [
        c('Custom fov', false, [s('Fov', 60, 130, 90, '°'), c('Scoped fov override'), s('Scoped fov', 10, 90, 40, '°')]),
        c('Thirdperson', false, [s('Distance', 50, 300, 120), s('Hull size', 0, 32, 16), c('Close on grenade', true)]),
        c('Aspect ratio', false, [s('Ratio', 50, 200, 133, '%')]),
      ]),
      card('HUD', [
        c('Crosshair overlay', false, [s('Size', 1, 20, 4, 'px'), s('Outline', 0, 4, 1, 'px'), col('Color', '#ffffff'), col('Outline color', '#000000')]),
        c('Scope overlay', false, [
          s('Line length', 10, 500, 200, 'px'), s('Gap', 0, 50, 6, 'px'), s('Thickness', 1, 5, 1, 'px'), s('Anim speed', 1, 20, 8),
          col('Color', '#ffffff'), c('Fade in', true), sep(), c('Glow'), s('Glow strength', 0, 100, 50, '%'),
        ]),
        c('Sniper crosshair'),
      ]),
    ],
    [
      card('Viewmodel', [
        c('Viewmodel fov', false, [s('Fov', 40, 120, 68, '°')]),
        c('Viewmodel position', false, [s('Offset x', -10, 10, 2), s('Offset y', -10, 10, 0), s('Offset z', -10, 10, -2)]),
        c('No hand movement'),
      ]),
      card('Removals', [
        c('Removals', true, [
          c('Remove crosshair'), c('Remove scope', true), c('Remove zoom'), c('Remove overhead'), c('Remove legs'),
          c('Remove recoil'), c('Remove skybox fog'), c('Remove 3d skybox'), c('Remove decals'), c('Remove smoke', true), c('Remove flash', true),
        ]),
      ]),
    ],
  ];

  const menuSettings = () => [
    [
      card('Menu', [
        c('Safe mode', false, [note('Disables ragebot, anti-aim, and other risky features.')]),
        sep(),
        k('Menu key', 'INSERT'),
        s('Menu dpi scale', 50, 200, 100, '%'),
        d('Menu font', ['Inter', 'Verdana', 'Tahoma']),
        d('4:3 stretched', ['Auto', 'On', 'Off'], 0, [note('Auto squeezes the menu back into shape when the game runs stretched 4:3 on a wider monitor.')]),
      ]),
    ],
  ];

  // ---------- Inventory (menu.skins.cpp) ----------
  const ITEMS = {
    Skins: [
      'AK-47', 'M4A4', 'M4A1-S', 'AWP', 'Desert Eagle', 'Glock-18', 'USP-S', 'P2000', 'P250', 'Five-SeveN', 'Tec-9',
      'CZ75-Auto', 'R8 Revolver', 'Dual Berettas', 'FAMAS', 'Galil AR', 'SG 553', 'AUG', 'SSG 08', 'SCAR-20', 'G3SG1',
      'MP9', 'MAC-10', 'MP7', 'MP5-SD', 'UMP-45', 'P90', 'PP-Bizon', 'Nova', 'XM1014', 'MAG-7', 'Sawed-Off', 'M249', 'Negev',
    ],
    Knife: [
      'Bayonet', 'Karambit', 'M9 Bayonet', 'Butterfly Knife', 'Flip Knife', 'Gut Knife', 'Huntsman Knife', 'Falchion Knife',
      'Bowie Knife', 'Shadow Daggers', 'Ursus Knife', 'Navaja Knife', 'Stiletto Knife', 'Talon Knife', 'Classic Knife',
      'Paracord Knife', 'Survival Knife', 'Nomad Knife', 'Skeleton Knife', 'Kukri Knife',
    ],
    Glove: ['Sport Gloves', 'Driver Gloves', 'Hand Wraps', 'Moto Gloves', 'Specialist Gloves', 'Hydra Gloves', 'Broken Fang Gloves', 'Bloodhound Gloves'],
    Agent: [
      'Sir Bloody Darryl', 'Number K', 'Special Agent Ava', 'Cmdr. Mae Jamison', "'Two Times' McCoy", 'Lt. Commander Ricksaw',
      'Sally', 'Rezan the Redshirt', 'The Elite Mr. Muhlik', 'Vypa Sista', "'Medium Rare' Crasswater", 'Chef d\'Escadron Rouchard',
    ],
  };
  const PAINTS = {
    Skins: ['Default', 'Asiimov', 'Redline', 'Vulcan', 'Neo-Noir', 'Printstream', 'Hyper Beast', 'Bloodsport', 'Fire Serpent', 'Case Hardened', 'Slaughter', 'Crimson Web', 'Fade', 'Night', 'Safari Mesh'],
    Knife: ['Vanilla', 'Fade', 'Doppler', 'Gamma Doppler', 'Marble Fade', 'Tiger Tooth', 'Slaughter', 'Crimson Web', 'Case Hardened', 'Lore', 'Autotronic', 'Damascus Steel', 'Night', 'Ultraviolet'],
    Glove: ['Default', 'Vice', "Pandora's Box", 'Crimson Kimono', 'Fade', 'Slaughter', 'Emerald Web', 'Superconductor', 'Hedge Maze', 'Amphibious'],
  };
  const RARITY = ['#b0c3d9', '#5e98d9', '#4b69ff', '#8847ff', '#d32ce6', '#eb4b4b', '#e4ae39'];
  const STICKERS = ['None', 'Crown (Foil)', 'Howling Dawn', 'Headhunter (Foil)', 'Flammable (Foil)', 'Bish (Holo)', 'Bash (Holo)', 'Bosh (Holo)'];
  const KEYCHAINS = ['None', "Lil' Squirt", 'Hot Howl', 'Baby Karat', "Lil' Whiskers", 'Die-cast AK'];

  function customize(kind) {
    if (kind === 'Agent') return [d('Custom Model', ['None', 'Custom model 1', 'Custom model 2'])];
    const base = [d('Paint kit', PAINTS[kind]), s('Wear', 0, 100, 1, '%')];
    if (kind === 'Glove') return base;
    base.push(c('Custom paint color', false, [col('Color')]));
    if (kind === 'Knife') return base;
    return [
      ...base,
      sep(),
      d('Slot', ['Slot 1', 'Slot 2', 'Slot 3', 'Slot 4', 'Slot 5']),
      d('Sticker', STICKERS), s('Wear', 0, 100, 0, '%'), s('Scale', 50, 200, 100, '%'), s('Rotation', 0, 360, 0, '°'),
      s('Offset X', -100, 100, 0), s('Offset Y', -100, 100, 0),
      sep(),
      d('Keychain', KEYCHAINS), s('Offset X', -100, 100, 0), s('Offset Y', -100, 100, 0), s('Offset Z', -100, 100, 0),
    ];
  }

  function inventoryPage(kind) {
    const items = ITEMS[kind];
    const st = { sel: 0, q: '', mods: {}, equipped: new Set() };
    const mods = (name) => (st.mods[name] ||= customize(kind));

    return {
      render(rerender) {
        const search = h('input', {
          class: 'rv-input', type: 'text', placeholder: `search ${{ Skins: 'weapons', Knife: 'knives', Glove: 'gloves', Agent: 'agents' }[kind]}...`,
          'aria-label': `Search ${kind}`, autocomplete: 'off', spellcheck: 'false',
        });
        search.value = st.q;
        const grid = h('div', { class: 'rv-grid' });

        const tile = (name, i) => {
          const m = mods(name);
          const paint = m[0].label === 'Paint kit' ? m[0] : null;
          const sub = paint ? paint.opts[paint.val] : kind === 'Agent' ? m[0].opts[m[0].val] : '';
          const cls = 'rv-tile' + (i === st.sel ? ' is-sel' : '') + (st.equipped.has(name) ? ' is-equipped' : '');
          const el = h('button', { class: cls, type: 'button', 'aria-pressed': String(i === st.sel), onclick: () => { st.sel = i; rerender(); } },
            h('span', { class: 'rv-tile-name' }, name),
            h('span', { class: 'rv-tile-sub' }, sub));
          if (paint && paint.val > 0) el.style.setProperty('--r', RARITY[paint.val % RARITY.length]);
          return el;
        };
        const paintGrid = () => {
          const q = st.q.trim().toLowerCase();
          const shown = items.map((n, i) => [n, i]).filter(([n]) => n.toLowerCase().includes(q));
          grid.replaceChildren(...(shown.length ? shown.map(([n, i]) => tile(n, i)) : [h('div', { class: 'rv-empty' }, 'Nothing found.')]));
        };
        search.addEventListener('input', () => { st.q = search.value; paintGrid(); });
        paintGrid();

        const name = items[st.sel];
        const m = mods(name);
        m[0].onchange = paintGrid;
        const on = st.equipped.has(name);
        const equip = h('button', {
          class: 'rv-btn' + (on ? '' : ' is-accent'), type: 'button',
          onclick: () => {
            if (on) st.equipped.delete(name);
            else st.equipped.add(name);
            toast(`${on ? 'Unequipped' : 'Equipped'} ${name}`);
            rerender();
          },
        }, on ? 'Unequip' : 'Equip');

        return [
          [cardEl(kind, [search, grid])],
          [cardEl(name, [...m.map(renderCtl), h('div', { class: 'rv-btns' }, equip)])],
        ];
      },
    };
  }

  // ---------- Configs (menu.config.cpp) ----------
  function configsPage() {
    const st = { list: ['default', 'legit', 'rage', 'hvh'], sel: -1, name: '', confirm: false, timer: 0 };
    return {
      single: true,
      render(rerender) {
        const nameIn = h('input', { class: 'rv-input', type: 'text', placeholder: 'config name', maxlength: '32', 'aria-label': 'Config name', autocomplete: 'off', spellcheck: 'false' });
        nameIn.value = st.name;
        nameIn.addEventListener('input', () => { st.name = nameIn.value; });

        const sel = st.list[st.sel];
        const list = h('div', { class: 'rv-cfg-list', role: 'listbox', 'aria-label': 'Configs' },
          st.list.length
            ? st.list.map((n, i) => h('button', {
              class: 'rv-cfg' + (i === st.sel ? ' is-sel' : ''), type: 'button', role: 'option', 'aria-selected': String(i === st.sel),
              onclick: () => { st.sel = i === st.sel ? -1 : i; st.confirm = false; rerender(); },
            }, h('span', {}, n), h('span', { class: 'rv-cfg-meta' }, `C:\\revenant\\${n}.json`)))
            : h('div', { class: 'rv-empty' }, 'No configs yet.'));

        const btn = (label, fn, { accent = false, disabled = false } = {}) =>
          h('button', { class: 'rv-btn' + (accent ? ' is-accent' : ''), type: 'button', disabled, onclick: fn }, label);

        const create = () => {
          const n = st.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
          if (!n) return toast('Enter a config name');
          if (st.list.includes(n)) return toast(`${n} already exists`);
          st.list.push(n);
          st.sel = st.list.length - 1;
          st.name = '';
          toast(`Created ${n}`);
          rerender();
        };
        const del = () => {
          st.confirm = true;
          rerender();
          clearTimeout(st.timer);
          st.timer = setTimeout(() => { if (st.confirm) { st.confirm = false; rerender(); } }, 3000);
        };
        const confirm = () => {
          st.list.splice(st.sel, 1);
          toast(`Deleted ${sel}`);
          st.sel = -1;
          st.confirm = false;
          rerender();
        };

        const actions = h('div', { class: 'rv-btns' },
          btn('Refresh', () => toast('Config list refreshed')),
          btn('Load', () => toast(`Loaded ${sel}`), { disabled: !sel }),
          btn('Create', create),
          btn('Save', () => toast(`Saved ${sel}`), { disabled: !sel }),
          st.confirm ? btn('Confirm', confirm, { accent: true }) : btn('Delete', del, { disabled: !sel }));

        return [[cardEl('Configs', [nameIn, list, actions])]];
      },
    };
  }

  // ---------- Tabs ----------
  const TABS = [
    { label: 'Ragebot', scope: 'PER WEAPON GROUP', pages: WEAPON_GROUPS.map((name) => ({ name, cols: ragePage() })) },
    { label: 'Legitbot', scope: 'PER WEAPON GROUP', pages: WEAPON_GROUPS.map((name) => ({ name, cols: legitPage() })) },
    { label: 'Visuals', pages: [{ name: 'Enemy', cols: playerPage(true) }, { name: 'Team', cols: playerPage(false) }, { name: 'Local', cols: localPage() }] },
    { label: 'World', pages: [{ name: 'World', cols: worldPage() }, { name: 'Scene', cols: scenePage() }] },
    { label: 'Inventory', pages: ['Skins', 'Knife', 'Glove', 'Agent'].map((name) => ({ name, custom: inventoryPage(name) })) },
    { label: 'Misc', pages: [{ name: 'General', cols: miscGeneral() }, { name: 'View', cols: miscView() }] },
    { label: 'Settings', pages: [{ name: 'Configs', custom: configsPage() }, { name: 'Menu', cols: menuSettings() }] },
  ];

  // Search index: every top-level row, once per page (weapon groups share a layout).
  let uid = 0;
  const INDEX = [];
  TABS.forEach((tab, ti_) => tab.pages.forEach((pg, pi) => pg.cols?.forEach((cards) => cards.forEach((cd) => cd.rows.forEach((row) => {
    if (!row.label) return;
    row.id = ++uid;
    if (tab.scope && pi > 0) return;
    INDEX.push({ label: row.label, path: `${tab.label} › ${pg.name} › ${cd.title}`, tab: ti_, page: pi, id: row.id });
  })))));

  // ---------- DOM helpers ----------
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [key, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (key === 'class') el.className = v;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), v);
      else el.setAttribute(key, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }

  const SVG = {
    search: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4 14 14"/></svg>',
    theme: '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor"/></svg>',
    close: '<svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M1.5 1.5l7 7M1.5 8.5l7-7"/></svg>',
    chev: '<svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 3l2.5 2.5L6.5 3"/></svg>',
  };
  const icon = (name, cls = 'rv-ico') => {
    const span = h('span', { class: cls, 'aria-hidden': 'true' });
    span.innerHTML = SVG[name];
    return span;
  };

  // ---------- Floating layers (popups, combo lists) ----------
  const layers = [];

  function closeFrom(level) {
    while (layers.length > level) {
      const l = layers.pop();
      l.el.remove();
      l.anchor.classList.remove('is-open');
      l.anchor.setAttribute('aria-expanded', 'false');
    }
  }

  function openLayer(anchor, content, { align = 'right', minWidth = 0 } = {}) {
    const level = layers.findIndex((l) => l.el.contains(anchor)) + 1;
    if (layers[level]?.anchor === anchor) return closeFrom(level);
    closeFrom(level);

    const el = h('div', { class: 'rv-layer' }, content);
    if (minWidth) el.style.minWidth = `${minWidth}px`;
    root.append(el);

    const r = root.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    let left = align === 'left' ? a.left - r.left : a.right - r.left - el.offsetWidth;
    left = Math.max(4, Math.min(left, r.width - el.offsetWidth - 4));
    let top = a.bottom - r.top + 4;
    if (a.bottom + 4 + el.offsetHeight > window.innerHeight && a.top - el.offsetHeight - 4 > 0) {
      top = a.top - r.top - el.offsetHeight - 4;
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;

    anchor.classList.add('is-open');
    anchor.setAttribute('aria-expanded', 'true');
    layers.push({ el, anchor });
  }

  document.addEventListener('pointerdown', (e) => {
    if (!layers.length) return;
    let keep = -1;
    layers.forEach((l, i) => {
      if (l.el.contains(e.target) || l.anchor.contains(e.target)) keep = i;
    });
    closeFrom(keep + 1);
  });
  window.addEventListener('resize', () => { closeFrom(0); placeUnderline(); });

  // ---------- Controls ----------
  function dotsBtn(ctl) {
    const b = h('button', { class: 'rv-dots', type: 'button', 'aria-label': `${ctl.label} settings`, 'aria-haspopup': 'true', 'aria-expanded': 'false' },
      h('i'), h('i'), h('i'));
    b.addEventListener('click', () => openLayer(b, h('div', { class: 'rv-pop' }, ctl.pop.map(renderCtl))));
    return b;
  }

  const label = (text) => h('span', { class: 'rv-label' }, text);

  function toggleRow(ctl) {
    const sw = h('button', { class: 'rv-switch', type: 'button', role: 'switch', 'aria-checked': String(ctl.on), 'aria-label': ctl.label });
    const lab = label(ctl.label);
    const row = h('div', { class: 'rv-row rv-toggle' + (ctl.on ? ' is-on' : '') }, lab, ctl.pop && dotsBtn(ctl), sw);
    const flip = () => {
      ctl.on = !ctl.on;
      sw.setAttribute('aria-checked', String(ctl.on));
      row.classList.toggle('is-on', ctl.on);
    };
    sw.addEventListener('click', flip);
    lab.addEventListener('click', flip);
    return row;
  }

  function sliderRow(ctl) {
    const val = h('span', { class: 'rv-val' });
    const input = h('input', { class: 'rv-range', type: 'range', min: ctl.min, max: ctl.max, step: 1, 'aria-label': ctl.label });
    input.value = ctl.val;
    const sync = () => {
      ctl.val = Number(input.value);
      val.textContent = `${ctl.val}${ctl.fmt}`;
      input.style.setProperty('--p', `${((ctl.val - ctl.min) / (ctl.max - ctl.min)) * 100}%`);
    };
    input.addEventListener('input', sync);
    sync();
    return h('div', { class: 'rv-row rv-slide' }, h('div', { class: 'rv-slide-top' }, label(ctl.label), val), input);
  }

  function comboRow(ctl) {
    const btn = h('button', { class: 'rv-combo', type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': ctl.label });
    const text = () => (ctl.multi ? (ctl.val.length ? ctl.val.map((i) => ctl.opts[i]).join(', ') : 'None') : ctl.opts[ctl.val]);
    const paint = () => btn.replaceChildren(h('span', { class: 'rv-combo-text' }, text()), icon('chev', 'rv-chev'));
    paint();

    btn.addEventListener('click', () => {
      const list = h('div', { class: 'rv-list' + (ctl.multi ? ' is-multi' : ''), role: 'listbox', 'aria-multiselectable': ctl.multi ? 'true' : null });
      ctl.opts.forEach((opt, i) => {
        const isSel = () => (ctl.multi ? ctl.val.includes(i) : ctl.val === i);
        const item = h('button', { class: 'rv-opt' + (isSel() ? ' is-sel' : ''), type: 'button', role: 'option', 'aria-selected': String(isSel()) }, opt);
        item.addEventListener('click', () => {
          if (ctl.multi) {
            ctl.val = isSel() ? ctl.val.filter((x) => x !== i) : [...ctl.val, i].sort((a, b) => a - b);
            item.classList.toggle('is-sel', isSel());
            item.setAttribute('aria-selected', String(isSel()));
          } else {
            ctl.val = i;
            closeFrom(layers.findIndex((l) => l.el.contains(list)));
          }
          paint();
          ctl.onchange?.();
        });
        list.append(item);
      });
      openLayer(btn, list, { align: 'left', minWidth: btn.offsetWidth });
    });

    return h('div', { class: 'rv-row rv-field' }, label(ctl.label), ctl.pop && dotsBtn(ctl), btn);
  }

  function colorRow(ctl) {
    const input = h('input', { class: 'rv-swatch', type: 'color', 'aria-label': ctl.label });
    input.value = ctl.val;
    input.addEventListener('input', () => { ctl.val = input.value; });
    return h('div', { class: 'rv-row rv-field' }, label(ctl.label), input);
  }

  function keyRow(ctl) {
    const b = h('button', { class: 'rv-key', type: 'button', 'aria-label': `${ctl.label}: ${ctl.val}` }, ctl.val);
    let listening = false;
    const stop = (v) => {
      listening = false;
      ctl.val = v;
      b.textContent = v;
      b.classList.remove('is-listening');
      b.setAttribute('aria-label', `${ctl.label}: ${v}`);
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') return stop(ctl.val);
      stop(e.key === ' ' ? 'SPACE' : e.key.length === 1 ? e.key.toUpperCase() : e.key.toUpperCase().replace('ARROW', ''));
    };
    b.addEventListener('click', () => {
      if (listening) return stop(ctl.val);
      listening = true;
      b.classList.add('is-listening');
      b.textContent = '...';
      document.addEventListener('keydown', onKey, true);
    });
    b.addEventListener('blur', () => { if (listening) stop(ctl.val); });
    return h('div', { class: 'rv-row rv-field' }, label(ctl.label), b);
  }

  function textRow(ctl) {
    const input = h('input', { class: 'rv-input', type: 'text', placeholder: ctl.ph, 'aria-label': ctl.label, maxlength: '32', autocomplete: 'off', spellcheck: 'false' });
    input.value = ctl.val;
    input.addEventListener('input', () => { ctl.val = input.value; });
    return h('div', { class: 'rv-row rv-field' }, label(ctl.label), input);
  }

  function renderCtl(ctl) {
    let el;
    switch (ctl.t) {
      case 'c': el = toggleRow(ctl); break;
      case 's': el = sliderRow(ctl); break;
      case 'd': el = comboRow(ctl); break;
      case 'col': el = colorRow(ctl); break;
      case 'k': el = keyRow(ctl); break;
      case 'ti': el = textRow(ctl); break;
      case 'note': return h('p', { class: 'rv-note' }, ctl.text);
      default: return h('div', { class: 'rv-sep', role: 'separator' });
    }
    if (ctl.id) el.dataset.rid = ctl.id;
    return el;
  }

  const cardEl = (title, children) =>
    h('section', { class: 'rv-card' }, h('header', { class: 'rv-card-head' }, title), h('div', { class: 'rv-card-body' }, children));
  const renderCard = (cd) => cardEl(cd.title, cd.rows.map(renderCtl));

  // ---------- Shell ----------
  let tab = 5;
  let page = 0;
  let searchOpen = false;
  let query = '';

  const tabsNav = h('div', { class: 'rv-tabs', role: 'tablist', 'aria-label': 'Menu tabs' });
  const underline = h('span', { class: 'rv-underline', 'aria-hidden': 'true' });
  const tabBtns = TABS.map((t, i) => h('button', { class: 'rv-tab', type: 'button', role: 'tab', onclick: () => go(i, 0) }, t.label));
  tabsNav.append(...tabBtns, underline);

  const searchBtn = h('button', { class: 'rv-icon-btn', type: 'button', 'aria-label': 'Search settings', onclick: () => (searchOpen ? closeSearch() : openSearch()) }, icon('search'));
  const themeBtn = h('button', { class: 'rv-icon-btn', type: 'button', 'aria-label': 'Theme', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' }, icon('theme'));
  themeBtn.addEventListener('click', () => {
    const light = root.dataset.rvTheme === 'light';
    const list = h('div', { class: 'rv-list', role: 'listbox', 'aria-label': 'Theme' },
      ['Red', 'White'].map((name, i) => h('button', {
        class: 'rv-opt' + ((i === 1) === light ? ' is-sel' : ''), type: 'button', role: 'option', 'aria-selected': String((i === 1) === light),
        onclick: () => { root.dataset.rvTheme = i ? 'light' : 'dark'; closeFrom(0); },
      }, name)));
    openLayer(themeBtn, list, { minWidth: 110 });
  });

  const head = h('div', { class: 'rv-head' },
    h('div', { class: 'rv-mark' }, h('span', { class: 'rv-diamond', 'aria-hidden': 'true' }), h('span', { class: 'rv-mark-text' }, 'REVENANT')),
    tabsNav,
    h('div', { class: 'rv-tools' }, searchBtn, themeBtn));

  const chipsRow = h('div', { class: 'rv-chips' });
  const body = h('div', { class: 'rv-body' });
  body.addEventListener('scroll', () => closeFrom(0), { passive: true });

  const searchInput = h('input', { class: 'rv-search-input', type: 'text', placeholder: 'search settings...', 'aria-label': 'Search settings', autocomplete: 'off', spellcheck: 'false' });
  searchInput.addEventListener('input', () => { query = searchInput.value; renderBody(false); });
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') body.querySelector('.rv-result')?.click(); });
  const searchField = h('div', { class: 'rv-search' }, icon('search'), searchInput,
    h('button', { class: 'rv-search-close', type: 'button', 'aria-label': 'Close search', onclick: () => closeSearch() }, icon('close')));

  root.replaceChildren(head, h('div', { class: 'rv-content' }, chipsRow, body));
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Revenant menu');
  root.dataset.rvTheme = 'dark';

  function placeUnderline() {
    const b = tabBtns[tab];
    underline.style.left = `${b.offsetLeft + 11}px`;
    underline.style.width = `${b.offsetWidth - 22}px`;
  }

  function renderChips() {
    if (searchOpen) return chipsRow.replaceChildren(searchField);
    const t = TABS[tab];
    chipsRow.replaceChildren(
      h('div', { class: 'rv-chip-list', role: 'tablist', 'aria-label': `${t.label} pages` },
        t.pages.map((p, i) => h('button', {
          class: 'rv-chip' + (i === page ? ' is-active' : ''), type: 'button', role: 'tab', 'aria-selected': String(i === page),
          onclick: () => { if (i !== page) { page = i; render(true); } },
        }, p.name))),
      t.scope ? h('span', { class: 'rv-scope' }, t.scope) : '');
  }

  function searchResults() {
    const q = query.trim().toLowerCase();
    if (!q) return h('div', { class: 'rv-empty' }, 'Type to search every setting.');
    const hits = INDEX.filter((e) => e.label.toLowerCase().includes(q)).slice(0, 60);
    if (!hits.length) return h('div', { class: 'rv-empty' }, `No settings match "${query.trim()}".`);
    return h('div', { class: 'rv-results' }, hits.map((e) => h('button', { class: 'rv-result', type: 'button', onclick: () => jump(e) },
      h('span', { class: 'rv-result-label' }, e.label), h('span', { class: 'rv-result-path' }, e.path))));
  }

  function renderBody(animate) {
    closeFrom(0);
    const keep = animate ? 0 : body.scrollTop;
    let content;
    if (searchOpen) {
      content = searchResults();
    } else {
      const pg = TABS[tab].pages[page];
      const rerender = () => { if (!searchOpen && TABS[tab].pages[page] === pg) renderBody(false); };
      const cols = pg.custom ? pg.custom.render(rerender) : pg.cols.map((cards) => cards.map(renderCard));
      content = h('div', { class: 'rv-cols' + (pg.custom?.single ? ' is-single' : '') }, cols.map((cs) => h('div', { class: 'rv-col' }, cs)));
    }
    if (animate) content.classList.add('is-entering');
    body.replaceChildren(content);
    body.scrollTop = keep;
  }

  function render(animate) {
    tabBtns.forEach((b, i) => {
      b.classList.toggle('is-active', i === tab && !searchOpen);
      b.setAttribute('aria-selected', String(i === tab));
    });
    underline.classList.toggle('is-hidden', searchOpen);
    placeUnderline();
    renderChips();
    renderBody(animate);
  }

  function go(i, p) {
    searchOpen = false;
    searchBtn.classList.remove('is-on');
    if (i === tab && p === page) return render(false);
    tab = i;
    page = p;
    render(true);
  }

  function openSearch() {
    searchOpen = true;
    query = '';
    searchInput.value = '';
    searchBtn.classList.add('is-on');
    render(true);
    searchInput.focus({ preventScroll: true });
  }

  function closeSearch() {
    if (!searchOpen) return;
    searchOpen = false;
    searchBtn.classList.remove('is-on');
    render(true);
  }

  function jump(e) {
    searchOpen = false;
    searchBtn.classList.remove('is-on');
    tab = e.tab;
    page = e.page;
    render(false);
    const row = body.querySelector(`[data-rid="${e.id}"]`);
    if (!row) return;
    const rb = row.getBoundingClientRect();
    const bb = body.getBoundingClientRect();
    body.scrollTop += rb.top - bb.top - bb.height / 2 + rb.height / 2;
    row.classList.add('is-flash');
    row.addEventListener('animationend', () => row.classList.remove('is-flash'), { once: true });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (layers.length) return closeFrom(layers.length - 1);
    if (searchOpen && root.contains(document.activeElement)) closeSearch();
  });

  render(false);
  document.fonts?.ready.then(placeUnderline);
})();
