async page => {
  const origin = /^https?:/.test(page.url()) ? new URL(page.url()).origin : 'http://127.0.0.1:4173';
  const results = [];
  const errors = { console: [], page: [], requests: [] };
  const onConsole = message => { if (message.type() === 'error') errors.console.push(message.text()); };
  const onPageError = error => errors.page.push(String(error));
  const onRequestFailed = request => errors.requests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const run = async (name, test) => {
    try {
      const details = await test();
      results.push({ name, status: 'PASS', details: details || null });
      console.log(`PASS ${name}${details ? `: ${JSON.stringify(details)}` : ''}`);
    } catch (error) {
      results.push({ name, status: 'FAIL', error: String(error) });
      console.log(`FAIL ${name}: ${String(error)}`);
      await page.mouse.up().catch(() => {});
      await page.keyboard.up('Space').catch(() => {});
      await page.keyboard.up('Enter').catch(() => {});
    }
  };
  const text = selector => page.locator(selector).innerText();
  const waitForText = async (selector, expected) => {
    await page.waitForFunction(({ selector, expected }) => document.querySelector(selector)?.textContent.includes(expected), { selector, expected }, { timeout: 5000 });
  };
  const recording = () => page.locator('.motion-demo').evaluate(element => element.classList.contains('is-recording'));
  const waitRecording = active => page.waitForFunction(active => document.querySelector('.motion-demo').classList.contains('is-recording') === active, active, { timeout: 3000 });
  const goTop = async () => { await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(80); };

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const hasClock = Boolean(page.clock && typeof page.clock.install === 'function');
  if (hasClock) await page.clock.install({ time: new Date('2026-10-28T14:00:00Z') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  await run('Page loads with Inter, metadata and semantic main', async () => {
    const state = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content,
      font: document.fonts.check('16px Inter'),
      loadedInter: [...document.fonts].some(font => font.family.includes('Inter') && font.status === 'loaded'),
      h1: document.querySelectorAll('h1').length,
      main: document.querySelectorAll('main').length,
      skip: document.querySelector('.skip-link')?.getAttribute('href'),
      images: [...document.images].filter(image => !image.hasAttribute('alt') || !image.getAttribute('width') || !image.getAttribute('height')).map(image => image.src),
    }));
    assert(state.title.includes('Vclarity') && state.description?.length > 50, 'Missing useful title/description');
    assert(state.font && state.loadedInter, 'Inter did not load');
    assert(state.h1 === 1 && state.main === 1 && state.skip === '#main', 'Page landmarks or skip link invalid');
    assert(state.images.length === 0, `Images lack alt or dimensions: ${state.images.join(', ')}`);
    return state;
  });

  await run('Desktop navigation anchors scroll to their destinations', async () => {
    const destinationPositions = [];
    for (const id of ['features', 'how-it-works', 'faq']) {
      await page.locator(`#navigation a[href="#${id}"]`).click();
      await page.waitForFunction(id => location.hash === `#${id}`, id);
      await page.waitForFunction(id => {
        const top = document.getElementById(id).getBoundingClientRect().top;
        return top >= -2 && top < 260;
      }, id, { timeout: 5000 });
      // Wait for the final position, not merely the first frame entering range.
      await page.waitForFunction(id => {
        const element = document.getElementById(id);
        const top = element.getBoundingClientRect().top;
        const previous = Number(element.dataset.qaPreviousTop);
        element.dataset.qaPreviousTop = String(top);
        return Number.isFinite(previous) && Math.abs(top - previous) < 0.2;
      }, id, { timeout: 5000, polling: 100 });
      const top = await page.locator(`#${id}`).evaluate(element => element.getBoundingClientRect().top);
      assert(top >= -2 && top < 260, `${id} anchor is obscured or did not scroll: ${top}px`);
      destinationPositions.push({ id, top: Math.round(top) });
    }
    return destinationPositions;
  });

  await run('Developer preview modal supports Escape and focus restoration', async () => {
    await goTop();
    const trigger = page.locator('.hero-actions [data-open-preview]');
    await trigger.focus();
    await page.keyboard.press('Enter');
    assert(await page.locator('#preview-dialog').evaluate(dialog => dialog.open), 'Dialog failed to open from keyboard');
    assert(await page.locator('#preview-dialog').evaluate(dialog => dialog.contains(document.activeElement)), 'Focus is outside modal');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#preview-dialog').open);
    assert(await trigger.evaluate(element => element === document.activeElement), 'Focus did not return to modal trigger');
    await trigger.click();
    await page.locator('.dialog-close').click();
    assert(await trigger.evaluate(element => element === document.activeElement), 'Close-button focus restoration failed');
  });

  await run('Preview archive is a valid downloadable ZIP; guide is available', async () => {
    const href = await page.locator('.preview-download').getAttribute('href');
    const response = await page.request.get(new URL(href, origin).href);
    const body = await response.body();
    assert(response.status() === 200, `Preview ZIP status ${response.status()}`);
    assert(body.length > 1000 && body[0] === 0x50 && body[1] === 0x4b && body[2] === 0x03 && body[3] === 0x04, 'Preview archive lacks ZIP signature');
    assert((response.headers()['content-type'] || '').includes('zip'), 'Preview archive served with wrong MIME type');
    const guide = await page.request.get(new URL(await page.locator('.preview-guide-link').getAttribute('href'), origin).href);
    assert(guide.status() === 200 && (await guide.text()).includes('Vclarity'), 'Preview guide unavailable');
    return { bytes: body.length, mime: response.headers()['content-type'] };
  });

  await run('Live Inspect displays actual computed values and copies CSS', async () => {
    await page.locator('#tab-live').click();
    const target = page.locator('.workspace-project.project-green');
    await target.focus();
    await page.keyboard.press('Enter');
    const real = await target.evaluate(element => ({ fontSize: getComputedStyle(element).fontSize, width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height) }));
    assert((await text('#result-badge')).trim() === 'Exact (DOM)', 'Live result is not labeled Exact (DOM)');
    const output = await text('#result-body');
    assert(output.includes(real.fontSize) && output.includes(`${real.width} × ${real.height}`), `DOM result does not match selected element: ${output}`);
    await page.locator('[data-copy-css]').click();
    await waitForText('#toast', 'Computed CSS copied');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    assert(clipboard.includes('font-family:') && clipboard.includes('border-radius:'), 'Copy CSS did not write computed CSS');
    return real;
  });

  await run('Feature tabs support arrows, Home/End and honest Ghost output', async () => {
    await page.locator('#tab-live').focus();
    await page.keyboard.press('ArrowRight');
    assert(await page.locator('#tab-ghost').getAttribute('aria-selected') === 'true', 'ArrowRight did not activate Ghost Inspect');
    assert(await page.locator('#tab-ghost').evaluate(element => element === document.activeElement), 'Ghost tab did not receive focus');
    assert(await page.locator('#feature-panel').getAttribute('aria-labelledby') === 'tab-ghost', 'Tabpanel label did not follow selection');
    await waitForText('#result-badge', 'Estimated (AI)');
    assert((await text('#result-body')).includes('Suggested structure'), 'Ghost interpretation missing');
    assert((await text('#feature-demo-caption')).includes('not a live AI request'), 'Ghost sequence lacks illustrative disclosure');
    await page.keyboard.press('End');
    assert(await page.locator('#tab-video').getAttribute('aria-selected') === 'true', 'End did not activate Video Capture');
    await page.keyboard.press('Home');
    assert(await page.locator('#tab-live').getAttribute('aria-selected') === 'true', 'Home did not restore Live Inspect');
    assert(await page.locator('#tab-ghost').getAttribute('tabindex') === '-1', 'Inactive tab remains in Tab order');
  });

  await run('Code tabs, clipboard and ZIP export work', async () => {
    await page.locator('#code-tab-html').focus();
    await page.keyboard.press('ArrowRight');
    assert(await page.locator('#code-tab-css').getAttribute('aria-selected') === 'true', 'Code ArrowRight failed');
    assert(await page.locator('#code-output').getAttribute('aria-labelledby') === 'code-tab-css', 'Code output has wrong tab label');
    const output = await page.locator('#generated-code').textContent();
    assert(output.includes('@keyframes') && output.includes('prefers-reduced-motion'), 'CSS example is empty or incomplete');
    await page.locator('#copy-code').click();
    await waitForText('#toast', 'styles.css copied');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    const normalized = value => value.replace(/\r\n/g, '\n');
    assert(clipboard.trim().length > 100 && normalized(clipboard) === normalized(output), 'Copy output differs from selected file');
    await page.locator('#code-tab-css').focus();
    await page.keyboard.press('End');
    assert(await page.locator('#code-tab-js').getAttribute('aria-selected') === 'true', 'Code End failed');
    await page.keyboard.press('Home');
    assert(await page.locator('#code-tab-html').getAttribute('aria-selected') === 'true', 'Code Home failed');
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#download-code').click();
    const download = await downloadEvent;
    assert(download.suggestedFilename() === 'vclarity-motion-example.zip', 'Unexpected code archive filename');
    assert(await download.failure() === null, 'Code archive download failed');
    await download.saveAs('qa/vclarity-motion-example.zip');
    const stream = await download.createReadStream();
    let first = null;
    let size = 0;
    for await (const chunk of stream) { if (!first) first = chunk; size += chunk.length; }
    assert(size > 500 && first?.[0] === 0x50 && first?.[1] === 0x4b, 'Generated archive is not a nonempty ZIP');
    return { clipboardCharacters: clipboard.length, downloadBytes: size };
  });

  await run('Illustrative workflow reaches completed output', async () => {
    await page.locator('#replay-analysis').click();
    assert((await text('#analysis-detail')).includes('Illustrative workflow'), 'Workflow starts without illustrative label');
    if (hasClock) await page.clock.fastForward(3500);
    await waitForText('#analysis-title', 'Your implementation is ready');
    assert((await text('#analysis-detail')).includes('Estimated (AI)'), 'Completed output omits AI estimate label');
  });

  await run('Hold Region pointer press records; release stops', async () => {
    await page.locator('button[data-record-mode="region"]').click();
    const button = page.locator('#record-button');
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    assert(box, 'Record button has no bounding box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await waitRecording(true);
    assert(await button.getAttribute('aria-pressed') === 'true', 'Pointer recording lacks pressed state');
    if (hasClock) await page.clock.fastForward(2200); else await page.waitForTimeout(2200);
    assert((await text('#record-timer')).includes('00:02'), 'Pointer recording timer failed to advance');
    await page.mouse.up();
    await waitRecording(false);
    assert((await text('#record-state')).includes('complete'), 'Pointer release did not complete capture');
  });

  await run('Hold Region supports Space and Enter release controls', async () => {
    for (const key of ['Space', 'Enter']) {
      await page.locator('button[data-record-mode="region"]').click();
      await page.locator('#record-button').focus();
      await page.keyboard.down(key);
      await waitRecording(true);
      if (hasClock) await page.clock.fastForward(300); else await page.waitForTimeout(160);
      await page.keyboard.up(key);
      await waitRecording(false);
      assert(await page.locator('#record-button').getAttribute('aria-pressed') === 'false', `${key} release left recording active`);
    }
  });

  await run('Record Tab toggles Start/Stop and mode change resets capture', async () => {
    await page.locator('button[data-record-mode="tab"]').click();
    await page.locator('#record-button').click();
    await waitRecording(true);
    assert((await text('#record-button-label')).includes('Stop'), 'Tab record does not expose Stop control');
    if (hasClock) await page.clock.fastForward(300); else await page.waitForTimeout(160);
    await page.locator('#record-button').click();
    await waitRecording(false);
    await page.locator('#record-button').focus();
    await page.keyboard.press('Enter');
    await waitRecording(true);
    await page.locator('button[data-record-mode="region"]').click();
    await waitRecording(false);
    assert((await text('#record-state')).includes('Ready'), 'Switching modes did not reset recording');
    assert((await text('#record-timer')).includes('00:00'), 'Switching modes left a running timer');
  });

  await run('Both recording modes stop automatically at 30 seconds', async () => {
    assert(hasClock, 'Playwright clock unavailable; run the 30-second cap check manually');
    for (const mode of ['region', 'tab']) {
      await page.locator(`button[data-record-mode="${mode}"]`).click();
      if (mode === 'region') { await page.locator('#record-button').focus(); await page.keyboard.down('Space'); }
      else await page.locator('#record-button').click();
      await waitRecording(true);
      await page.clock.fastForward(31000);
      await waitRecording(false);
      assert((await text('#record-state')).includes('30s limit reached'), `${mode} failed automatic limit`);
      assert((await text('#record-timer')).includes('00:30'), `${mode} timer failed to cap at 00:30`);
      if (mode === 'region') await page.keyboard.up('Space');
    }
    return { acceleratedClock: true };
  });

  await run('Reduced motion disables recording animation and reveals content', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('button[data-record-mode="tab"]').click();
    await page.locator('#record-button').click();
    await waitRecording(true);
    const styles = await page.evaluate(() => ({
      media: matchMedia('(prefers-reduced-motion: reduce)').matches,
      rowAnimation: getComputedStyle(document.querySelector('.kinetic-row')).animationName,
      indicatorAnimation: getComputedStyle(document.querySelector('.motion-demo .record-dot')).animationName,
      smoothScroll: getComputedStyle(document.documentElement).scrollBehavior,
      hiddenReveals: [...document.querySelectorAll('.reveal-ready')].filter(element => getComputedStyle(element).opacity === '0').length,
    }));
    assert(styles.media && styles.rowAnimation === 'none' && styles.indicatorAnimation === 'none', 'Reduced motion still animates recording');
    assert(styles.smoothScroll === 'auto' && styles.hiddenReveals === 0, 'Reduced motion hides content or retains smooth scrolling');
    await page.locator('#record-button').click();
    if (hasClock) await page.clock.fastForward(200);
    await waitRecording(false);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    return styles;
  });

  await run('Mobile navigation is keyboard accessible and closes on Escape/selection', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goTop();
    const menu = page.locator('.menu-toggle');
    await menu.focus();
    await page.keyboard.press('Enter');
    assert(await menu.getAttribute('aria-expanded') === 'true', 'Mobile menu did not open from keyboard');
    assert(await page.locator('#navigation').isVisible(), 'Expanded navigation remains hidden');
    await page.keyboard.press('Escape');
    assert(await menu.getAttribute('aria-expanded') === 'false', 'Escape did not close menu');
    assert(await menu.evaluate(element => element === document.activeElement), 'Escape did not restore menu focus');
    await page.keyboard.press('Enter');
    await page.locator('#navigation a[href="#faq"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => location.hash === '#faq');
    assert(await menu.getAttribute('aria-expanded') === 'false', 'Selecting mobile nav link did not close menu');
  });

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 780 }]) {
    await run(`${viewport.width}px responsive layout and screenshots`, async () => {
      await page.setViewportSize(viewport);
      await page.locator('#tab-live').click();
      await page.locator('button[data-record-mode="region"]').click();
      await page.waitForTimeout(180);
      const metrics = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        overflowing: [...document.querySelectorAll('body *')].filter(element => {
          if (element.closest('[data-ui], .icon-library, .sr-only, .skip-link, dialog')) return false;
          const css = getComputedStyle(element);
          if (css.position === 'absolute' || css.position === 'fixed' || css.display === 'none') return false;
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
        }).slice(0, 8).map(element => `${element.tagName.toLowerCase()}.${element.className}`),
      }));
      assert(metrics.document <= viewport.width + 1 && metrics.body <= viewport.width + 1, `Horizontal page overflow: ${JSON.stringify(metrics)}`);
      assert(metrics.overflowing.length === 0, `Content protrudes beyond viewport: ${metrics.overflowing.join(', ')}`);
      // Scroll each screen so progressive reveals are visible in the full-page capture.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let top = 0; top < height; top += Math.floor(viewport.height * 0.8)) {
        await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), top);
        await page.waitForTimeout(60);
      }
      await goTop();
      await page.waitForTimeout(650);
      await page.screenshot({ path: `qa/screenshots/${viewport.width}-full.png`, fullPage: true, animations: 'disabled' });
      await page.screenshot({ path: `qa/screenshots/${viewport.width}-hero.png`, animations: 'disabled' });
      await page.locator('#motion').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `qa/screenshots/${viewport.width}-motion.png`, animations: 'disabled' });
      return metrics;
    });
  }

  await run('FAQ opens with keyboard and exposes the answer', async () => {
    const question = page.locator('.faq-list summary').filter({ hasText: 'Does it record audio?' });
    await question.focus();
    await page.keyboard.press('Enter');
    assert(await question.evaluate(element => element.parentElement.open), 'FAQ failed to open from keyboard');
    assert((await question.locator('..').innerText()).includes('Neither Hold region nor Record tab records audio'), 'FAQ answer missing');
  });

  await run('No unexpected console, page or network failures', async () => {
    assert(errors.console.length === 0 && errors.page.length === 0 && errors.requests.length === 0, JSON.stringify(errors));
    return errors;
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await goTop();
  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  page.off('requestfailed', onRequestFailed);
  const failed = results.filter(result => result.status === 'FAIL');
  const report = { passed: results.length - failed.length, failed: failed.length, results, browserErrors: errors, screenshots: 'qa/screenshots/', downloads: 'qa/vclarity-motion-example.zip' };
  console.log(JSON.stringify(report, null, 2));
  if (failed.length) throw new Error(`BROWSER_QA_RESULT ${JSON.stringify(report)}`);
  return report;
}
