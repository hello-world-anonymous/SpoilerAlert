/*
 * SpoilerAlert: service worker.
 *  - per-tab "reveal all for this session" flag (chrome.storage.session, cleared
 *    when the tab closes or the browser restarts)
 *  - toolbar badge with the number of hidden items on the current tab
 *  - registers the content script on all sites only after the user grants the
 *    optional <all_urls> permission from the options page
 * No network requests.
 */
'use strict';

const GENERIC_ID = 'spoileralert-generic';
const LEGACY_GENERIC_ID = 'gta6' + 'ss-generic';
// Must match manifest.json content_scripts[0].matches.
const STATIC_MATCHES = [
  '*://*.youtube.com/*',
  '*://*.reddit.com/*',
  '*://*.instagram.com/*',
  '*://*.facebook.com/*',
];
const CONTENT_JS = ['src/defaults.js', 'src/matcher.js', 'src/adapters.js', 'src/content.js'];
const CONTENT_CSS = ['src/content.css'];

const revealKey = (tabId) => 'revealAll:' + tabId;

async function syncGenericRegistration() {
  const granted = await chrome.permissions.contains({ origins: ['<all_urls>'] });
  // Versions before the SpoilerAlert rename registered under another id.
  const legacy = await chrome.scripting.getRegisteredContentScripts({ ids: [LEGACY_GENERIC_ID] });
  if (legacy.length) await chrome.scripting.unregisterContentScripts({ ids: [LEGACY_GENERIC_ID] });
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [GENERIC_ID] });
  if (granted && !existing.length) {
    await chrome.scripting.registerContentScripts([{
      id: GENERIC_ID,
      matches: ['<all_urls>'],
      excludeMatches: STATIC_MATCHES,
      js: CONTENT_JS,
      css: CONTENT_CSS,
      runAt: 'document_idle',
      allFrames: false,
      persistAcrossSessions: true,
    }]);
  } else if (!granted && existing.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [GENERIC_ID] });
  }
  return granted;
}

async function getRevealAll(tabId) {
  if (tabId == null) return false;
  const r = await chrome.storage.session.get(revealKey(tabId));
  return !!r[revealKey(tabId)];
}

async function setRevealAll(tabId, value) {
  if (value) await chrome.storage.session.set({ [revealKey(tabId)]: true });
  else await chrome.storage.session.remove(revealKey(tabId));
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'spoileralert:revealAll', value: !!value });
  } catch (_) {
    return null; // no content script on that tab
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string' || sender.id !== chrome.runtime.id) return;
  const tabId = sender.tab && sender.tab.id;
  const fromExtensionPage = !sender.tab;

  switch (msg.type) {
    case 'spoileralert:hello':
      getRevealAll(tabId).then((revealAll) => sendResponse({ tabId, revealAll }));
      return true;

    case 'spoileralert:count':
      if (tabId != null) {
        const n = Number(msg.count) || 0;
        chrome.action.setBadgeText({ tabId, text: n ? String(Math.min(n, 999)) : '' });
      }
      return;

    case 'spoileralert:getTabState':
      if (!fromExtensionPage) return;
      getRevealAll(msg.tabId).then((revealAll) => sendResponse({ revealAll }));
      return true;

    case 'spoileralert:setRevealAll':
      if (!fromExtensionPage) return;
      setRevealAll(msg.tabId, msg.value).then(sendResponse);
      return true;

    case 'spoileralert:syncGeneric':
      if (!fromExtensionPage) return;
      syncGenericRegistration().then((granted) => sendResponse({ granted }), (e) => sendResponse({ error: String(e) }));
      return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(revealKey(tabId));
});

chrome.permissions.onAdded.addListener(() => syncGenericRegistration());
chrome.permissions.onRemoved.addListener(() => syncGenericRegistration());

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: '#7a3cff' });
  syncGenericRegistration();
});
chrome.runtime.onStartup.addListener(() => syncGenericRegistration());
