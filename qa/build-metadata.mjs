import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildSite, resolveSiteUrl, renderSiteMetadata } from '../scripts/build.mjs';

assert.equal(resolveSiteUrl({}), 'https://vclarity.vercel.app/');
assert.equal(resolveSiteUrl({ VERCEL_URL: 'temporary-deployment.vercel.app' }), 'https://vclarity.vercel.app/');
assert.equal(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'production.example' }), 'https://production.example/');
assert.equal(resolveSiteUrl({ SITE_URL: ' https://Vclarity.Example/ ', VERCEL_PROJECT_PRODUCTION_URL: 'other.example' }), 'https://vclarity.example/');
assert.equal(resolveSiteUrl({ SITE_URL: 'http://localhost:4173' }), 'http://localhost:4173/');
for (const value of ['not-a-url', 'ftp://site.example', 'https://user:password@site.example', 'https://site.example/path', 'https://site.example/?key=value', 'https://site.example/#section']) {
  assert.throws(() => resolveSiteUrl({ SITE_URL: value }), /SITE_URL must be/);
}

const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.equal(renderSiteMetadata(source, null), source);
const output = renderSiteMetadata(source, 'https://vclarity.example/');
assert.match(output, /<link rel="canonical" href="https:\/\/vclarity\.example\/">/);
assert.match(output, /<meta property="og:url" content="https:\/\/vclarity\.example\/">/);
assert.match(output, /<meta property="og:image" content="https:\/\/vclarity\.example\/assets\/social-preview\.png">/);
assert.match(output, /<meta name="twitter:image" content="https:\/\/vclarity\.example\/assets\/social-preview\.png">/);
assert.match(output, /property="og:image:alt"/);
assert.match(output, /property="og:image:width" content="1200"/);
assert.equal(renderSiteMetadata(output, 'https://vclarity.example/'), output);
assert.equal(output.match(/property="og:image"/g).length, 1);
assert.equal(source, readFileSync(new URL('../index.html', import.meta.url), 'utf8'));

// Exercise the real builder in a disposable fixture, never the project's dist/.
const originalDirectory = process.cwd();
const tempRoot = realpathSync(tmpdir());
const fixture = mkdtempSync(join(tempRoot, 'vclarity-metadata-'));
try {
  for (const directory of ['docs', 'assets']) mkdirSync(join(fixture, directory));
  writeFileSync(join(fixture, 'index.html'), source);
  for (const file of ['styles.css', 'app.js', 'docs/preview-guide.html', 'assets/social-preview.png']) {
    copyFileSync(new URL(`../${file}`, import.meta.url), join(fixture, file));
  }
  process.chdir(fixture);
  buildSite({ VERCEL_PROJECT_PRODUCTION_URL: 'production.example', VERCEL_URL: 'temporary.vercel.app' });
  const deployed = readFileSync('dist/index.html', 'utf8');
  assert.match(deployed, /rel="canonical" href="https:\/\/production\.example\/"/);
  assert.match(deployed, /property="og:url" content="https:\/\/production\.example\/"/);
  assert.match(deployed, /property="og:image" content="https:\/\/production\.example\/assets\/social-preview\.png"/);
  assert.match(deployed, /name="twitter:image" content="https:\/\/production\.example\/assets\/social-preview\.png"/);
  assert(!deployed.includes('temporary.vercel.app'));

  buildSite({ SITE_URL: 'https://official.example/', VERCEL_PROJECT_PRODUCTION_URL: 'production.example' });
  const overridden = readFileSync('dist/index.html', 'utf8');
  assert.match(overridden, /rel="canonical" href="https:\/\/official\.example\/"/);
  assert.match(overridden, /property="og:image" content="https:\/\/official\.example\/assets\/social-preview\.png"/);
  assert(!overridden.includes('production.example'));

  buildSite({});
  const local = readFileSync('dist/index.html', 'utf8');
  assert.equal(local, renderSiteMetadata(source, 'https://vclarity.vercel.app/'));
  assert.match(local, /rel="canonical" href="https:\/\/vclarity\.vercel\.app\/"/);
  assert.match(local, /property="og:image" content="https:\/\/vclarity\.vercel\.app\/assets\/social-preview\.png"/);
  assert.match(local, /name="twitter:image" content="https:\/\/vclarity\.vercel\.app\/assets\/social-preview\.png"/);
  for (const file of ['styles.css', 'app.js', 'docs/preview-guide.html', 'assets/social-preview.png']) {
    assert.deepEqual(readFileSync(join('dist', file)), readFileSync(file), `Builder did not preserve ${file}`);
  }
  const outputFiles = ['index.html', 'styles.css', 'app.js', 'docs/preview-guide.html', 'assets/social-preview.png'];
  const beforeInvalid = outputFiles.map(file => readFileSync(join('dist', file)));
  assert.throws(() => buildSite({ SITE_URL: 'https://invalid.example/path' }), /SITE_URL must be/);
  outputFiles.forEach((file, index) => assert.deepEqual(readFileSync(join('dist', file)), beforeInvalid[index], `Invalid configuration changed ${file}`));
} finally {
  process.chdir(originalDirectory);
  const target = realpathSync(resolve(fixture));
  if (dirname(target) !== tempRoot || !basename(target).startsWith('vclarity-metadata-')) {
    throw new Error('Refusing to remove a metadata fixture outside the expected temporary directory.');
  }
  rmSync(target, { recursive: true, force: true });
}
console.log('Metadata checks passed: origin validation, absolute URLs, isolated real builds, output preservation, and unchanged source.');
