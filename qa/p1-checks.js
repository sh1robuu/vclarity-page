async page => {
  const origin = /^https?:/.test(page.url()) ? new URL(page.url()).origin : 'http://127.0.0.1:4173';
  const p = await page.context().newPage();
  const results = [];
  const errors = { console: [], page: [], requests: [] };
  p.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()); });
  p.on('pageerror', error => errors.page.push(String(error)));
  p.on('requestfailed', request => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const run = async (name, test) => {
    try { results.push({ name, status: 'PASS', details: await test() || null }); }
    catch (error) {
      results.push({ name, status: 'FAIL', error: String(error) });
      await p.mouse.up().catch(() => {});
      await p.keyboard.up('Space').catch(() => {});
      await p.keyboard.up('Enter').catch(() => {});
      await p.locator('#preview-dialog').evaluate(dialog => { if (dialog.open) dialog.close(); }).catch(() => {});
    }
  };
  const active = () => p.locator('.motion-demo').evaluate(element => element.classList.contains('is-recording'));
  const waitActive = value => p.waitForFunction(value => document.querySelector('.motion-demo').classList.contains('is-recording') === value, value, { timeout: 3000 });
  const mode = value => p.locator(`button[data-record-mode="${value}"]`);
  const tick = async milliseconds => { await p.clock.runFor(milliseconds); };
  const goTop = () => p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  const prepareCapture = async () => {
    await p.evaluate(() => document.activeElement?.blur());
    // Let responsive DOM measurements and focus-only overlays settle before a representative image.
    await tick(180);
  };

  try {
    await p.clock.install();
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
    await p.goto(origin, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);

    await run('Initial Live result passes pointers through before any tab is clicked', async () => {
      const pointerEvents = await p.locator('.feature-result').evaluate(element => getComputedStyle(element).pointerEvents);
      assert(pointerEvents === 'none', `Initial Live overlay has pointer-events:${pointerEvents}`);
      const card = p.locator('.workspace-project.project-cream');
      await card.scrollIntoViewIfNeeded();
      await card.click({ timeout: 3000 });
      assert((await p.locator('#result-title').innerText()).includes('button.project'), 'Initial Live target did not receive the pointer selection');
      return { pointerEvents };
    });

    await run('Custom focus-visible CSS parses and applies to buttons, links, tabs and FAQ', async () => {
      const parsed = await p.evaluate(() => [...document.styleSheets[0].cssRules].some(rule => rule.selectorText?.includes('button:focus-visible')));
      assert(parsed, 'The custom button focus selector is missing from the CSSOM');
      await p.keyboard.press('Tab');
      const measurements = [];
      for (const selector of ['.hero-actions [data-open-preview]', '.hero-actions [data-watch-demo]', '#tab-live', '.faq-list summary']) {
        const target = p.locator(selector).first();
        await target.focus();
        const style = await target.evaluate(element => {
          const css = getComputedStyle(element);
          return { focusVisible: element.matches(':focus-visible'), width: css.outlineWidth, style: css.outlineStyle, color: css.outlineColor };
        });
        assert(style.focusVisible && style.width === '3px' && style.style === 'solid' && style.color === 'rgb(54, 92, 245)', `${selector} has incorrect keyboard focus: ${JSON.stringify(style)}`);
        measurements.push({ selector, ...style });
      }
      return measurements;
    });

    await run('Mobile menu keyboard opening enters its links in forward order', async () => {
      await p.setViewportSize({ width: 390, height: 844 });
      await goTop();
      const menu = p.locator('.menu-toggle');
      await menu.focus();
      await p.keyboard.press('Enter');
      assert(await menu.getAttribute('aria-expanded') === 'true', 'Menu did not open');
      assert(await p.locator('#navigation a').nth(0).evaluate(element => element === document.activeElement), 'Keyboard open skipped the first navigation link');
      await p.keyboard.press('Tab');
      assert(await p.locator('#navigation a').nth(1).evaluate(element => element === document.activeElement), 'Forward Tab skipped the second navigation link');
      await p.keyboard.press('Tab');
      assert(await p.locator('#navigation a').nth(2).evaluate(element => element === document.activeElement), 'Forward Tab skipped the third navigation link');
      await p.keyboard.press('Escape');
      assert(await menu.getAttribute('aria-expanded') === 'false' && await menu.evaluate(element => element === document.activeElement), 'Escape did not close the menu and restore its trigger');
      await p.keyboard.press('Enter');
      await p.keyboard.press('Enter');
      assert(await menu.getAttribute('aria-expanded') === 'false', 'Activating the first navigation link did not close the menu');
      assert(await p.evaluate(() => location.hash === '#features'), 'First link did not navigate to Features');
    });

    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 780 }]) {
      await run(`${viewport.width}px: unblocked Live target, readable controls, no overflow or clipping`, async () => {
        await p.setViewportSize(viewport);
        await p.locator('#tab-live').click();
        await mode('region').click();
        await p.locator('.workspace-heading').focus();
        const card = p.locator('.workspace-project.project-cream');
        await card.scrollIntoViewIfNeeded();
        await tick(180);
        const hit = await card.evaluate(element => {
          const rect = element.getBoundingClientRect();
          const topmost = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          const css = getComputedStyle(element);
          return { receivesCenter: element.contains(topmost), topmost: topmost?.className, font: css.fontSize, dimensions: `${Math.round(rect.width)} × ${Math.round(rect.height)}` };
        });
        assert(hit.receivesCenter, `The result overlay blocks the card center: ${JSON.stringify(hit)}`);
        await card.click({ timeout: 3000 });
        const output = await p.locator('#result-body').innerText();
        assert(output.includes(hit.font) && output.includes(hit.dimensions), 'Pointer selection did not display the selected card’s actual DOM values');
        assert(await p.locator('.feature-result').evaluate(element => getComputedStyle(element).pointerEvents === 'none'), 'Live read-only result does not pass pointers through');
        const metrics = await p.evaluate(() => {
          const textSelectors = ['.feature-tabs>button>span:not(.shortcut):not(.new-label)', '.record-mode-tabs button', '#record-help', '#record-timer', '#record-timer>span', '#record-button', '#record-toggle', '.code-toolbar button', '#copy-code', '#download-code', '#replay-analysis', '.ai-note'];
          const sizes = textSelectors.flatMap(selector => [...document.querySelectorAll(selector)].filter(element => element.getClientRects().length).map(element => ({ selector, text: element.textContent.trim().slice(0, 45), font: parseFloat(getComputedStyle(element).fontSize) })));
          const controls = [...document.querySelectorAll('.feature-tabs button,.record-mode-tabs button,#record-button,#record-toggle,.code-toolbar button,#copy-code,#download-code,#replay-analysis,#feature-replay')].filter(element => element.getClientRects().length);
          const clipped = controls.flatMap(element => {
            const rect = element.getBoundingClientRect();
            for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
              const css = getComputedStyle(parent);
              const box = parent.getBoundingClientRect();
              if (['hidden', 'clip'].includes(css.overflowX) && (rect.left < box.left - 1 || rect.right > box.right + 1)) return [{ control: element.id || element.textContent.trim(), axis: 'x', parent: parent.className }];
              if (['hidden', 'clip'].includes(css.overflowY) && (rect.top < box.top - 1 || rect.bottom > box.bottom + 1)) return [{ control: element.id || element.textContent.trim(), axis: 'y', parent: parent.className }];
            }
            return [];
          });
          return { viewport: innerWidth, document: document.documentElement.scrollWidth, sizes, clipped };
        });
        assert(metrics.document <= viewport.width + 1, `Horizontal overflow: ${metrics.document}px at ${viewport.width}px`);
        assert(metrics.sizes.every(item => item.font >= 12), `Functional text below 12px: ${JSON.stringify(metrics.sizes.filter(item => item.font < 12))}`);
        assert(metrics.clipped.length === 0, `Interactive controls clipped: ${JSON.stringify(metrics.clipped)}`);
        await p.locator('#tab-ghost').click();
        await tick(1250);
        await p.locator('#feature-replay').click();
        await tick(1250);
        assert((await p.locator('#result-badge').innerText()).includes('Estimated (AI)'), 'Ghost replay did not finish with its AI estimate label');
        const replay = await p.locator('#feature-replay').evaluate(element => ({ font: parseFloat(getComputedStyle(element).fontSize), height: element.getBoundingClientRect().height }));
        assert(replay.font >= 12, `Ghost Replay is only ${replay.font}px`);
        await p.locator('#tab-video').click();
        assert(await p.locator('.feature-result').evaluate(element => getComputedStyle(element).pointerEvents !== 'none'), 'Video result link inherits Live pointer passthrough');
        await p.locator('.demo-video-link').click();
        await p.waitForFunction(() => location.hash === '#motion');
        await p.locator('#tab-live').click();
        await p.locator('#feature-panel').scrollIntoViewIfNeeded();
        await tick(300);
        await prepareCapture();
        // Chromium can paint a translated, offscreen fixed skip link inside tall element captures.
        // Keep its real keyboard-focus behavior; suppress only its unfocused capture artifact.
        await p.locator('#features').screenshot({ path: `qa/screenshots/p1-${viewport.width}-feature.png`, animations: 'disabled', style: '.skip-link:not(:focus){visibility:hidden}' });
        await p.locator('#motion').scrollIntoViewIfNeeded();
        await tick(300);
        await prepareCapture();
        await p.locator('#motion').screenshot({ path: `qa/screenshots/p1-${viewport.width}-motion.png`, animations: 'disabled', style: '.skip-link:not(:focus){visibility:hidden}' });
        return { viewport: metrics.viewport, document: metrics.document, card: hit, fonts: metrics.sizes, ghostReplay: replay };
      });
    }

    await run('Timer denominator meets normal-text contrast', async () => {
      const contrast = await p.locator('#record-timer>span').evaluate(element => {
        const channels = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
        const luminance = values => values.map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
        const foreground = getComputedStyle(element).color;
        const background = getComputedStyle(element.closest('.record-status')).backgroundColor;
        const a = luminance(channels(foreground)), b = luminance(channels(background));
        return { foreground, background, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
      });
      assert(contrast.ratio >= 4.5, `Timer contrast is ${contrast.ratio.toFixed(3)}:1`);
      return contrast;
    });

    await run('Region Start/Stop alternative supports synthesized clicks and normal keyboard activation', async () => {
      await mode('region').click();
      const toggle = p.locator('#record-toggle');
      const hold = p.locator('#record-button');
      await toggle.evaluate(element => element.click());
      await waitActive(true);
      assert(await toggle.getAttribute('aria-pressed') === 'true' && (await p.locator('#record-toggle-label').innerText()).includes('Stop'), 'Started fallback has wrong state or label');
      assert(await hold.isDisabled(), 'Hold control remains enabled during toggle recording');
      await tick(150);
      await toggle.evaluate(element => element.click());
      await waitActive(false);
      assert(await hold.isEnabled() && await toggle.getAttribute('aria-pressed') === 'false', 'Fallback stop did not restore hold/pressed state');
      for (const key of ['Enter', 'Space']) {
        await toggle.focus();
        await p.keyboard.press(key);
        await waitActive(true);
        await tick(150);
        await p.keyboard.press(key);
        await waitActive(false);
      }
      await toggle.evaluate(element => { element.click(); element.click(); });
      await tick(180);
      assert(!(await active()), 'Rapid Start/Stop clicks left recording active');
      await toggle.click();
      await tick(250);
      assert(await active(), 'A previous stop timeout interrupted a fresh recording');
      await toggle.click();
      await waitActive(false);
      assert((await p.locator('#demo-announcement').innerText()).length > 20, 'No accessible recording status was announced');
    });

    await run('Existing pointer/Space/Enter hold gestures stop once, with no click restart', async () => {
      const hold = p.locator('#record-button');
      await mode('region').click();
      await hold.scrollIntoViewIfNeeded();
      const box = await hold.boundingBox();
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await p.mouse.down();
      await waitActive(true);
      assert(await hold.isEnabled(), 'Physical hold incorrectly disables its own control');
      await tick(250);
      await p.mouse.up();
      await waitActive(false);
      await tick(150);
      assert(!(await active()), 'Pointer release’s generated click restarted capture');
      for (const key of ['Space', 'Enter']) {
        await hold.focus();
        await p.keyboard.down(key);
        await waitActive(true);
        await tick(250);
        await p.keyboard.up(key);
        await waitActive(false);
        await tick(150);
        assert(!(await active()), `${key} release restarted capture`);
      }
      await hold.focus();
      await p.keyboard.down('Space');
      await waitActive(true);
      await p.locator('#record-toggle').evaluate(element => element.click());
      await tick(150);
      await waitActive(false);
      await p.keyboard.up('Space');
      assert(!(await active()), 'Stop demo did not stop a held recording');
    });

    await run('Rapid Space/Enter hold retries survive the previous minimum-duration stop', async () => {
      const hold = p.locator('#record-button');
      const keys = ['Space', 'Enter'];
      for (const key of keys) {
        await mode('region').click();
        await hold.focus();
        await p.keyboard.down(key);
        await tick(20);
        await p.keyboard.up(key);
        await tick(20);
        await p.keyboard.down(key);
        await tick(150);
        assert(await active(), `${key} retry was ignored or stopped by the previous release timeout`);
        assert(await hold.evaluate(element => element === document.activeElement), `${key} retry lost hold-button focus`);
        await p.keyboard.up(key);
        await waitActive(false);
      }
      return { keys, retryGapMilliseconds: 20, sustainedRetryMilliseconds: 150 };
    });

    await run('Mode changes reset fallback state; tab Start/Stop still works', async () => {
      await mode('region').click();
      await p.locator('#record-toggle').click();
      await waitActive(true);
      await mode('tab').click();
      await waitActive(false);
      assert(await p.locator('#record-toggle').isHidden(), 'Region fallback remains visible in tab mode');
      assert(await p.locator('#record-button').isEnabled(), 'Tab control remains disabled after mode change');
      await p.locator('#record-button').click();
      await waitActive(true);
      await tick(200);
      await p.locator('#record-button').click();
      await waitActive(false);
      await mode('region').click();
      assert(await p.locator('#record-toggle').isVisible() && (await p.locator('#record-toggle-label').innerText()).includes('Start'), 'Region fallback did not reset on returning to region mode');
    });

    await run('All recording entry points stop automatically at 30 seconds', async () => {
      const entries = [];
      for (const entry of ['hold', 'region-toggle', 'tab']) {
        await mode(entry === 'tab' ? 'tab' : 'region').click();
        if (entry === 'hold') { await p.locator('#record-button').focus(); await p.keyboard.down('Space'); }
        else await p.locator(entry === 'tab' ? '#record-button' : '#record-toggle').click();
        await waitActive(true);
        await p.clock.fastForward(31000);
        await waitActive(false);
        assert((await p.locator('#record-state').innerText()).includes('30s limit reached') && (await p.locator('#record-timer').innerText()).includes('00:30'), `${entry} did not stop at the limit`);
        assert(await p.locator('#record-button').isEnabled() && await p.locator('#record-toggle').getAttribute('aria-pressed') === 'false', `${entry} left a disabled or pressed control`);
        if (entry === 'hold') await p.keyboard.up('Space');
        entries.push(entry);
      }
      return { entryPoints: entries, acceleratedClock: true };
    });

    await run('Reduced motion preserves fallback interaction without animation', async () => {
      await p.emulateMedia({ reducedMotion: 'reduce' });
      await mode('region').click();
      await p.locator('#record-toggle').click();
      await waitActive(true);
      const styles = await p.evaluate(() => ({ row: getComputedStyle(document.querySelector('.kinetic-row')).animationName, indicator: getComputedStyle(document.querySelector('.motion-demo .record-dot')).animationName, scroll: getComputedStyle(document.documentElement).scrollBehavior }));
      assert(styles.row === 'none' && styles.indicator === 'none' && styles.scroll === 'auto', `Reduced motion regressed: ${JSON.stringify(styles)}`);
      await tick(150);
      await p.locator('#record-toggle').click();
      await waitActive(false);
      await p.emulateMedia({ reducedMotion: 'no-preference' });
      return styles;
    });

    await run('Preview prerequisites are explicit before the download action', async () => {
      await p.setViewportSize({ width: 390, height: 844 });
      await goTop();
      await p.locator('.hero-actions [data-open-preview]').click();
      const copy = await p.locator('#preview-dialog').evaluate(dialog => {
        const children = [...dialog.children];
        const downloadIndex = children.findIndex(element => element.matches('.preview-download'));
        return children.slice(0, downloadIndex).map(element => element.textContent).join(' ');
      });
      assert(/Live Inspect/.test(copy) && /Ghost/.test(copy) && /Motion\s*&\s*code/i.test(copy) && /API/.test(copy) && /provider/i.test(copy) && /consent/i.test(copy), `Prerequisites are incomplete or after download: ${copy}`);
      await prepareCapture();
      await p.locator('#preview-dialog').screenshot({ path: 'qa/screenshots/p1-390-preview-modal.png', animations: 'disabled' });
      await p.keyboard.press('Escape');
      return { beforeDownload: copy };
    });

    await run('No console, page or resource failures', async () => {
      assert(errors.console.length === 0 && errors.page.length === 0 && errors.requests.length === 0, JSON.stringify(errors));
      return errors;
    });

    await p.setViewportSize({ width: 1440, height: 900 });
    await goTop();
    await prepareCapture();
    await p.screenshot({ path: 'qa/screenshots/p1-1440-hero.png', animations: 'disabled' });
  } finally {
    await p.close();
  }
  const failed = results.filter(result => result.status === 'FAIL');
  const report = { passed: results.length - failed.length, failed: failed.length, results, browserErrors: errors, screenshots: 'qa/screenshots/p1-*.png' };
  if (failed.length) throw new Error(`P1_QA_RESULT ${JSON.stringify(report)}`);
  return report;
}
