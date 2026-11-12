/*
 * Fixture self-check. Every element with data-expect="blocked|visible|revealed"
 * is compared with the state the content script gave it (data-gta6ss-state).
 * With ?strict=1, data-expect-strict overrides data-expect when present.
 * Fixtures can define window.FIXTURE_STEPS = [[label, async fn], ...] to mutate
 * the page (infinite scroll, recycling, SPA navigation, clicks); expectations
 * are re-checked after each step.
 *
 * Results: document.title starts with PASS or FAIL, and
 * <pre id="gta6ss-results"> holds JSON (read by scripts/run-fixtures.js).
 */
(function () {
  'use strict';
  const SETTLE_MS = 450; // > 150 ms debounce + chunking
  const strict = new URLSearchParams(location.search).get('strict') === '1';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const results = [];

  function check(step) {
    for (const el of document.querySelectorAll('[data-expect]')) {
      const exp = (strict && el.getAttribute('data-expect-strict')) || el.getAttribute('data-expect');
      const got = el.getAttribute('data-gta6ss-state') || 'visible';
      const name = el.getAttribute('data-name') || (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70);
      results.push({ step, name, expected: exp, got, ok: exp === got });
    }
  }

  function render(extra) {
    const failed = results.filter((r) => !r.ok);
    const summary = {
      fixture: location.pathname.split('/').pop() + location.search,
      pass: failed.length === 0,
      checks: results.length,
      failed: failed.length,
      ...extra,
      failures: failed,
    };
    document.title = (summary.pass ? 'PASS' : 'FAIL') + ` ${results.length - failed.length}/${results.length}`;
    const box = document.createElement('section');
    box.setAttribute('data-gta6ss-ui', '');
    box.style.cssText = 'font:12px/1.4 ui-monospace,monospace;margin:24px 0;padding:12px;border:2px solid ' + (summary.pass ? '#1f8a4c' : '#c0392b');
    const pre = document.createElement('pre');
    pre.id = 'gta6ss-results';
    pre.textContent = JSON.stringify(summary, null, 2);
    const h = document.createElement('h2');
    h.textContent = document.title;
    box.append(h, pre);
    document.body.append(box);
  }

  window.addEventListener('load', async () => {
    const t0 = performance.now();
    await wait(SETTLE_MS);
    check('initial');
    for (const [label, fn] of window.FIXTURE_STEPS || []) {
      await fn();
      await wait(SETTLE_MS);
      check(label);
    }
    const counts = window.__gta6ssDebug ? window.__gta6ssDebug.counts() : null;
    render({ adapter: window.__gta6ssDebug && window.__gta6ssDebug.adapter, finalCounts: counts, ms: Math.round(performance.now() - t0) });
  });
})();
