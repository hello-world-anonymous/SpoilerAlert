/*
 * GTA 6 Spoiler Shield: content script.
 *
 * Finds card-like containers (via the site adapter), reads their text plus
 * alt / aria-label / title attributes, asks the matcher, and marks matches
 * with data-gta6ss-* attributes. All visual hiding is done by content.css.
 * Makes no network requests.
 */
(() => {
  'use strict';
  if (globalThis.__gta6ssLoaded) return;
  globalThis.__gta6ssLoaded = true;

  const { createMatcher } = globalThis.GTA6Matcher;
  const { sanitizeSettings, DEFAULT_SETTINGS } = globalThis.GTA6Defaults;
  // __GTA6SS_FORCE_ADAPTER is only visible to the fixtures harness: in a real
  // extension the content script runs in an isolated world pages cannot write to.
  const adapter = globalThis.GTA6Adapters.pick(location.hostname, globalThis.__GTA6SS_FORCE_ADAPTER);

  const STATE = 'data-gta6ss-state'; // "blocked" | "revealed"
  const MODE = 'data-gta6ss-mode';
  const OUR_ATTRS = [STATE, MODE, 'data-gta6ss-reason', 'data-gta6ss-pos', 'data-gta6ss-display', 'data-gta6ss-size'];
  const DEBOUNCE_MS = 150;
  const MAX_WAIT_MS = 600;
  const CHUNK_MS = 12;
  const MAX_TEXT = 20000;
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const TEXT_ATTRS = ['alt', 'aria-label', 'title'].concat(adapter.attrs || []);

  let settings = sanitizeSettings(DEFAULT_SETTINGS);
  let matcher = createMatcher(settings);
  let revealAll = false;

  // Processed nodes: element -> fingerprint (its text + context flag) at the last
  // check. Unchanged fingerprint = skip; changed text = re-check. WeakMap so
  // removed nodes are garbage-collected.
  let seen = new WeakMap();
  const revealedAt = new WeakMap(); // element -> fingerprint when the user revealed it

  const pendingDeep = new Set(); // roots whose whole subtree needs scanning
  const pendingUp = new Set(); // elements whose enclosing units need re-checking
  let timer = null;
  let firstQueuedAt = 0;
  let scanning = false;
  let observer = null;
  let lastHref = location.href;
  let lastCountSent = -1;

  // ---------- messaging helpers ----------

  function send(msg) {
    try {
      const p = chrome.runtime.sendMessage(msg);
      if (p && p.catch) p.catch(() => {});
      return p;
    } catch (_) {
      return Promise.resolve(undefined); // extension reloaded / context gone
    }
  }

  // ---------- text extraction ----------

  /** Visible text + alt/aria-label/title of el, skipping our UI and (optionally) nested units. */
  function ownText(el) {
    const custom = adapter.textOf ? adapter.textOf(el) : null;
    if (custom != null) return String(custom).slice(0, MAX_TEXT);
    const parts = [];
    let len = 0;
    const pushAttrs = (e) => {
      for (const a of TEXT_ATTRS) {
        const v = e.getAttribute(a);
        if (v) { parts.push(v); len += v.length; }
      }
    };
    pushAttrs(el);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === 1) {
          if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
          if (adapter.excludeNested && n.matches(adapter.unitSelector)) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode()) && len < MAX_TEXT) {
      if (n.nodeType === 3) {
        const t = n.data;
        if (t.trim()) { parts.push(t); len += t.length; }
      } else {
        pushAttrs(n);
      }
    }
    return parts.join(' ').slice(0, MAX_TEXT);
  }

  function makeMemo() {
    const texts = new Map();
    const ctx = new Map();
    return {
      text(el) {
        let t = texts.get(el);
        if (t === undefined) { t = ownText(el); texts.set(el, t); }
        return t;
      },
      ctx,
    };
  }

  function contextHasTopic(el, memo) {
    if (!adapter.context) return false;
    const c = adapter.context(el);
    if (!c) return false;
    if (memo.ctx.has(c)) return memo.ctx.get(c);
    const text = typeof c === 'string' ? c : memo.text(c);
    const v = matcher.hasTopic(text);
    memo.ctx.set(c, v);
    return v;
  }

  // ---------- marking ----------

  function clear(el) {
    for (const a of OUR_ATTRS) el.removeAttribute(a);
  }

  function block(el, res) {
    // An outer card now covers anything we hid inside it.
    for (const d of el.querySelectorAll('[' + STATE + ']')) { clear(d); seen.delete(d); }
    el.setAttribute(MODE, settings.mode);
    el.setAttribute('data-gta6ss-reason', res.reason || '');
    el.setAttribute(STATE, 'blocked');
    if (settings.mode === 'blur') {
      const cs = getComputedStyle(el);
      if (cs.display === 'contents') el.setAttribute('data-gta6ss-display', 'block');
      if (cs.position === 'static') el.setAttribute('data-gta6ss-pos', 'relative');
      const h = el.getBoundingClientRect().height;
      if (h > 0 && h < 56) el.setAttribute('data-gta6ss-size', 'small');
    }
  }

  function reveal(el) {
    if (el.getAttribute(STATE) !== 'blocked') return;
    clear(el);
    el.setAttribute(STATE, 'revealed');
    revealedAt.set(el, seen.get(el));
    // With excludeNested, inner units (e.g. comments) were never judged on their
    // own while the outer card covered them; check them now.
    if (adapter.excludeNested) queueDeep(el);
    reportCount();
  }

  /** Is el covered by an ancestor we blocked (or revealed, when units nest)? */
  function coveredByAncestor(el) {
    const anc = el.parentElement && el.parentElement.closest('[' + STATE + ']');
    if (!anc) return false;
    const s = anc.getAttribute(STATE);
    return s === 'blocked' || (s === 'revealed' && !adapter.excludeNested);
  }

  // ---------- evaluation ----------

  function evaluate(el, memo) {
    if (!el.isConnected) return;
    const state = el.getAttribute(STATE);

    if (!settings.enabled || revealAll) {
      if (state) clear(el);
      return;
    }

    if (coveredByAncestor(el)) {
      if (state === 'blocked') clear(el);
      seen.delete(el);
      return;
    }

    const isUnit = el.matches(adapter.unitSelector) && (!adapter.acceptUnit || adapter.acceptUnit(el));

    if (!isUnit && !(adapter.blockSelector && el.matches(adapter.blockSelector))) {
      // Matched a unit selector but the adapter rejected it (e.g. a Reddit
      // wrapper around many results); its inner cards are judged instead.
      if (state === 'blocked') clear(el);
      seen.delete(el);
      return;
    }

    // Generic text blocks are only judged when no eligible card encloses them.
    if (!isUnit) {
      const card = el.parentElement && el.parentElement.closest(adapter.unitSelector);
      if (card && memo.text(card).length <= adapter.maxUnitText) {
        if (state === 'blocked') clear(el);
        seen.delete(el);
        return;
      }
    }

    const text = memo.text(el);
    if (isUnit && text.length > adapter.maxUnitText) {
      // Too big to be a card (a whole article page); its blocks are checked instead.
      if (state === 'blocked') clear(el);
      seen.set(el, null);
      return;
    }

    const ctx = contextHasTopic(el, memo);
    const fp = (ctx ? '1' : '0') + text;
    if (seen.get(el) === fp) return; // nothing changed since the last decision
    seen.set(el, fp);

    if (state === 'revealed') {
      if (revealedAt.get(el) === fp) return; // same content the user chose to see
      revealedAt.delete(el);
      clear(el);
    }

    const res = matcher.test(text, { contextHasTopic: ctx });
    if (res.blocked) {
      if (el.getAttribute(STATE) !== 'blocked' || el.getAttribute(MODE) !== settings.mode) block(el, res);
    } else if (el.getAttribute(STATE) === 'blocked') {
      clear(el); // recycled node (e.g. YouTube) whose new content is fine
      if (adapter.excludeNested || adapter.blockSelector) queueDeep(el);
    }
  }

  // ---------- scheduling ----------

  function schedule() {
    const now = Date.now();
    if (!firstQueuedAt) firstQueuedAt = now;
    clearTimeout(timer);
    // Debounce, but never starve on pages that mutate continuously.
    const wait = Math.max(0, Math.min(DEBOUNCE_MS, firstQueuedAt + MAX_WAIT_MS - now));
    timer = setTimeout(flush, wait);
  }

  function queueDeep(node) {
    if (node && node.nodeType === 1) { pendingDeep.add(node); schedule(); }
  }

  function queueUp(node) {
    if (node && node.nodeType === 1) { pendingUp.add(node); schedule(); }
  }

  function scheduleFull() {
    seen = new WeakMap();
    pendingDeep.clear();
    pendingUp.clear();
    queueDeep(document.body || document.documentElement);
  }

  function hasQueuedAncestor(el, set) {
    for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return true;
    return false;
  }

  function flush() {
    timer = null;
    firstQueuedAt = 0;
    if (scanning) { schedule(); return; }

    if (location.href !== lastHref) { // SPA navigation not announced by an event
      lastHref = location.href;
      seen = new WeakMap(); // context (URL/title) may have changed
      pendingDeep.add(document.body || document.documentElement);
    }

    const sel = adapter.allSelector;
    const deep = [...pendingDeep].filter((r) => r.isConnected);
    const up = [...pendingUp].filter((r) => r.isConnected);
    pendingDeep.clear();
    pendingUp.clear();
    const deepSet = new Set(deep);
    const roots = deep.filter((r) => !hasQueuedAncestor(r, deepSet));

    const list = [];
    const added = new Set();
    const add = (e) => { if (!added.has(e)) { added.add(e); list.push(e); } };
    const addAncestors = (r) => {
      const anc = [];
      for (let p = r.parentElement; p; p = p.parentElement) if (p.matches(sel)) anc.push(p);
      for (let i = anc.length - 1; i >= 0; i--) add(anc[i]); // outermost first
    };
    for (const r of roots) {
      addAncestors(r);
      if (r.matches(sel)) add(r);
      for (const e of r.querySelectorAll(sel)) add(e);
    }
    for (const r of up) {
      if (hasQueuedAncestor(r, deepSet) || deepSet.has(r)) continue;
      addAncestors(r);
      if (r.matches(sel)) add(r);
    }
    if (!list.length) { reportCount(); return; }

    scanning = true;
    const memo = makeMemo();
    let i = 0;
    const run = () => {
      const t0 = performance.now();
      for (; i < list.length; i++) {
        try { evaluate(list[i], memo); } catch (e) { /* never break the page */ }
        if (performance.now() - t0 > CHUNK_MS) { i++; setTimeout(run, 0); return; }
      }
      scanning = false;
      reportCount();
    };
    run();
  }

  // ---------- observer ----------

  function onMutations(muts) {
    for (const m of muts) {
      const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (!t) continue;
      if (m.type === 'childList') {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1) queueDeep(n);
          else if (n.nodeType === 3) queueUp(t);
        }
        if (m.removedNodes.length) queueUp(t);
      } else {
        queueUp(t); // characterData or alt/aria-label/title change
      }
    }
  }

  function startObserving() {
    if (observer) return;
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TEXT_ATTRS,
    });
  }

  function stopObserving() {
    if (observer) observer.disconnect();
    observer = null;
  }

  // ---------- stats / UI hooks ----------

  function counts() {
    return {
      blocked: document.querySelectorAll('[' + STATE + '="blocked"]').length,
      revealed: document.querySelectorAll('[' + STATE + '="revealed"]').length,
    };
  }

  function reportCount() {
    const { blocked } = counts();
    if (blocked !== lastCountSent) {
      lastCountSent = blocked;
      send({ type: 'gta6ss:count', count: blocked });
    }
  }

  /** Un-hide everything. Items the user revealed stay revealed unless `includeRevealed`. */
  function clearAll(includeRevealed) {
    const sel = includeRevealed ? '[' + STATE + ']' : '[' + STATE + '="blocked"]';
    for (const el of document.querySelectorAll(sel)) clear(el);
  }

  function applySettings(raw) {
    settings = sanitizeSettings(raw);
    matcher = createMatcher(settings);
    clearAll();
    if (settings.enabled) {
      startObserving();
      scheduleFull();
    } else {
      stopObserving();
      reportCount();
    }
  }

  function setRevealAll(value) {
    revealAll = !!value;
    clearAll(!revealAll); // "hide again" also re-hides items revealed one by one
    if (revealAll) reportCount(); else scheduleFull();
  }

  // Click / keyboard on a blocked card reveals it instead of following links.
  function intercept(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const b = t.closest('[' + STATE + '="blocked"]');
    if (!b) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if ((e.type === 'click' && e.button === 0) || e.type === 'keydown') reveal(b);
  }
  for (const type of ['click', 'auxclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'keydown']) {
    window.addEventListener(type, intercept, true);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'gta6ss:getStats') {
      sendResponse(Object.assign(counts(), { enabled: settings.enabled, mode: settings.mode, revealAll, adapter: adapter.id }));
    } else if (msg.type === 'gta6ss:revealAll') {
      setRevealAll(msg.value);
      sendResponse(Object.assign(counts(), { revealAll }));
    }
  });

  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area !== 'sync') return;
    chrome.storage.sync.get(null).then(applySettings, () => {});
  });

  for (const ev of adapter.spaEvents || []) document.addEventListener(ev, scheduleFull);
  window.addEventListener('popstate', () => schedule());

  // ---------- start ----------

  (async () => {
    let raw = {};
    try { raw = await chrome.storage.sync.get(null); } catch (_) { /* use defaults */ }
    try {
      const r = await send({ type: 'gta6ss:hello' });
      revealAll = !!(r && r.revealAll);
    } catch (_) { /* no service worker: no tab-session reveal */ }
    applySettings(raw);
  })();

  // Exposed for the fixtures harness only (isolated world in the real extension).
  globalThis.__gta6ssDebug = { counts, flushNow: flush, adapter: adapter.id };
})();
