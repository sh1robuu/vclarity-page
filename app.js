'use strict';

// Every demonstration is browser-local. No screen capture or AI request is made.
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const announcement = $('#demo-announcement');
  const toast = $('#toast');
  let toastTimeout;
  const announce = (message) => { announcement.textContent = message; };
  function showToast(message) {
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3200);
  }
  async function copyText(value, successMessage) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const field = document.createElement('textarea');
        const previousFocus = document.activeElement;
        field.value = value;
        field.style.cssText = 'position:fixed;left:-9999px;top:0';
        field.setAttribute('aria-label', 'Text to copy');
        document.body.append(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        previousFocus?.focus({ preventScroll: true });
        if (!copied) throw new Error('Clipboard unavailable');
      }
      showToast(successMessage);
    } catch {
      showToast('Clipboard access is unavailable. Select the code to copy, or use Download.');
    }
  }

  // Native dialog supplies a focus trap, Escape handling, and accessible modality.
  const dialog = $('#preview-dialog');
  let previewTrigger;
  $$('[data-open-preview]').forEach((button) => button.addEventListener('click', () => {
    previewTrigger = button;
    dialog.showModal();
  }));
  $('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => previewTrigger?.focus({ preventScroll: true }));

  const menuButton = $('.menu-toggle');
  const navigation = $('#navigation');
  function setMenu(open) {
    navigation.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  }
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  $$('a', navigation).forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', (event) => { if (!event.target.closest('.nav')) setMenu(false); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuButton.focus();
    }
  });

  function hexColor(value) {
    const channels = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return channels ? '#' + channels.slice(1).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase() : value;
  }
  const dimensions = (rect) => `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  const heroTarget = $('.sample-cta');
  let heroCss = '';
  function inspectHero(withAnnouncement = false) {
    const css = getComputedStyle(heroTarget);
    const rect = heroTarget.getBoundingClientRect();
    const values = {
      fontFamily: css.fontFamily.split(',')[0].replaceAll('"', ''),
      fontSize: css.fontSize,
      fontWeight: css.fontWeight,
      color: hexColor(css.color),
      backgroundColor: hexColor(css.backgroundColor),
      dimensions: dimensions(rect),
      padding: css.padding,
      borderRadius: css.borderRadius,
    };
    Object.entries(values).forEach(([key, value]) => { $(`[data-property="${key}"]`).textContent = value; });
    $('[data-dimension]').textContent = values.dimensions;
    heroCss = `.primary {\n  font-family: ${css.fontFamily};\n  font-size: ${css.fontSize};\n  font-weight: ${css.fontWeight};\n  color: ${values.color};\n  background-color: ${values.backgroundColor};\n  width: ${Math.round(rect.width)}px;\n  height: ${Math.round(rect.height)}px;\n  padding: ${css.padding};\n  border-radius: ${css.borderRadius};\n  display: ${css.display};\n  gap: ${css.gap};\n  border: ${css.border};\n}`;
    if (withAnnouncement) announce(`Selected button. Exact DOM dimensions: ${values.dimensions} pixels. Computed CSS updated.`);
  }
  heroTarget.addEventListener('click', () => inspectHero(true));
  $('[data-copy-css]').addEventListener('click', () => { inspectHero(); copyText(heroCss, 'Computed CSS copied.'); });

  // Shared roving tab behavior: arrows activate, Home/End go to the edges.
  function bindTabs(tabs, activate) {
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', (event) => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        activate(tabs[next]);
        tabs[next].focus();
      });
    });
  }
  function selectTab(tabs, current, panel) {
    tabs.forEach((tab) => {
      const active = tab === current;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', current.id);
  }

  const featureTabs = $$('.feature-tabs [role="tab"]');
  const featurePanel = $('#feature-panel');
  const resultBody = $('#result-body');
  const selection = $('.demo-selection');
  const featureReplay = $('#feature-replay');
  let featureMode = 'live';
  let featureTimeout;
  let selectedTarget = $('.workspace-heading');
  const modeCopy = {
    live: {
      label: 'Precision, without the guesswork.',
      title: 'The real CSS.<br>Right in front of you.',
      description: 'Hover, select, understand. Read typography, colors, dimensions, and spacing directly from the page’s DOM.',
      proof: 'Exact (DOM) measurements', hint: 'Try it. Select an element in the demo.',
      caption: 'Select a heading or project card to inspect it.',
    },
    ghost: {
      label: 'Step back. See the structure.',
      title: 'A whole region.<br>Clearly understood.',
      description: 'Draw a selection around a component or composition. AI helps unpack its visual hierarchy and suggests a structure to build from.',
      proof: 'Visual interpretation · Estimated (AI)', hint: 'Replay the example selection and analysis.',
      caption: 'Example interpretation, not a live AI request.',
    },
    video: {
      label: 'New in 0.2.0 · Motion & code',
      title: 'Beyond a still.<br>Into the interaction.',
      description: 'Record a selected region or your visible tab. Capture up to 30 seconds of movement, then use AI to help reconstruct its behavior.',
      proof: 'Two capture modes · No audio · 30s max', hint: 'Try both recording modes in the demo below.',
      caption: 'Illustrative motion capture. Try the full demo below.',
    },
  };
  function inspectFeature(target, withAnnouncement = false) {
    selectedTarget = target;
    const css = getComputedStyle(target);
    const rect = target.getBoundingClientRect();
    const canvasRect = $('#inspect-canvas').getBoundingClientRect();
    selection.style.left = `${rect.left - canvasRect.left}px`;
    selection.style.top = `${rect.top - canvasRect.top}px`;
    selection.style.width = `${rect.width}px`;
    selection.style.height = `${rect.height}px`;
    const name = target.classList.contains('workspace-heading') ? 'button.heading' : 'button.project';
    $('.selection-tag', selection).innerHTML = `${name} <span>${dimensions(rect)}</span>`;
    $('#result-title').textContent = name;
    $('#result-badge').textContent = 'Exact (DOM)';
    $('#result-badge').classList.remove('ai-badge');
    resultBody.innerHTML = `<div class="result-properties"><span>Font size <b>${css.fontSize}</b></span><span>Font weight <b>${css.fontWeight}</b></span><span>Color <b>${hexColor(css.color)}</b></span><span>Dimensions <b>${dimensions(rect)}</b></span></div>`;
    if (withAnnouncement) announce(`Selected ${name}. Exact DOM values updated: ${dimensions(rect)} pixels, ${css.fontSize} font size.`);
  }
  function ghostExample() {
    clearTimeout(featureTimeout);
    $('#result-title').textContent = 'Selected region';
    $('#result-badge').textContent = 'Illustrative demo';
    $('#result-badge').classList.add('ai-badge');
    resultBody.innerHTML = '<p class="ghost-findings">Selection captured.<br><strong>Example analysis</strong> · Reading composition…</p>';
    announce('Illustrative Ghost Inspect sequence: region selected. Example analysis follows; no data is sent.');
    featureTimeout = setTimeout(() => {
      if (featureMode !== 'ghost') return;
      $('#result-badge').textContent = 'Estimated (AI)';
      resultBody.innerHTML = '<div class="ghost-findings"><strong>Suggested structure</strong><br>Heading → two-column project grid → task row.<br>Muted surfaces group related content.</div>';
      announce('Example analysis complete: heading, two-column project grid, and task row. This is an illustrative interpretation.');
    }, reducedMotion.matches ? 0 : 1100);
  }
  function activateFeature(tab, announceChange = true) {
    clearTimeout(featureTimeout);
    featureMode = tab.dataset.mode;
    $$('[data-inspect-target]', featurePanel).forEach((target) => { target.disabled = featureMode !== 'live'; });
    featurePanel.dataset.active = featureMode;
    selectTab(featureTabs, tab, featurePanel);
    selection.removeAttribute('style');
    const copy = modeCopy[featureMode];
    $('#feature-label').textContent = copy.label;
    $('#feature-title').innerHTML = copy.title;
    $('#feature-description').textContent = copy.description;
    $('#feature-proof').innerHTML = `<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-check"/></svg> ${copy.proof}`;
    $('#feature-hint').textContent = copy.hint;
    $('#feature-demo-caption').textContent = copy.caption;
    featureReplay.hidden = featureMode !== 'ghost';
    $('.result-heading .icon use').setAttribute('href', featureMode === 'live' ? '#i-cursor' : featureMode === 'ghost' ? '#i-region' : '#i-video');
    if (featureMode === 'live') inspectFeature(selectedTarget);
    if (featureMode === 'ghost') {
      $('.selection-tag', selection).textContent = 'Region selection · illustrative demo';
      ghostExample();
    }
    if (featureMode === 'video') {
      $('.selection-tag', selection).textContent = 'Capture motion · up to 30 seconds';
      $('#result-title').textContent = 'Motion & code';
      $('#result-badge').textContent = 'Video demo';
      $('#result-badge').classList.add('ai-badge');
      resultBody.innerHTML = '<div class="mini-video-status"><span><span class="record-dot"></span> Ready to capture</span><span>00:00 / 00:30</span></div><a class="demo-video-link" href="#motion">Try Hold region or Record tab ↓</a>';
    }
    if (announceChange && featureMode !== 'ghost') announce(`${tab.dataset.mode === 'live' ? 'Live Inspect' : 'Video Capture'} demo selected.`);
  }
  bindTabs(featureTabs, activateFeature);
  featureReplay.addEventListener('click', ghostExample);
  $$('[data-inspect-target]', featurePanel).forEach((target) => {
    target.addEventListener('click', () => { if (featureMode === 'live') inspectFeature(target, true); });
    target.addEventListener('pointerenter', () => { if (featureMode === 'live') inspectFeature(target); });
    target.addEventListener('focus', () => { if (featureMode === 'live') inspectFeature(target); });
  });
  $('[data-watch-demo]').addEventListener('click', () => {
    activateFeature(featureTabs[0], false);
    featureTabs[0].focus({ preventScroll: true });
  });

  // Recording is a demonstrator state machine, never a MediaRecorder session.
  const motionDemo = $('.motion-demo');
  const recordButton = $('#record-button');
  const recordModeButtons = $$('[data-record-mode]');
  let recordingMode = 'region';
  let recording = false;
  let recordingStarted = 0;
  let recordingInterval;
  let finishTimeout;
  let heldPointer = null;
  let heldKey = null;
  function renderTimer(milliseconds) {
    const seconds = Math.min(30, Math.floor(milliseconds / 1000));
    $('#record-timer').innerHTML = `00:${String(seconds).padStart(2, '0')} <span>/ 00:30</span>`;
  }
  function resetRecording() {
    clearInterval(recordingInterval);
    clearTimeout(finishTimeout);
    recording = false;
    heldPointer = null;
    heldKey = null;
    motionDemo.classList.remove('is-recording');
    recordButton.setAttribute('aria-pressed', 'false');
    renderTimer(0);
    $('#record-state').textContent = 'Ready to capture';
    $('#record-button-label').textContent = recordingMode === 'region' ? 'Hold to try' : 'Start recording';
  }
  function finishRecording(reason = 'released') {
    if (!recording) return;
    const elapsed = Math.min(30000, performance.now() - recordingStarted);
    clearInterval(recordingInterval);
    clearTimeout(finishTimeout);
    recording = false;
    heldPointer = null;
    heldKey = null;
    motionDemo.classList.remove('is-recording');
    recordButton.setAttribute('aria-pressed', 'false');
    renderTimer(reason === 'limit' ? 30000 : elapsed);
    $('#record-state').textContent = reason === 'limit' ? '30s limit reached' : 'Demo capture complete';
    $('#record-button-label').textContent = recordingMode === 'region' ? 'Hold to retry' : 'Record again';
    announce(reason === 'limit' ? 'Recording demo stopped automatically at 30 seconds. No video was recorded or sent.' : 'Recording demo complete. No video was recorded or sent.');
  }
  function stopRecording(reason = 'released') {
    if (!recording) return;
    const remaining = 100 - (performance.now() - recordingStarted);
    if (remaining > 0 && reason === 'released') {
      clearTimeout(finishTimeout);
      finishTimeout = setTimeout(() => finishRecording(reason), remaining);
    } else finishRecording(reason);
  }
  function startRecording() {
    if (recording) return;
    clearTimeout(finishTimeout);
    recording = true;
    recordingStarted = performance.now();
    motionDemo.classList.add('is-recording');
    recordButton.setAttribute('aria-pressed', 'true');
    $('#record-state').textContent = 'Recording demo';
    $('#record-button-label').textContent = recordingMode === 'region' ? 'Release to stop' : 'Stop recording';
    renderTimer(0);
    announce(`${recordingMode === 'region' ? 'Region' : 'Tab'} recording demo started. ${recordingMode === 'region' ? 'Release to stop.' : 'Press Stop recording to finish.'} This is an illustrative demo only.`);
    recordingInterval = setInterval(() => {
      const elapsed = performance.now() - recordingStarted;
      renderTimer(elapsed);
      if (elapsed >= 30000) finishRecording('limit');
    }, 100);
  }
  recordModeButtons.forEach((button) => button.addEventListener('click', () => {
    recordingMode = button.dataset.recordMode;
    resetRecording();
    motionDemo.dataset.recordMode = recordingMode;
    recordModeButtons.forEach((mode) => {
      const active = mode === button;
      mode.classList.toggle('active', active);
      mode.setAttribute('aria-pressed', String(active));
    });
    $('#record-instruction').textContent = recordingMode === 'region' ? 'Draw. Hold steady. Release.' : 'Your tab. Every interaction.';
    $('#record-help').textContent = recordingMode === 'region' ? 'Hold the button, Space, or Enter; release to stop.' : 'Start the demo, then press Stop to finish. 30 seconds maximum.';
    announce(`${recordingMode === 'region' ? 'Hold region' : 'Record tab'} selected.`);
  }));
  recordButton.setAttribute('aria-describedby', 'record-help');
  recordButton.setAttribute('aria-pressed', 'false');
  $('#record-help').textContent = 'Hold the button, Space, or Enter; release to stop.';
  recordButton.addEventListener('pointerdown', (event) => {
    if (recordingMode !== 'region' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    recordButton.focus({ preventScroll: true });
    heldPointer = event.pointerId;
    recordButton.setPointerCapture(event.pointerId);
    startRecording();
  });
  const releasePointer = (event) => {
    if (recordingMode === 'region' && event.pointerId === heldPointer) stopRecording();
  };
  recordButton.addEventListener('pointerup', releasePointer);
  recordButton.addEventListener('pointercancel', releasePointer);
  recordButton.addEventListener('lostpointercapture', releasePointer);
  recordButton.addEventListener('keydown', (event) => {
    if (recordingMode !== 'region' || ![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    if (!event.repeat && heldKey === null) { heldKey = event.key; startRecording(); }
  });
  recordButton.addEventListener('keyup', (event) => {
    if (recordingMode !== 'region' || event.key !== heldKey) return;
    event.preventDefault();
    stopRecording();
  });
  recordButton.addEventListener('blur', () => { if (recordingMode === 'region') stopRecording('blur'); });
  recordButton.addEventListener('click', () => { if (recordingMode === 'tab') recording ? stopRecording() : startRecording(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopRecording('hidden'); });
  window.addEventListener('blur', () => { if (recordingMode === 'region') stopRecording('blur'); });

  const samples = {
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Motion study — illustrative example</title>
  <link rel="stylesheet" href="styles.css">
  <script src="script.js" defer></script>
</head>
<body>
  <section class="motion-study" aria-label="Animated typography">
    <div class="marquee"><div class="track">
      <span>MAKE IT MOVE.</span><span aria-hidden="true">MAKE IT MOVE.</span>
    </div></div>
    <div class="marquee reverse" aria-hidden="true"><div class="track">
      <span>MAKE IT MOVE.</span><span>MAKE IT MOVE.</span>
    </div></div>
    <button class="motion-toggle" aria-pressed="false">Pause motion</button>
  </section>
</body>
</html>`,
    css: `/* Illustrative implementation — review before use. */
body { margin: 0; background: #faf7f1; font-family: sans-serif; }
.motion-study { max-width: 760px; margin: 10vh auto; padding: 24px; }
.marquee { overflow: hidden; background: #df795e; color: #493026; }
.track { display: flex; width: max-content; animation: slide 8s linear infinite; }
.track span { padding-right: 24px; font-size: clamp(36px, 8vw, 86px); font-weight: 800; white-space: nowrap; }
.reverse .track { animation-direction: reverse; }
.motion-study:hover .track,
.motion-study:focus-within .track,
.motion-study.is-paused .track { animation-play-state: paused; }
.motion-toggle { margin-top: 18px; padding: 10px 16px; cursor: pointer; }
.motion-toggle:focus-visible { outline: 3px solid #365cf5; outline-offset: 4px; }
@keyframes slide { to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) {
  .track { animation: none; }
  .motion-toggle { display: none; }
}`,
    js: `// Browser-local example; does not record or upload anything.
document.querySelectorAll('.motion-study').forEach((study) => {
  const toggle = study.querySelector('.motion-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    const paused = study.classList.toggle('is-paused');
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = paused ? 'Resume motion' : 'Pause motion';
  });
});`,
  };
  const fileNames = { html: 'index.html', css: 'styles.css', js: 'script.js' };
  const codeTabs = $$('[data-code]');
  let activeCode = 'html';
  function activateCode(tab) {
    activeCode = tab.dataset.code;
    selectTab(codeTabs, tab, $('#code-output'));
    $('#generated-code').textContent = samples[activeCode];
    $('#code-language').textContent = activeCode.toUpperCase();
  }
  bindTabs(codeTabs, activateCode);
  activateCode(codeTabs[0]);
  $('#copy-code').addEventListener('click', () => copyText(samples[activeCode], `${fileNames[activeCode]} copied.`));

  // A small, dependency-free stored ZIP writer keeps the three example files together.
  function zipFiles(files) {
    const encoder = new TextEncoder();
    const crcTable = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xEDB88320 : 0);
      return value >>> 0;
    });
    const crc32 = (bytes) => {
      let crc = 0xFFFFFFFF;
      for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
      return (crc ^ 0xFFFFFFFF) >>> 0;
    };
    const locals = [];
    const central = [];
    let offset = 0;
    let centralSize = 0;
    for (const [name, content] of Object.entries(files)) {
      const path = encoder.encode(name);
      const data = encoder.encode(content);
      const checksum = crc32(data);
      const header = new Uint8Array(30 + path.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x04034B50, true);
      view.setUint16(4, 20, true);
      view.setUint16(12, 0x21, true); // 1980-01-01, the ZIP epoch.
      view.setUint32(14, checksum, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, path.length, true);
      header.set(path, 30);
      const directory = new Uint8Array(46 + path.length);
      const directoryView = new DataView(directory.buffer);
      directoryView.setUint32(0, 0x02014B50, true);
      directoryView.setUint16(4, 20, true);
      directoryView.setUint16(6, 20, true);
      directoryView.setUint16(14, 0x21, true);
      directoryView.setUint32(16, checksum, true);
      directoryView.setUint32(20, data.length, true);
      directoryView.setUint32(24, data.length, true);
      directoryView.setUint16(28, path.length, true);
      directoryView.setUint32(42, offset, true);
      directory.set(path, 46);
      locals.push(header, data);
      central.push(directory);
      offset += header.length + data.length;
      centralSize += directory.length;
    }
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054B50, true);
    endView.setUint16(8, central.length, true);
    endView.setUint16(10, central.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    return new Blob([...locals, ...central, end], { type: 'application/zip' });
  }
  $('#download-code').addEventListener('click', () => {
    const files = Object.fromEntries(Object.entries(fileNames).map(([key, name]) => [name, samples[key]]));
    files['README.txt'] = 'Vclarity landing page — illustrative motion study\n\nOpen index.html in a browser. This is a local example, not output from a live AI request. It uses no network service. Review and adapt the HTML, CSS, and JavaScript before production use.\n';
    const url = URL.createObjectURL(zipFiles(files));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vclarity-motion-example.zip';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast('Example HTML, CSS, and JavaScript downloaded.');
  });

  let workflowTimeout;
  let workflowStep = 0;
  const workflowStages = [
    ['Example capture selected', 'Illustrative workflow · No upload'],
    ['Example: analyzing visible motion', 'Illustrative workflow · No AI request'],
    ['Example: generating a starting point', 'Illustrative workflow · Prepared sample code'],
    ['Your implementation is ready', 'Example output · Estimated (AI)'],
  ];
  function showWorkflowStep() {
    const [title, detail] = workflowStages[workflowStep];
    $('#analysis-title').textContent = title;
    $('#analysis-detail').textContent = detail;
    announce(`${title}. ${detail}.`);
    if (workflowStep < workflowStages.length - 1) {
      workflowStep++;
      workflowTimeout = setTimeout(showWorkflowStep, reducedMotion.matches ? 100 : 1000);
    }
  }
  $('#replay-analysis').addEventListener('click', () => {
    clearTimeout(workflowTimeout);
    workflowStep = 0;
    showWorkflowStep();
  });

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      inspectHero();
      if (featureMode === 'live') inspectFeature(selectedTarget);
      if (innerWidth > 600) setMenu(false);
    }, 100);
  });
  const refreshMeasurements = () => { inspectHero(); if (featureMode === 'live') inspectFeature(selectedTarget); };
  refreshMeasurements();
  document.fonts?.ready.then(refreshMeasurements);

  // Content remains visible without script; reveals are progressive enhancement.
  let revealObserver;
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px 24px 0px' });
    $$('.section-heading, .feature-tabs, .feature-stage, .motion-heading, .motion-demo, .workflow-steps, .code-workbench, .use-case-intro, .use-case-list article, .faq-intro, .faq-list, .final-cta').forEach((element) => {
      if (element.getBoundingClientRect().top > innerHeight) {
        element.classList.add('reveal-ready');
        revealObserver.observe(element);
      }
    });
  }
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      revealObserver?.disconnect();
      $$('.reveal-ready').forEach((element) => element.classList.add('revealed'));
    }
  });
  window.addEventListener('pagehide', () => {
    stopRecording('hidden');
    clearTimeout(toastTimeout);
    clearTimeout(featureTimeout);
    clearTimeout(workflowTimeout);
    clearTimeout(resizeTimeout);
    revealObserver?.disconnect();
    // A page restored from the back/forward cache must never retain hidden content.
    $$('.reveal-ready').forEach((element) => element.classList.add('revealed'));
  });
})();
