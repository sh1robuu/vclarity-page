import { cpSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Use a stable public origin, including on Vercel preview deployments. A generated
// VERCEL_URL can be temporary or protected, so it is deliberately not a fallback.
const DEFAULT_SITE_URL = 'https://vclarity.vercel.app/';

export function resolveSiteUrl(env = process.env) {
  const explicit = env.SITE_URL?.trim();
  const production = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!explicit && !production) return DEFAULT_SITE_URL;

  const key = explicit ? 'SITE_URL' : 'VERCEL_PROJECT_PRODUCTION_URL';
  const value = explicit || (/^https?:\/\//i.test(production) ? production : `https://${production}`);
  let url;
  try { url = new URL(value); }
  catch { throw new Error(`${key} must be a valid HTTP(S) site origin.`); }
  if (!/^https?:\/\//i.test(value) || !['http:', 'https:'].includes(url.protocol)
      || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error(`${key} must be an HTTP(S) origin without credentials, path, query, or fragment.`);
  }
  return `${url.origin}/`;
}

export function renderSiteMetadata(html, siteUrl) {
  if (!siteUrl) return html;
  const escapeAttribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const imageUrl = new URL('assets/social-preview.png', siteUrl).href;
  const upsert = (pattern, tag) => {
    html = pattern.test(html) ? html.replace(pattern, tag) : html.replace(/<\/head>/i, `  ${tag}\n</head>`);
  };
  upsert(/<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>/i,
    `<link rel="canonical" href="${escapeAttribute(siteUrl)}">`);
  for (const [attribute, key, value] of [
    ['property', 'og:url', siteUrl],
    ['property', 'og:image', imageUrl],
    ['name', 'twitter:image', imageUrl],
  ]) {
    const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}\\s*=\\s*["']${key}["'])[^>]*>`, 'i');
    upsert(pattern, `<meta ${attribute}="${key}" content="${escapeAttribute(value)}">`);
  }
  return html;
}

export function buildSite(env = process.env) {
  // Validate configuration before replacing any existing build output.
  const siteUrl = resolveSiteUrl(env);
  const html = renderSiteMetadata(readFileSync('index.html', 'utf8'), siteUrl);
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/index.html', html);
  for (const file of ['styles.css', 'app.js']) copyFileSync(file, `dist/${file}`);
  cpSync('assets', 'dist/assets', { recursive: true });
  mkdirSync('dist/docs', { recursive: true });
  copyFileSync('docs/preview-guide.html', 'dist/docs/preview-guide.html');
  console.log('Built static landing page in dist/');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) buildSite();
