# FragLab — CS2 utility website

A dark, gaming-style landing page for FragLab, a CS2 desktop utility (bhop helper, crosshair editor, config profiles). It also includes four free tools that run in the browser.

Plain HTML, CSS and JavaScript. No build step, no dependencies, no backend.

## What's on the page

- **Hero:** animated particle background, glowing title, download buttons.
- **Interactive app preview:** an HTML mock of the app window. The tabs switch, the toggles flip, the activation-key box captures your next key press, and the speed overlay animates. The accent swatches in Settings recolor the whole site, and the choice is remembered.
- **Features grid:** cards with a spotlight that follows the cursor.
- **Free web tools:** crosshair builder, sensitivity converter, autoexec.cfg generator and practice.cfg generator.
- **Install steps, FAQ, download section and footer.**

## Set your links

Open `assets/js/main.js` and fill in the `SITE` object at the top:

```js
const SITE = {
  downloadUrl: 'https://github.com/you/fraglab/releases/latest',
  discordUrl: 'https://discord.gg/your-invite',
};
```

Every Download and Discord button on the page uses these. While they're empty, the buttons show a "coming soon" message instead of going nowhere.

## Things to check before going live

The copy is a starting point. Make sure it matches your app:

- Version number ("Version 1.0 is out", "v1.0", "Download v1.0")
- Supported systems ("Windows 10 / 11 · 64-bit")
- "Lightweight", "Regular updates", "single small file", "no installer"
- Feature list (Bhop helper, Crosshair editor, Config profiles, Speed overlay, Custom hotkeys, Light on resources)
- The FAQ answers

## Run locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Structure

```
index.html            page markup and icon sprite
assets/css/styles.css design tokens, layout, components (accent colors are CSS variables)
assets/js/main.js     site links, nav, particles, app preview, tabs, toasts
assets/js/tools.js    the four web tools
assets/img/favicon.svg
```

## Deploying

It's a static site, so any static host works (GitHub Pages, GitLab Pages, Netlify, Cloudflare Pages). Serve the repository root.

## Renaming

"FragLab" is a placeholder name. Search and replace it in `index.html` and the two JS files.

Not affiliated with or endorsed by Valve Corporation.
