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
      await p.locator('#preview-dialog').evaluate(dialog => { if (dialog.open) dialog.close(); }).catch(() => {});
      await p.waitForTimeout(80);
    }
  };
  const dialog = p.locator('#preview-dialog');
  const waitClosed = () => p.waitForFunction(() => !document.querySelector('#preview-dialog').open);
  const snapshot = () => p.evaluate(() => ({
    scroll: { x: scrollX, y: scrollY },
    bodyStyle: document.body.style.cssText,
    rootStyle: document.documentElement.style.cssText,
    bodyClass: document.body.className,
    rootClass: document.documentElement.className,
    width: document.documentElement.scrollWidth,
    brandX: document.querySelector('.site-header .brand').getBoundingClientRect().left,
  }));
  const openModal = async trigger => {
    // Pointer auto-scroll and a reveal transition may settle after a pre-click sample.
    // Capture immediately before the app's click handler locks the document instead.
    await trigger.evaluate(element => {
      element.addEventListener('click', () => {
        window.__vclarityP2BeforeOpen = {
          scroll: { x: scrollX, y: scrollY },
          bodyStyle: document.body.style.cssText,
          rootStyle: document.documentElement.style.cssText,
          bodyClass: document.body.className,
          rootClass: document.documentElement.className,
          width: document.documentElement.scrollWidth,
          brandX: document.querySelector('.site-header .brand').getBoundingClientRect().left,
        };
      }, { capture: true, once: true });
    });
    await trigger.click();
    const before = await p.evaluate(() => {
      const before = window.__vclarityP2BeforeOpen;
      delete window.__vclarityP2BeforeOpen;
      return before;
    });
    assert(before, 'Modal trigger did not dispatch its click event');
    await p.waitForFunction(() => document.querySelector('#preview-dialog').open);
    return before;
  };
  const sameRestoration = (before, after, description) => {
    assert(Math.abs(before.scroll.x - after.scroll.x) < 1 && Math.abs(before.scroll.y - after.scroll.y) < 1, `${description}: scroll position changed: ${JSON.stringify({ before: before.scroll, after: after.scroll })}`);
    assert(before.bodyStyle === after.bodyStyle && before.rootStyle === after.rootStyle, `${description}: inline styles were not restored: ${JSON.stringify({ before, after })}`);
    assert(before.bodyClass === after.bodyClass && before.rootClass === after.rootClass, `${description}: document classes were not restored`);
    assert(Math.abs(before.brandX - after.brandX) < 1, `${description}: content shifted horizontally on close`);
  };
  const capture = async (selector, path) => {
    await p.evaluate(() => document.activeElement?.blur());
    await p.waitForTimeout(180);
    await p.locator(selector).screenshot({ path, animations: 'disabled', style: '.skip-link:not(:focus){visibility:hidden}' });
  };
  const readDescription = () => p.locator('#feature-description').evaluate(element => {
    const css = getComputedStyle(element);
    return { fontSize: css.fontSize, lineHeight: css.lineHeight, maxWidth: css.maxWidth, color: css.color, marginTop: css.marginTop };
  });
  const waitForScrollToSettle = () => p.evaluate(() => new Promise((resolve, reject) => {
    const started = performance.now();
    let lastMovement = started;
    let x = scrollX;
    let y = scrollY;
    const sample = () => {
      const now = performance.now();
      if (Math.abs(scrollX - x) > 0.2 || Math.abs(scrollY - y) > 0.2) lastMovement = now;
      x = scrollX;
      y = scrollY;
      if (now - lastMovement >= 180) return resolve();
      if (now - started >= 3500) return reject(new Error('Scroll did not settle within 3500ms'));
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  const expectedDescriptions = {
    1440: { fontSize: '16px', lineHeight: '29.6px', maxWidth: '310px', color: 'rgb(105, 112, 125)', marginTop: '17px' },
    1024: { fontSize: '14px', lineHeight: '25.9px', maxWidth: '310px', color: 'rgb(105, 112, 125)', marginTop: '17px' },
    768: { fontSize: '13px', lineHeight: '24.05px', maxWidth: '310px', color: 'rgb(105, 112, 125)', marginTop: '17px' },
    390: { fontSize: '15px', lineHeight: '27.75px', maxWidth: 'none', color: 'rgb(105, 112, 125)', marginTop: '13px' },
    320: { fontSize: '15px', lineHeight: '27.75px', maxWidth: 'none', color: 'rgb(105, 112, 125)', marginTop: '13px' },
  };

  try {
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
    await p.goto(origin, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);

    for (const scenario of [
      { name: 'Escape', selector: '.hero-actions [data-open-preview]', viewport: { width: 1440, height: 900 }, wheel: 500 },
      { name: 'close button', selector: '.final-cta [data-open-preview]', viewport: { width: 390, height: 844 }, wheel: -500 },
      { name: 'backdrop', selector: '.final-cta [data-open-preview]', viewport: { width: 1440, height: 900 }, wheel: -500 },
    ]) {
      await run(`Modal locks the background and restores position/focus after ${scenario.name}`, async () => {
        await p.setViewportSize(scenario.viewport);
        const trigger = p.locator(scenario.selector);
        await trigger.scrollIntoViewIfNeeded();
        await p.waitForTimeout(200);
        const before = await openModal(trigger);
        const open = await snapshot();
        assert(Math.abs(before.brandX - open.brandX) < 1, `Opening the modal shifted content horizontally: ${before.brandX} → ${open.brandX}`);
        await p.mouse.move(3, 3);
        await p.mouse.wheel(0, scenario.wheel);
        await p.waitForTimeout(250);
        const wheeled = await snapshot();
        assert(Math.abs(wheeled.scroll.y - open.scroll.y) < 1, `Backdrop wheel moved the background by ${wheeled.scroll.y - open.scroll.y}px`);
        if (scenario.name === 'Escape') await p.keyboard.press('Escape');
        else if (scenario.name === 'close button') await p.locator('.dialog-close').click();
        else await p.mouse.click(3, 3);
        await waitClosed();
        await p.waitForTimeout(80);
        const after = await snapshot();
        sameRestoration(before, after, scenario.name);
        assert(await trigger.evaluate(element => document.activeElement === element), `${scenario.name}: trigger focus was not restored`);
        const box = await trigger.boundingBox();
        assert(box && box.y >= -1 && box.y + box.height <= scenario.viewport.height + 1, `${scenario.name}: restored trigger is outside the viewport`);
        return { before: before.scroll, after: after.scroll, horizontalShift: open.brandX - before.brandX };
      });
    }

    await run('Short mobile modal scrolls internally while its background stays fixed', async () => {
      await p.setViewportSize({ width: 390, height: 500 });
      const trigger = p.locator('.hero-actions [data-open-preview]');
      await trigger.scrollIntoViewIfNeeded();
      const before = await openModal(trigger);
      const locked = await snapshot();
      const size = await dialog.evaluate(element => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, top: element.scrollTop, box: element.getBoundingClientRect().toJSON() }));
      assert(size.scrollHeight > size.clientHeight, `Short modal has no internal scroll area: ${JSON.stringify(size)}`);
      await p.mouse.move(size.box.x + size.box.width / 2, size.box.y + size.box.height / 2);
      await p.mouse.wheel(0, 400);
      await p.waitForTimeout(250);
      const scrollTop = await dialog.evaluate(element => element.scrollTop);
      assert(scrollTop > size.top, 'Wheel inside the modal did not scroll its content');
      const download = p.locator('.preview-download');
      await download.focus();
      const visible = await download.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const modal = element.closest('dialog').getBoundingClientRect();
        return rect.top >= modal.top - 1 && rect.bottom <= modal.bottom + 1 && rect.top >= 0 && rect.bottom <= innerHeight;
      });
      assert(visible, 'Keyboard focus could not reveal the download control inside the short modal');
      await p.mouse.wheel(0, 1600);
      await p.waitForTimeout(200);
      const atBottom = await dialog.evaluate(element => element.scrollTop);
      await p.mouse.wheel(0, 600);
      await p.waitForTimeout(200);
      assert(Math.abs((await snapshot()).scroll.y - locked.scroll.y) < 1, 'Scrolling beyond the dialog boundary moved the document background');
      await dialog.screenshot({ path: 'qa/screenshots/p2-390-short-modal.png', animations: 'disabled' });
      await p.keyboard.press('Escape');
      await waitClosed();
      sameRestoration(before, await snapshot(), 'Short mobile modal');
      return { scrollHeight: size.scrollHeight, clientHeight: size.clientHeight, internalScroll: scrollTop, bottom: atBottom };
    });

    await run('Repeated modal cycles preserve existing inline document styles', async () => {
      await p.setViewportSize({ width: 1440, height: 900 });
      const original = await p.evaluate(() => ({ body: document.body.getAttribute('style'), root: document.documentElement.getAttribute('style') }));
      await p.evaluate(() => { document.body.style.setProperty('padding-right', '3px'); document.body.style.setProperty('--existing-modal-check', 'preserved'); });
      try {
        const trigger = p.locator('.hero-actions [data-open-preview]');
        await trigger.scrollIntoViewIfNeeded();
        for (let index = 0; index < 3; index++) {
          const before = await openModal(trigger);
          await p.keyboard.press('Escape');
          await waitClosed();
          sameRestoration(before, await snapshot(), `Repeated open/close ${index + 1}`);
        }
      } finally {
        await p.evaluate(original => {
          if (original.body === null) document.body.removeAttribute('style'); else document.body.setAttribute('style', original.body);
          if (original.root === null) document.documentElement.removeAttribute('style'); else document.documentElement.setAttribute('style', original.root);
        }, original);
      }
    });

    await run('Modal scroll restoration also respects reduced motion', async () => {
      await p.emulateMedia({ reducedMotion: 'reduce' });
      const trigger = p.locator('.final-cta [data-open-preview]');
      await trigger.scrollIntoViewIfNeeded();
      const before = await openModal(trigger);
      await p.mouse.move(3, 3);
      await p.mouse.wheel(0, -500);
      await p.waitForTimeout(200);
      await p.keyboard.press('Escape');
      await waitClosed();
      sameRestoration(before, await snapshot(), 'Reduced motion');
      await p.emulateMedia({ reducedMotion: 'no-preference' });
    });

    await run('Use-case links activate the matching feature with pointer input', async () => {
      const states = [];
      for (const mode of ['live', 'ghost', 'video']) {
        let step = 'native fragment destination';
        try {
          const link = p.locator(`.use-case-link[data-feature-link="${mode}"]`);
          assert(await link.getAttribute('href') === '#features', `${mode} use-case link has no native fragment destination`);
          step = 'pointer click';
          await link.click();
          step = 'selected tab state';
          await p.waitForFunction(mode => document.getElementById(`tab-${mode}`).getAttribute('aria-selected') === 'true', mode);
          step = 'URL fragment';
          await p.waitForFunction(() => location.hash === '#features');
          step = 'tab enters viewport';
          await p.waitForFunction(mode => { const rect = document.getElementById(`tab-${mode}`).getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight; }, mode);
          // Entering the viewport does not mean the smooth scroll has finished.
          // Settle before Playwright auto-scrolls to the next distant use-case link.
          await waitForScrollToSettle();
          assert(await p.locator(`#tab-${mode}`).evaluate(element => { const rect = element.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight; }), `${mode} tab left the viewport after scrolling settled`);
          step = 'tab focus';
          assert(await p.locator(`#tab-${mode}`).evaluate(element => document.activeElement === element), `${mode} use-case link did not focus the selected feature tab`);
          step = 'tabpanel accessible label';
          assert(await p.locator('#feature-panel').getAttribute('aria-labelledby') === `tab-${mode}`, `${mode} use-case link left the tabpanel label stale`);
          if (mode === 'ghost') {
            step = 'Ghost estimated output';
            await p.waitForFunction(() => document.querySelector('#result-badge').textContent.includes('Estimated (AI)'));
          }
          states.push({ mode, selected: await p.locator(`#tab-${mode}`).getAttribute('aria-selected') });
        } catch (error) {
          const context = await p.evaluate(mode => {
            const tab = document.getElementById(`tab-${mode}`);
            const rect = tab?.getBoundingClientRect();
            const active = document.activeElement;
            return {
              mode,
              hash: location.hash,
              selectedTab: document.querySelector('.feature-tabs [aria-selected="true"]')?.id,
              activeElement: { tag: active?.tagName, id: active?.id, class: active?.className, text: active?.textContent?.trim().slice(0, 90) },
              scrollY,
              viewport: { width: innerWidth, height: innerHeight },
              tabRect: rect ? { x: rect.x, y: rect.y, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
              tabStyle: tab ? { display: getComputedStyle(tab).display, opacity: getComputedStyle(tab).opacity } : null,
              rootOverflow: getComputedStyle(document.documentElement).overflow,
              bodyOverflow: getComputedStyle(document.body).overflow,
              rootInline: document.documentElement.style.cssText,
              bodyInline: document.body.style.cssText,
              featureTitle: document.querySelector('#feature-title')?.textContent,
              featureLabel: document.querySelector('#feature-panel')?.getAttribute('aria-labelledby'),
              reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
              dialogOpen: document.querySelector('#preview-dialog')?.open,
            };
          }, mode);
          throw new Error(`Pointer use-case ${mode} failed at ${step}: ${String(error)}; context=${JSON.stringify(context)}`);
        }
      }
      return states;
    });

    await run('Use-case links support keyboard Enter and retain visible focus', async () => {
      for (const mode of ['ghost', 'video', 'live']) {
        const link = p.locator(`.use-case-link[data-feature-link="${mode}"]`);
        await link.focus();
        await p.keyboard.press('Enter');
        await p.waitForFunction(() => location.hash === '#features');
        await p.waitForFunction(mode => { const rect = document.getElementById(`tab-${mode}`).getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight; }, mode);
        await waitForScrollToSettle();
        const tab = p.locator(`#tab-${mode}`);
        assert(await tab.evaluate(element => { const rect = element.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight; }), `${mode} keyboard destination left the viewport after scrolling settled`);
        assert(await tab.getAttribute('aria-selected') === 'true' && await tab.evaluate(element => element === document.activeElement), `Keyboard activation did not enter ${mode}`);
        assert(await tab.evaluate(element => element.matches(':focus-visible')), `${mode} keyboard destination has no focus-visible state`);
      }
    });

    await run('Modified use-case clicks keep native navigation semantics', async () => {
      const observed = await p.locator('.use-case-link[data-feature-link="ghost"]').evaluate(link => {
        const result = [];
        for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
          let preventedByApp;
          const intercept = event => { preventedByApp = event.defaultPrevented; event.preventDefault(); };
          window.addEventListener('click', intercept, { once: true });
          link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, [modifier]: true }));
          result.push({ modifier, preventedByApp, selected: document.querySelector('.feature-tabs [aria-selected="true"]').id });
        }
        return result;
      });
      assert(observed.every(result => result.preventedByApp === false && result.selected === 'tab-live'), `Modified navigation was intercepted by the app: ${JSON.stringify(observed)}`);
      return observed;
    });

    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 780 }]) {
      await run(`${viewport.width}px: CSS consolidation preserves typography and page layout`, async () => {
        await p.setViewportSize(viewport);
        await p.locator('#tab-live').click();
        await p.waitForTimeout(200);
        const description = await readDescription();
        const expected = expectedDescriptions[viewport.width];
        for (const property of ['fontSize', 'maxWidth', 'color', 'marginTop']) assert(description[property] === expected[property], `${viewport.width}px ${property}: ${description[property]} != ${expected[property]}`);
        assert(Math.abs(parseFloat(description.lineHeight) - parseFloat(expected.lineHeight)) < 0.02, `${viewport.width}px line-height changed: ${description.lineHeight}`);
        const layout = await p.evaluate(() => ({
          width: innerWidth,
          document: document.documentElement.scrollWidth,
          links: [...document.querySelectorAll('.use-case-link')].map(element => { const box = element.getBoundingClientRect(); const css = getComputedStyle(element); return { width: box.width, height: box.height, font: css.fontSize, display: css.display }; }),
        }));
        assert(layout.document <= viewport.width + 1, `Page overflow at ${viewport.width}px: ${layout.document}`);
        assert(layout.links.length === 3 && layout.links.every(link => link.width > 0 && link.height >= 24), `Use-case link targets are missing or cramped: ${JSON.stringify(layout.links)}`);
        if (viewport.width === 1440) await capture('#features', 'qa/screenshots/p2-1440-features.png');
        if (viewport.width === 390) await capture('.use-cases', 'qa/screenshots/p2-390-use-cases.png');
        return { description, layout };
      });
    }

    await run('Deployment metadata uses absolute and consistent public URLs', async () => {
      const metadata = await p.evaluate(() => ({
        canonical: document.querySelector('link[rel="canonical"]')?.href || null,
        canonicalRaw: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
        ogUrl: document.querySelector('meta[property="og:url"]')?.content || null,
        ogImage: document.querySelector('meta[property="og:image"]')?.content || null,
        twitterImage: document.querySelector('meta[name="twitter:image"]')?.content || null,
      }));
      const isAbsolute = value => typeof value === 'string' && /^https?:\/\//.test(value);
      assert(isAbsolute(metadata.canonicalRaw) && isAbsolute(metadata.ogUrl) && isAbsolute(metadata.ogImage) && isAbsolute(metadata.twitterImage), `Configured deployment metadata contains relative URLs: ${JSON.stringify(metadata)}`);
      assert(metadata.canonical === metadata.ogUrl, 'Canonical and og:url disagree');
      assert(new URL(metadata.ogImage).origin === new URL(metadata.canonical).origin && metadata.ogImage === metadata.twitterImage, 'Social images disagree with the canonical origin');
      return metadata;
    });

    await run('Navigating to the setup guide and back never restores a locked document', async () => {
      await p.setViewportSize({ width: 390, height: 844 });
      await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      const trigger = p.locator('.hero-actions [data-open-preview]');
      await trigger.scrollIntoViewIfNeeded();
      const before = await openModal(trigger);
      const guideUrl = new URL(await p.locator('.preview-guide-link').getAttribute('href'), origin).href;
      await Promise.all([
        p.waitForURL(guideUrl, { waitUntil: 'domcontentloaded' }),
        p.locator('.preview-guide-link').click(),
      ]);
      assert(await p.locator('h1').innerText() !== '', 'The setup guide did not render a readable heading');
      await p.goBack({ waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => Boolean(document.querySelector('#preview-dialog')));
      assert(await dialog.evaluate(element => !element.open), 'Browser Back restored the preview dialog in an open state');
      const after = await snapshot();
      assert(before.bodyStyle === after.bodyStyle && before.rootStyle === after.rootStyle, `Browser Back retained document lock styles: ${JSON.stringify({ before, after })}`);
      assert(before.bodyClass === after.bodyClass && before.rootClass === after.rootClass, 'Browser Back retained document lock classes');
      const restored = await p.locator('main').evaluate(element => ({
        visible: getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility === 'visible',
        inert: element.inert,
        rootOverflow: getComputedStyle(document.documentElement).overflow,
        bodyOverflow: getComputedStyle(document.body).overflow,
      }));
      assert(restored.visible && !restored.inert, `Browser Back restored inaccessible main content: ${JSON.stringify(restored)}`);
      assert(!['hidden', 'clip'].includes(restored.rootOverflow) && !['hidden', 'clip'].includes(restored.bodyOverflow), `Browser Back kept document scrolling locked: ${JSON.stringify(restored)}`);
      await p.evaluate(() => scrollTo({ top: 1000, behavior: 'instant' }));
      const scrollBefore = await p.evaluate(() => scrollY);
      await p.mouse.move(3, 3);
      await p.mouse.wheel(0, 500);
      await p.waitForFunction(before => scrollY > before + 10, scrollBefore, { timeout: 3000 });
      return { guideUrl, restored, scrollBefore, scrollAfter: await p.evaluate(() => scrollY) };
    });

    await run('No console, page or resource failures', async () => {
      assert(errors.console.length === 0 && errors.page.length === 0 && errors.requests.length === 0, JSON.stringify(errors));
      return errors;
    });
  } finally {
    await p.close();
  }
  const failed = results.filter(result => result.status === 'FAIL');
  const report = { passed: results.length - failed.length, failed: failed.length, results, browserErrors: errors, screenshots: 'qa/screenshots/p2-*.png' };
  if (failed.length) throw new Error(`P2_QA_RESULT ${JSON.stringify(report)}`);
  return report;
}
