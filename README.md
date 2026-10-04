# FragLab — CS2 toolkit website

A landing page and set of browser-based tools for Counter-Strike 2, styled after GitLab's marketing site (dark purple hero, orange/purple gradients, mega-menu nav, lifecycle stages, pricing cards).

Plain HTML, CSS and JavaScript. No build step, no dependencies, no backend.

## Tools

| Tool | What it does |
| --- | --- |
| **Crosshair builder** | Live canvas preview on four backgrounds, presets, import from `cl_crosshair…` commands, one-click copy for the console. |
| **Sensitivity converter** | Converts between CS2, CS:GO, Valorant, Apex, Overwatch 2 and TF2 using each game's yaw, and handles a DPI change. Shows eDPI and cm/360°. |
| **Autoexec generator** | Mouse, FPS, crosshair, viewmodel, HUD, radar, audio and binds in a downloadable `autoexec.cfg`. |
| **Practice config** | A `practice.cfg` for nade practice: infinite ammo and grenades, trajectory preview, rethrow/noclip binds, no bots. |

The tools share data. "Use in autoexec" sends the converted sensitivity across, and the autoexec automatically includes the crosshair you built.

## Run locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly also works.

## Structure

```
index.html            page markup and icon sprite
assets/css/styles.css design tokens, layout, components
assets/js/main.js     nav, dropdowns, tabs, toasts, copy/download helpers
assets/js/tools.js    the four tools
assets/img/favicon.svg
```

## Deploying

It's a static site, so any static host works (GitHub Pages, GitLab Pages, Netlify, Cloudflare Pages). Serve the repository root.

## Customising

- **Name:** "FragLab" is a placeholder. Search and replace it in `index.html` and the two JS files.
- **Colors:** all colors are CSS variables at the top of `styles.css`.
- **Pricing:** the Pro and Team plans are marked "Coming soon". Edit or remove the `#pricing` section in `index.html`.

Not affiliated with or endorsed by Valve Corporation.
