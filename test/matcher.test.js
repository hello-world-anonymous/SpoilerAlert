'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, createMatcher } = require('../src/matcher.js');
const { DEFAULT_SETTINGS, sanitizeSettings, parseList } = require('../src/defaults.js');

const m = createMatcher(DEFAULT_SETTINGS);
const strict = createMatcher({ ...DEFAULT_SETTINGS, strict: true });
const blocked = (matcher, text, opts) => matcher.test(text, opts).blocked;

test('normalize: case, NFKD, diacritics, punctuation, spacing', () => {
  assert.equal(normalize('  GTA   6!!  '), 'gta 6');
  assert.equal(normalize('Lúcía Caminos'), 'lucia caminos');
  assert.equal(normalize('ＧＴＡ６'), 'gta6'); // fullwidth -> ASCII via NFKD
  assert.equal(normalize('G.T.A. 6'), 'gta 6'); // dotted acronym joined
  assert.equal(normalize('GTA—6 / leak'), 'gta 6 leak');
  assert.equal(normalize('Jason’s'), 'jason s');
  assert.equal(normalize(null), '');
});

test('two-tier: topic + spoiler blocks, either alone does not', () => {
  assert.equal(blocked(m, 'GTA 6 leak shows Lucia'), true);
  assert.equal(blocked(m, 'GTA 6 trailer 3 drops Tuesday'), false); // topic only
  assert.equal(blocked(m, 'Lucia dies at the end'), false); // spoiler only
  assert.equal(blocked(m, 'Jason Momoa new movie'), false);
  const r = m.test('Huge GTA VI plot twist');
  assert.equal(r.reason, 'topic+spoiler');
  assert.equal(r.topic, 'gta vi');
});

test('topic variants and case/spacing insensitivity', () => {
  for (const t of [
    'gta 6 ending', 'GTA6 ending', 'gta-6 ending', 'GTA VI ending', 'gtavi ending',
    'GTA Six ending', 'Grand Theft Auto VI ending', 'grand theft auto 6 ENDING',
    '#GTA6 #ending', 'G.T.A. 6 ending', 'GTA     6     ending', 'gta_6_ending_explained',
    'ＧＴＡ６ ending',
  ]) assert.equal(blocked(m, t), true, t);
});

test('leaked-footage wording counts as a spoiler', () => {
  assert.equal(blocked(m, 'BREAKING: New GTA 6 gameplay footage just dropped'), true);
  assert.equal(blocked(m, 'GTA 6 datamined map'), true);
  assert.equal(blocked(m, 'GTA 6 price announced'), false);
});

test('diacritics in spoiler terms', () => {
  assert.equal(blocked(m, 'GTA 6: Lúcía’s fate'), true);
  assert.equal(blocked(m, 'GTA 6 Raúl'), true);
});

test('word boundaries', () => {
  assert.equal(blocked(m, 'GTA 6 calendar of events'), false); // "cal" in "calendar"
  assert.equal(blocked(m, 'GTA 6 deadline'), false); // "dead" in "deadline"
  assert.equal(blocked(m, 'GTA 60 fps leak'), false); // "gta 60" is not "gta 6"
  assert.equal(blocked(m, 'mygta6 ending'), false);
  assert.equal(blocked(m, 'GTA 6 Cal is back'), true);
  assert.equal(blocked(m, 'GTA 6 missions ranked'), true); // plural of "mission"
  assert.equal(blocked(m, 'GTA 6 leaks'), true);
});

test('GTA 5 / Online / San Andreas do not count as the topic', () => {
  assert.equal(blocked(m, 'GTA 5 ending explained: Michael dies'), false);
  assert.equal(blocked(m, 'GTA V I loved the ending'), false); // not "GTA VI"
  assert.equal(blocked(m, 'GTA Online new mission leaked'), false);
  assert.equal(blocked(m, 'GTA San Andreas ending'), false);
  assert.equal(blocked(strict, 'GTA 5 is still selling'), false);
  assert.equal(blocked(strict, 'GTA Online weekly update'), false);
  // ...but they don't hide a real GTA 6 mention in the same element
  assert.equal(blocked(m, 'GTA 5 vs GTA 6: the ending compared'), true);
});

test('exclusions also protect a broad user topic term like "GTA"', () => {
  const broad = createMatcher({ ...DEFAULT_SETTINGS, topicTerms: ['GTA'] });
  assert.equal(blocked(broad, 'GTA 5 ending'), false);
  assert.equal(blocked(broad, 'GTA Online mission'), false);
  assert.equal(blocked(broad, 'new GTA ending leaked'), true);
});

test('strict mode blocks any topic match', () => {
  assert.equal(blocked(strict, 'GTA 6 trailer 3 drops Tuesday'), true);
  assert.equal(strict.test('GTA VI price').reason, 'strict');
  assert.equal(blocked(strict, 'Lucia dies'), false); // still needs the topic
});

test('always-block phrases match on their own', () => {
  const a = createMatcher({ ...DEFAULT_SETTINGS, alwaysBlock: ['Lucia dies', 'Boobie Ike'] });
  assert.equal(blocked(a, 'I cannot believe LUCIA  DIES'), true);
  assert.equal(a.test('boobie ike cameo').reason, 'always-block');
  assert.equal(blocked(a, 'Lucia diesel engine'), false);
});

test('user-added spoiler terms', () => {
  const c = createMatcher({ ...DEFAULT_SETTINGS, spoilerTerms: ['Port Gellhorn', "Dre'Quan"] });
  assert.equal(blocked(c, 'GTA 6 map: Port Gellhorn revealed'), true);
  assert.equal(blocked(c, 'GTA 6 Dre Quan cameo'), true);
  assert.equal(blocked(c, 'GTA 6 ending'), false); // defaults replaced
});

test('context topic: comments under a GTA 6 video/thread', () => {
  assert.equal(blocked(m, 'Lucia dies at the end', { contextHasTopic: true }), true);
  assert.equal(blocked(m, 'first!', { contextHasTopic: true }), false);
  assert.equal(m.hasTopic('/r/GTA6/comments/abc/lucia_ending/'), true);
  assert.equal(m.hasTopic('/r/GTA5/'), false);
});

test('empty and odd configs are safe', () => {
  const e = createMatcher({});
  assert.equal(blocked(e, 'GTA 6 ending'), false);
  const regexy = createMatcher({ topicTerms: ['GTA (6)'], spoilerTerms: ['a+b', '[x]'] });
  assert.equal(blocked(regexy, 'gta 6 a b'), true);
  assert.equal(blocked(m, ''), false);
  assert.equal(blocked(m, undefined), false);
});

test('settings sanitizer and list parser', () => {
  const s = sanitizeSettings({ mode: 'bogus', strict: 'yes', topicTerms: [' GTA 6 ', 'gta 6', 42, ''] });
  assert.equal(s.mode, 'blur');
  assert.equal(s.strict, false);
  assert.deepEqual(s.topicTerms, ['GTA 6']);
  assert.deepEqual(s.spoilerTerms, DEFAULT_SETTINGS.spoilerTerms);
  assert.deepEqual(parseList('a\n\n  b \r\nc'), ['a', 'b', 'c']);
});
