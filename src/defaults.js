/*
 * Default settings and settings sanitizer. Shared by the content script,
 * popup, options page and service worker. No DOM access.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GTA6Defaults = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MODES = ['blur', 'collapse', 'placeholder'];

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    mode: 'blur',
    strict: false,
    topicTerms: [
      'GTA 6', 'GTA6', 'GTA-6', 'GTA VI', 'GTAVI', 'GTA Six',
      'Grand Theft Auto 6', 'Grand Theft Auto VI', 'Grand Theft Auto Six',
    ],
    spoilerTerms: [
      'Jason', 'Lucia', 'Booby', 'Cal', 'Raul',
      'killed', 'kills', 'ending', 'leak', 'leaked', 'plot', 'twist',
      'dies', 'dead', 'secret', 'mission', 'character',
      'spoiler', 'death', 'betrayal', 'cutscene', 'storyline',
      // leaked-material wording ("new gameplay footage just dropped")
      'footage', 'gameplay', 'datamine', 'datamined', 'early copy', 'insider',
    ],
    alwaysBlock: [],
    excludeTerms: [
      'GTA 5', 'GTA V', 'Grand Theft Auto V', 'GTA Online', 'GTA San Andreas',
      'GTA IV', 'GTA 4', 'GTA Vice City',
    ],
  });

  const LIST_KEYS = ['topicTerms', 'spoilerTerms', 'alwaysBlock', 'excludeTerms'];
  const MAX_TERMS = 300;
  const MAX_TERM_LEN = 120;

  function cleanList(list, fallback) {
    if (!Array.isArray(list)) return [...fallback];
    const seen = new Set();
    const out = [];
    for (const raw of list) {
      if (typeof raw !== 'string') continue;
      const t = raw.trim().slice(0, MAX_TERM_LEN);
      const k = t.toLowerCase();
      if (!t || seen.has(k)) continue;
      seen.add(k);
      out.push(t);
      if (out.length >= MAX_TERMS) break;
    }
    return out;
  }

  function sanitizeSettings(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const s = {
      enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_SETTINGS.enabled,
      mode: MODES.includes(r.mode) ? r.mode : DEFAULT_SETTINGS.mode,
      strict: typeof r.strict === 'boolean' ? r.strict : DEFAULT_SETTINGS.strict,
    };
    for (const k of LIST_KEYS) s[k] = cleanList(r[k], DEFAULT_SETTINGS[k]);
    return s;
  }

  /** Parse a textarea (one term per line) into a list. */
  function parseList(text) {
    return String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }

  return { MODES, DEFAULT_SETTINGS, LIST_KEYS, sanitizeSettings, parseList };
});
