'use strict';

const { DEFAULT_SETTINGS, LIST_KEYS, sanitizeSettings, parseList } = globalThis.GTA6Defaults;
const { createMatcher } = globalThis.GTA6Matcher;
const $ = (id) => document.getElementById(id);
const ALL = ['<all_urls>'];

function fill(s) {
  $('enabled').checked = s.enabled;
  $('strict').checked = s.strict;
  for (const r of document.querySelectorAll('input[name="mode"]')) r.checked = r.value === s.mode;
  for (const k of LIST_KEYS) $(k).value = s[k].join('\n');
  updateTry();
}

function read() {
  const mode = (document.querySelector('input[name="mode"]:checked') || {}).value;
  const raw = { enabled: $('enabled').checked, strict: $('strict').checked, mode };
  for (const k of LIST_KEYS) raw[k] = parseList($(k).value);
  return sanitizeSettings(raw);
}

function status(msg) {
  $('status').textContent = msg;
  clearTimeout(status.t);
  status.t = setTimeout(() => { $('status').textContent = ''; }, 2500);
}

function updateTry() {
  const text = $('tryText').value;
  const out = $('tryResult');
  if (!text.trim()) { out.textContent = ''; out.className = 'result'; return; }
  const r = createMatcher(read()).test(text);
  if (r.blocked) {
    const why = r.reason === 'always-block' ? `always-block phrase "${r.phrase}"`
      : r.reason === 'strict' ? `strict mode, topic "${r.topic}"`
      : `topic "${r.topic}" + spoiler "${r.spoiler}"`;
    out.textContent = 'Would be hidden: ' + why;
    out.className = 'result hit';
  } else {
    out.textContent = 'Would stay visible';
    out.className = 'result miss';
  }
}

async function save() {
  const s = read();
  try {
    await chrome.storage.sync.set(s);
    fill(s);
    status('Saved. Open tabs update automatically.');
  } catch (e) {
    status('Could not save: ' + e.message);
  }
}

let genericGranted = false;

async function refreshGeneric() {
  const granted = await chrome.permissions.contains({ origins: ALL });
  genericGranted = granted;
  $('genericStatus').textContent = granted
    ? 'Running on all websites (generic fallback on)'
    : 'Only YouTube, Reddit, Instagram, Facebook';
  $('genericToggle').textContent = granted ? 'Limit to the four listed sites' : 'Allow on all websites';
  return granted;
}

async function toggleGeneric() {
  // request() must be the first await in the click handler, or Chrome drops the user gesture.
  if (genericGranted) await chrome.permissions.remove({ origins: ALL });
  else await chrome.permissions.request({ origins: ALL });
  await chrome.runtime.sendMessage({ type: 'gta6ss:syncGeneric' }).catch(() => {});
  await refreshGeneric();
}

async function main() {
  fill(sanitizeSettings(await chrome.storage.sync.get(null)));
  refreshGeneric();
  $('save').addEventListener('click', save);
  $('reset').addEventListener('click', () => { fill(sanitizeSettings(DEFAULT_SETTINGS)); status('Defaults loaded. Click Save to keep them.'); });
  $('genericToggle').addEventListener('click', toggleGeneric);
  $('tryText').addEventListener('input', updateTry);
  for (const k of LIST_KEYS) $(k).addEventListener('input', updateTry);
  $('strict').addEventListener('change', updateTry);
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
  });
}

main();
