/*
 * Minimal chrome.* stand-in so the real content script can run on a plain
 * HTML page. Settings come from the query string:
 *   ?mode=blur|collapse|placeholder  &strict=1  &always=phrase1|phrase2
 */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const store = {};
  if (params.get('mode')) store.mode = params.get('mode');
  if (params.get('strict')) store.strict = params.get('strict') === '1';
  if (params.get('always')) store.alwaysBlock = params.get('always').split('|');

  const storageListeners = [];
  const messageListeners = [];
  const sent = [];

  const shim = {
    sent,
    store,
    setSync(obj) {
      Object.assign(store, obj);
      const changes = {};
      for (const k of Object.keys(obj)) changes[k] = { newValue: obj[k] };
      storageListeners.forEach((l) => l(changes, 'sync'));
    },
    /** Simulate a message from the popup / service worker to the content script. */
    sendToContent(msg) {
      return new Promise((resolve) => messageListeners.forEach((l) => l(msg, {}, resolve)));
    },
  };

  const chromeShim = {
    storage: {
      sync: {
        get: async () => JSON.parse(JSON.stringify(store)),
        set: async (o) => shim.setSync(o),
      },
      onChanged: { addListener: (l) => storageListeners.push(l) },
    },
    runtime: {
      sendMessage: async (msg) => {
        sent.push(msg);
        if (msg.type === 'gta6ss:hello') return { tabId: 1, revealAll: false };
        return undefined;
      },
      onMessage: { addListener: (l) => messageListeners.push(l) },
    },
  };

  Object.defineProperty(window, 'chrome', { value: chromeShim, configurable: true, writable: true });
  window.__shim = shim;
})();
