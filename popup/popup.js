'use strict';

const { sanitizeSettings } = globalThis.GTA6Defaults;
const $ = (id) => document.getElementById(id);

let tabId = null;
let revealAll = false;

async function loadSettings() {
  const s = sanitizeSettings(await chrome.storage.sync.get(null));
  $('enabled').checked = s.enabled;
  $('mode').value = s.mode;
  $('mode').disabled = !s.enabled;
  return s;
}

async function refreshStats() {
  const s = sanitizeSettings(await chrome.storage.sync.get(null));
  let stats = null;
  if (tabId != null) {
    try { stats = await chrome.tabs.sendMessage(tabId, { type: 'gta6ss:getStats' }); } catch (_) { stats = null; }
  }
  const btn = $('reveal');
  if (!stats) {
    $('count').textContent = '–';
    $('count-label').textContent = 'Not running on this page';
    const granted = await chrome.permissions.contains({ origins: ['<all_urls>'] }).catch(() => false);
    $('sub').textContent = granted
      ? 'Reload the page, or this page type is not supported (e.g. chrome:// pages).'
      : 'Only YouTube, Reddit, Instagram and Facebook are covered. Turn on "all websites" in settings for news sites.';
    btn.disabled = true;
    return;
  }
  revealAll = !!stats.revealAll;
  $('count').textContent = String(stats.blocked);
  $('count-label').textContent = stats.blocked === 1 ? 'item hidden on this page' : 'items hidden on this page';
  const parts = [];
  if (!s.enabled) parts.push('Shield is off');
  if (revealAll) parts.push('Everything revealed for this tab session');
  if (stats.revealed) parts.push(stats.revealed + ' revealed by click');
  parts.push('Adapter: ' + stats.adapter);
  $('sub').textContent = parts.join(' · ');
  btn.disabled = !s.enabled;
  btn.textContent = revealAll ? 'Hide spoilers again' : 'Reveal all for this tab session';
  btn.classList.toggle('secondary', revealAll);
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab ? tab.id : null;
  await loadSettings();
  await refreshStats();

  $('enabled').addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ enabled: e.target.checked });
    $('mode').disabled = !e.target.checked;
    setTimeout(refreshStats, 250);
  });

  $('mode').addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ mode: e.target.value });
    setTimeout(refreshStats, 250);
  });

  $('reveal').addEventListener('click', async () => {
    if (tabId == null) return;
    await chrome.runtime.sendMessage({ type: 'gta6ss:setRevealAll', tabId, value: !revealAll });
    setTimeout(refreshStats, 250);
  });

  $('options').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  setInterval(refreshStats, 1500); // pick up infinite-scroll changes while open
}

main();
