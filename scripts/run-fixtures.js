/*
 * Runs every fixture in headless Chrome and reports the self-check results.
 * Serves the repo on a localhost port (fixtures use history.pushState, which
 * file:// pages cannot). Set CHROME_PATH if Chrome is not in a standard place.
 *
 *   node scripts/run-fixtures.js            # all fixtures
 *   node scripts/run-fixtures.js --shots    # also save screenshots to fixtures/screenshots/
 *   node scripts/run-fixtures.js "news.html?mode=placeholder"   # specific runs
 */
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RUNS = [
  'youtube.html',
  'youtube.html?strict=1',
  'youtube.html?mode=placeholder',
  'reddit.html',
  'old-reddit.html',
  'instagram.html',
  'facebook.html',
  'news.html',
  'news.html?mode=collapse',
  'perf.html',
];

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);
const chrome = CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome) {
  console.log('SKIP: Chrome not found. Set CHROME_PATH, or open the fixtures/*.html files manually.');
  process.exit(0);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // SPA-style paths (e.g. /r/GTA6/comments/...) are only reached via pushState.
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

function run(url, extraArgs) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'spoileralert-'));
  const args = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, '--virtual-time-budget=15000', '--window-size=1100,1600',
    ...extraArgs, url,
  ];
  return new Promise((resolve) => {
    execFile(chrome, args, { maxBuffer: 64 * 1024 * 1024, timeout: 60000 }, (err, stdout) => {
      fs.rmSync(profile, { recursive: true, force: true });
      resolve({ err, stdout: stdout || '' });
    });
  });
}

function parse(dom) {
  const m = dom.match(/<pre id="spoileralert-results">([\s\S]*?)<\/pre>/);
  if (!m) return null;
  const json = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  try { return JSON.parse(json); } catch (_) { return null; }
}

server.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}/fixtures/`;
  const shots = process.argv.includes('--shots');
  const filters = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const runs = filters.length ? filters : RUNS;
  let failed = 0;
  for (const r of runs) {
    const { stdout } = await run(base + r, ['--dump-dom']);
    const res = parse(stdout);
    if (!res) {
      failed++;
      console.log(`FAIL ${r}: no results (page did not finish)`);
      continue;
    }
    const extra = r.startsWith('perf') ? ` (${res.ms} ms total, ${res.finalCounts && res.finalCounts.blocked} blocked)` : '';
    console.log(`${res.pass ? 'PASS' : 'FAIL'} ${r}: ${res.checks - res.failed}/${res.checks} checks${extra}`);
    for (const f of res.failures) console.log(`     [${f.step}] ${f.name}: expected ${f.expected}, got ${f.got}`);
    if (!res.pass) failed++;
    if (shots) {
      const dir = path.join(ROOT, 'fixtures', 'screenshots');
      fs.mkdirSync(dir, { recursive: true });
      const out = path.join(dir, r.replace(/[?=&]/g, '_') + '.png');
      await run(base + r, [`--screenshot=${out}`]);
    }
  }
  server.close();
  console.log(failed ? `\n${failed} fixture run(s) failed` : '\nall fixture runs passed');
  process.exit(failed ? 1 : 0);
});
