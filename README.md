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

Deploy the contents of `dist/` to any static host. `vercel.json` configures Vercel to run `npm run build` and serve `dist/`.

The build generates absolute canonical, Open Graph, and social image URLs from `SITE_URL`, then Vercel's stable `VERCEL_PROJECT_PRODUCTION_URL`, with the confirmed public URL `https://vclarity.vercel.app/` as the default. Keep **Enable access to System Environment Variables** enabled in Vercel to use its production-domain value. For a preferred custom domain, set `SITE_URL` to its full HTTP(S) origin, with no path, query, or fragment, and redeploy. See [Vercel's system environment variable reference](https://vercel.com/docs/environment-variables/system-environment-variables#vercel_project_production_url).

A local build without either variable uses the confirmed public URL for canonical and social metadata. The generated `VERCEL_URL` preview hostname is deliberately not used as the canonical address. No Chrome Web Store URL has been invented.

## Product and demos

- Public brand assets, screenshots, and the 0.2.0 developer-preview ZIP come from the existing Vclarity extension project. The download is an actual unpacked Chrome extension, not a store installation.
- Live demonstrations read computed CSS and geometry from actual elements on this page and label these values **Exact (DOM)**.
- Ghost, video, and AI workflow examples are explicitly illustrative. They make no screen-capture, microphone, camera, or AI requests. Recording timers are real browser-local demonstration timers with a 30-second cap.
- The generated example code tabs, clipboard controls, and ZIP download work locally. The ZIP contains `index.html`, `styles.css`, `script.js`, and a README.
- Real AI features require a separately running and configured Vclarity API. See `docs/preview-guide.html` for setup and consent details.
- Font: self-hosted Inter variable, licensed under OFL; the full license is included in `assets/fonts/LICENSE.txt`.

## Quality assurance

`qa/browser-checks.js` is a Playwright CLI function covering navigation, dialogs, tabs, DOM inspection, clipboard/export, recording modes and limits, motion preferences, and viewport overflow. With the production preview server running (`npm run build`, then `node scripts/serve.mjs --dist`) and Playwright CLI installed:

```sh
playwright-cli -s=vclarity open http://127.0.0.1:4173
playwright-cli -s=vclarity run-code --filename=qa/browser-checks.js
playwright-cli -s=vclarity --raw run-code --filename=qa/p1-checks.js
playwright-cli -s=vclarity --raw run-code --filename=qa/p2-checks.js
node qa/build-metadata.mjs
```

The P1 suite verifies result-overlay hit targets, visible keyboard focus, mobile menu order, readable demo controls, timer contrast, accessible Start/Stop alternatives, rapid keyboard retries, and recording limits at five viewport widths. Its recorded results are in `qa/p1-results.json`.

The P2 suite checks modal scroll locking/restoration, short-screen dialog scrolling, use-case links, modifier-key navigation, metadata, and unchanged feature typography across those widths. Metadata tests also verify the actual build in an isolated temporary directory.

See `docs/design/implementation-notes.md` for the design decisions and validation record.
"# vclarity-page" 
