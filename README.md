# Vclarity 0.2.0 landing page

Production static landing page, built with semantic HTML, CSS, and plain JavaScript. No package installation or runtime dependencies are required. The existing Chrome extension source is untouched.

## Run and build

Requires Node.js 22 or newer.

```sh
npm run dev
# http://127.0.0.1:4173
npm run check
npm run build
node scripts/serve.mjs --dist
```

Deploy the contents of `dist/` to any static host. Set the real public origin for social metadata when a deployment domain is chosen; no domain or Chrome Web Store URL has been invented. The page is delivered locally in this workspace.

## Product and demos

- Public brand assets, screenshots, and the 0.2.0 developer-preview ZIP come from the existing Vclarity extension project. The download is an actual unpacked Chrome extension, not a store installation.
- Live demonstrations read computed CSS and geometry from actual elements on this page and label these values **Exact (DOM)**.
- Ghost, video, and AI workflow examples are explicitly illustrative. They make no screen-capture, microphone, camera, or AI requests. Recording timers are real browser-local demonstration timers with a 30-second cap.
- The generated example code tabs, clipboard controls, and ZIP download work locally. The ZIP contains `index.html`, `styles.css`, `script.js`, and a README.
- Real AI features require a separately running and configured Vclarity API. See `docs/preview-guide.html` for setup and consent details.
- Font: self-hosted Inter variable, licensed under OFL; the full license is included in `assets/fonts/LICENSE.txt`.

## Quality assurance

`qa/browser-checks.js` is a Playwright CLI function covering navigation, dialogs, tabs, DOM inspection, clipboard/export, recording modes and limits, motion preferences, and viewport overflow. With a preview server running and Playwright CLI installed:

```sh
playwright-cli -s=vclarity open http://127.0.0.1:4173
playwright-cli -s=vclarity run-code --filename=qa/browser-checks.js
```

See `docs/design/implementation-notes.md` for the design decisions and validation record.
"# vclarity-page" 
