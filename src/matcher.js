/*
 * GTA 6 Spoiler Shield: spoiler matcher.
 *
 * Pure module: no DOM, no chrome.* APIs, no network. Works as a classic
 * content script (exposes globalThis.GTA6Matcher) and as a CommonJS module
 * (require('./matcher.js')) for unit tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GTA6Matcher = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const NOT_BLOCKED = Object.freeze({ blocked: false, reason: null });

  /**
   * Normalize text for matching:
   *  - Unicode NFKD, strip combining marks (diacritics), lowercase
   *  - every run of non-letter/non-digit characters becomes one space
   *  - spaced/dotted acronyms of 3+ single letters are joined ("G.T.A." -> "gta")
   */
  function normalize(input) {
    if (input == null) return '';
    let s = String(input)
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
    s = s.replace(/(?<![\p{L}\p{N}])\p{L}(?: \p{L}){2,}(?![\p{L}\p{N}])/gu, (m) => m.replace(/ /g, ''));
    return s;
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Turn one user term into a regex fragment.
   * Spaces between tokens are optional, so "GTA 6" also matches "GTA6" and "gta-6".
   * With plural=true, terms of 4+ chars ending in a letter also match +s / +es.
   */
  function termPattern(term, plural) {
    const n = normalize(term);
    if (!n) return null;
    let p = n.split(' ').map(escapeRe).join(' ?');
    if (plural && n.length >= 4 && /\p{L}$/u.test(n)) p += '(?:e?s)?';
    return p;
  }

  function compile(terms, { plural = false, global = false } = {}) {
    if (!Array.isArray(terms)) return null;
    const pats = [...new Set(terms.map((t) => termPattern(t, plural)).filter(Boolean))];
    if (!pats.length) return null;
    pats.sort((a, b) => b.length - a.length); // longest first
    return new RegExp('(?<![\\p{L}\\p{N}])(?:' + pats.join('|') + ')(?![\\p{L}\\p{N}])', global ? 'gu' : 'u');
  }

  /**
   * Build a matcher from settings.
   * @param {object} cfg { topicTerms, spoilerTerms, alwaysBlock, excludeTerms, strict }
   */
  function createMatcher(cfg = {}) {
    const topicRe = compile(cfg.topicTerms);
    const spoilerRe = compile(cfg.spoilerTerms, { plural: true });
    const alwaysRe = compile(cfg.alwaysBlock);
    const excludeRe = compile(cfg.excludeTerms, { global: true });
    const strict = !!cfg.strict;

    function stripExcluded(n) {
      return excludeRe ? n.replace(excludeRe, ' ') : n;
    }

    function findTopic(n) {
      if (!topicRe) return null;
      const m = topicRe.exec(stripExcluded(n));
      return m ? m[0] : null;
    }

    /** True when the text mentions a topic term (after exclusions). */
    function hasTopic(text) {
      return findTopic(normalize(text)) !== null;
    }

    /**
     * Decide whether a piece of text is a spoiler.
     * @param {string} text  text of one element (title, caption, alt text ...)
     * @param {object} [opts]
     * @param {boolean} [opts.contextHasTopic] the surrounding page/thread is
     *        already about GTA 6 (e.g. a comment under a GTA 6 video), so the
     *        topic requirement is satisfied even if `text` does not name it.
     * @returns {{blocked:boolean, reason:string|null, topic?:string, spoiler?:string, phrase?:string}}
     */
    function test(text, opts = {}) {
      const n = normalize(text);
      if (!n) return NOT_BLOCKED;

      if (alwaysRe) {
        const m = alwaysRe.exec(n);
        if (m) return { blocked: true, reason: 'always-block', phrase: m[0] };
      }

      const topic = findTopic(n);
      if (!topic && !opts.contextHasTopic) return NOT_BLOCKED;

      if (strict) return { blocked: true, reason: 'strict', topic: topic || '(context)' };

      if (spoilerRe) {
        const m = spoilerRe.exec(n);
        if (m) return { blocked: true, reason: 'topic+spoiler', topic: topic || '(context)', spoiler: m[0] };
      }
      return NOT_BLOCKED;
    }

    return { test, hasTopic };
  }

  return { normalize, createMatcher, _internal: { termPattern, compile } };
});
