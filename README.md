# SpoilerAlert

**Block spoilers for anything you choose: games, movies, TV shows, books, sports.** SpoilerAlert is a Chrome extension (Manifest V3, plain JavaScript, no build step) that blurs, hides, or replaces spoilers on YouTube, Reddit, Instagram, Facebook, and, if you opt in, every other site.

It ships with a **GTA 6 example configuration**. Swap in your own titles and names on the Options page and it protects whatever you're waiting for.

Everything runs locally. The extension makes no network requests, loads no remote code, and collects no analytics.

> **New here? Follow the [step-by-step install guide](INSTALL.md).** No coding needed.

## Install (load unpacked)

1. Download this repo (**Code → Download ZIP**) and unzip it, or `git clone` it.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the folder that contains `manifest.json`.
5. Pin the extension from the puzzle-piece menu for quick access to the popup.
6. Optional: to cover news sites and every other page, open **Options** and click **Allow on all websites**. See [Permissions](#permissions-and-the-tradeoff).

After editing any file, click the reload icon on the extension's card in `chrome://extensions`, then reload the open tabs.

## Set it up for your own spoilers

Open **Options** (popup → "Edit keywords and settings"), click **Clear all lists**, fill in the four lists (one term per line), then click **Save**. Open tabs update immediately.

| List | What goes in it | Movie example | TV example | Sports example |
|---|---|---|---|---|
| **Topic terms** | The title you're avoiding, plus spellings and hashtags | `Dune Part Three`, `Dune 3`, `#DuneMovie` | `Severance`, `#SeveranceS3` | `Champions League final`, `UCL final` |
| **Spoiler terms** | Character/actor names, places, and spoiler words | `Paul`, `Chani`, `ending`, `dies`, `twist`, `post-credits` | `Mark`, `Helly`, `finale`, `dies`, `reveal` | `score`, `wins`, `beat`, `goal`, `highlights`, `result` |
| **Always-block phrases** | Hidden even without the title: leakers, spoiler accounts, very specific phrases | `Dune 3 leaked script` | `Innie Helly reveal` | `UCL final result` |
| **Never counts as the topic** | Look-alikes that should *not* count | `Dune Part Two`, `Dune 1984` | `severance pay`, `severance package` | `Europa League final` |

An item is hidden when it mentions a **topic term and a spoiler term**, or any **always-block phrase**. "Severance season 3 release date" stays visible; "Severance finale: Helly's choice" is hidden. You can protect several titles at once: put all their topic terms and spoiler terms in the same lists.

**Tips**
- Use the **Try it** box on the Options page to test a headline against your *unsaved* lists before saving.
- Turn on **Strict mode** to hide *everything* that mentions the title, spoiler words or not. This is useful for the week before you watch something.
- Short or common names ("Mark", "Cal") only count when the title is also mentioned, which keeps false positives down. Put them in **Spoiler terms**, not **Always-block**.
- **Load GTA 6 example** restores the shipped GTA 6 lists.

## How matching works

The matcher (`src/matcher.js`) is a pure module with no DOM access and is unit-tested in Node.

An element is hidden when **any** of these is true (examples use the GTA 6 preset):

| Rule | Example that is hidden | Example that stays visible |
|---|---|---|
| A **topic term** and a **spoiler term** appear in the same element | "GTA 6 leak shows Lucia" | "GTA 6 trailer 3 drops Tuesday" |
| An **always-block phrase** appears, even on its own | "New post from @cyberleek" | |
| **Strict mode** is on and a topic term appears | "GTA 6 price predictions" | "GTA 5 is still selling" |
| The element is a **comment or paragraph whose surroundings are about the topic** and it contains a spoiler term (see below) | Comment "Lucia dies at the end??" under a GTA 6 video | Comment "first!" under the same video |

Normalization: text is converted with Unicode NFKD, diacritics are stripped, and everything is lowercased. Runs of punctuation and whitespace collapse into one space, and spaced or dotted acronyms are joined ("G.T.A. 6" becomes "gta 6"). So `ＧＴＡ６`, `gta-6`, `#GTA6`, `GTA   6` and `Lúcía` all match. Matching respects word boundaries: "Cal" does not match "calendar", "dead" does not match "deadline", and "GTA 6" does not match "GTA 60". Spaces inside a term are optional, so `Cyber Leek` also matches `cyberleek`. Spoiler terms of 4+ letters also match plurals ("mission" → "missions").

**Look-alikes.** The "Never counts as the topic" list is removed from the text before the topic check. With the GTA 6 preset, "GTA 5 ending: Michael dies" is not hidden, even in strict mode, while "GTA 5 vs GTA 6: the ending compared" still is, because a real GTA 6 mention plus a spoiler term remains.

Settings sync across your Chrome profile via `chrome.storage.sync`. To change the shipped defaults, edit `DEFAULT_SETTINGS` in `src/defaults.js`.

## Display modes

Set the mode in the popup or on the Options page:

- **Blur, click to reveal** (default). A frosted overlay reading "Possible spoiler — click to reveal" covers the card. The first click (or Enter/Space) reveals the card instead of following its link, and hovering does not trigger the card's own behavior, such as YouTube's inline preview.
- **Collapse / hide**. The card is removed from the layout (`display: none`).
- **Placeholder**. The card is replaced with a 48px bar reading "Hidden: possible spoiler (click to show)".

The extension acts on the nearest card-like container (a video tile, post, comment, feed item, or news card), not on the whole page. All hiding is done with CSS attached to `data-spoileralert-*` attributes. The extension never inserts or removes the site's own DOM nodes, which avoids breaking React and Polymer apps.

**How long reveals last**
- A card you click is revealed until the page reloads. If the site later reuses that DOM node for different content (YouTube does this), the new content is checked again.
- **Reveal all for this tab session** (popup) turns off hiding for that tab only. The setting survives reloads and in-tab navigation and is cleared when you close the tab or restart the browser (stored in `chrome.storage.session`, keyed by tab id). The button then reads **Hide spoilers again**.

## Site adapters

Per-site selectors live in **`src/adapters.js`**. When a site changes its markup, that is the only file you should need to edit.

| Adapter | Containers it acts on | Notes |
|---|---|---|
| YouTube | `ytd-rich-item-renderer`, `ytd-video-renderer`, `ytd-compact-video-renderer` (watch-page sidebar), `ytd-reel-item-renderer`, `ytd-reel-video-renderer`, `ytm-shorts-lockup-view-model(-v2)`, `yt-lockup-view-model`, `ytd-watch-metadata` (title + description), comments, community posts, end-screen cards, m.youtube.com `ytm-*` | Rescans on `yt-navigate-finish`. Comments take the topic from the video title (`document.title`). |
| Reddit | `shreddit-post`, `shreddit-comment > [slot="comment"]` (the body only, so a spoiler reply doesn't hide its parent), search-result cards; old.reddit `.thing.link`, `.thing.comment > .entry`, `.search-result` | Reads the `post-title`, `subreddit-prefixed-name` and `data-subreddit` attributes. Anything in r/GTA6 counts as "about GTA 6", and comments take the topic from the URL (`/r/GTA6/…` or the post-title slug). **Search results are judged one card at a time, by title (and thumbnail alt text) only**: the subreddit, snippet and your search query are ignored, and a wrapper holding several results is never blurred as a whole. |
| Instagram | `article` (feed posts, including captions and image alt text), `a[href*="/p/"]`, `a[href*="/reel/"]` (grid tiles) | |
| Facebook | `[role="article"]`, `div[aria-posinset]`, `div[data-pagelet^="FeedUnit"]` | Nested comments are judged on their own text. A comment takes the topic from its parent post. |
| Generic (opt-in) | `article`, `[role="article"]`, `li`, `figure`, `[class*="card"]`, `[class*="teaser"]` up to 1,500 characters; outside such cards, `h1`–`h6`, `p`, `a`, `figcaption`, `blockquote`, `td`, … | A longer `article` (a full story page) is not hidden as a whole. Its paragraphs are checked instead, and a paragraph inside an article that mentions GTA 6 only needs a spoiler term. |

The text checked for each container is its visible text plus every `alt`, `aria-label` and `title` attribute inside it (and the adapter's extra attributes).

## Thumbnails: limitation

Text baked into a thumbnail image (for example a huge "LUCIA DIES?!" on a YouTube thumbnail) **cannot be read without OCR**, and this extension does not do OCR. A thumbnail is hidden only when its card is hidden, which happens when the matcher finds a match in:

- the thumbnail's `alt` text or `aria-label`,
- the title, description snippet, or other text of the video or post it belongs to.

A spoiler-laden thumbnail on a video with a neutral title and no alt text **will not be hidden**. If OCR is added later, it must run fully locally (for example a bundled Tesseract WASM build, with no CDN) and be off by default behind an Options toggle. It is not included now.

## Known limitations

- **Images and thumbnails**: see above. Text inside images, GIFs and memes is invisible to the extension.
- **Video and audio**: the YouTube player itself is not blurred, even when the watch-page title and description are. Spoilers spoken in a video, shown on screen, or in auto-generated captions are not detected.
- **Sites change their DOM**: YouTube, Reddit, Instagram and Facebook change markup often, and selectors in `src/adapters.js` may stop matching. Symptoms are that nothing gets hidden or the wrong-sized area gets hidden. Facebook and Instagram obfuscate class names, so those adapters rely on roles, attributes and `href` patterns only.
- **Closed shadow DOM**: Reddit's `shreddit-*` components use shadow DOM. The blur overlay still covers the whole component, but text that exists *only* inside a closed shadow root cannot be read. In practice the title, body and subreddit are in light DOM or attributes.
- **Screenshots and images of text** shared as posts (tweets screenshotted onto Instagram, for example) are not detected unless the platform's auto-generated alt text mentions the words.
- **The generic fallback misses things**: content that isn't in one of the elements listed above (text in `div`/`span` soup with no card-like container), canvas-rendered text, iframes (only the top frame is scanned), PDFs, and sites that render after long delays inside shadow DOM. A news card whose headline is GTA 6 news with no spoiler term is intentionally left visible.
- **Two-tier matching is a heuristic.** Expect some false positives (a GTA 6 "character creator" article) and false negatives (a spoiler that names no character and uses none of the words). Strict mode and always-block phrases are the escape hatches.
- **Plurals**: spoiler terms of 4+ letters also match `+s`/`+es` ("mission" → "missions"). Other inflections ("killing") must be added as separate terms.
- **Flash of content**: the script runs at `document_idle`, so a spoiler can be visible for a fraction of a second on first load, before the first scan finishes.
- **Collapse mode** has no per-item reveal (the item is gone). Use the popup's "Reveal all for this tab session".

## Permissions and the tradeoff

| Permission | Why |
|---|---|
| `storage` | Save settings (`sync`) and the per-tab "reveal all" flag (`session`). |
| `scripting` | Register the content script on all sites **only after** you grant the optional all-sites permission. This permission shows no install warning. |
| Content script matches for `youtube.com`, `reddit.com`, `instagram.com`, `facebook.com` | Run the shield on the four supported sites. Chrome shows "Read and change your data on www.youtube.com, …" at install time. |
| `optional_host_permissions: <all_urls>` | **Not granted by default.** Requested only when you click "Allow on all websites" in Options, and revocable there or in `chrome://extensions`. |

**The tradeoff.** Listing four sites is the narrowest access that covers the main use case, and the install warning names only those sites. The cost is that news sites and everything else get no protection. Granting `<all_urls>` turns on the generic fallback everywhere, but Chrome then (correctly) warns that the extension can "read and change all your data on all websites". The code is the same either way and never sends anything anywhere, but you are trusting this code with every page you open. A middle ground, not implemented, would be a per-site allow-list using `chrome.permissions.request` for individual origins.

No `tabs`, `activeTab`, `webRequest`, `history` or `cookies` permission is used. The popup gets the active tab's id from `chrome.tabs.query`, which needs no permission when no URL is read.

## Default settings and design choices

- Extra default spoiler terms beyond the spec: `spoiler`, `death`, `betrayal`, `cutscene`, `storyline`, plus leaked-material wording: `footage`, `gameplay`, `datamine(d)`, `early copy`, `insider`. These also hide official "gameplay trailer" posts; remove them in Options if you only care about story spoilers. The always-block list starts with `Cyber Leek` (a leaker; also matches `cyberleek`, `@cyberleek`, `Cyber-Leek`).
- Topic variants: GTA 6 / GTA6 / GTA-6 / GTA VI / GTAVI / GTA Six / Grand Theft Auto 6 / VI / Six.
- "Same element" means the same card-like container (title + description + alt text of one video tile counts as one element).
- Context topic: comments under a GTA 6 video, comments in a GTA 6 Reddit thread, posts on r/GTA6, comments under a GTA 6 Facebook post, and paragraphs inside a long GTA 6 article only need a spoiler term.
- Reveal-all scope is per tab, cleared on tab close or browser restart. Single-card reveals last until the page reloads.
- The generic fallback is opt-in (narrowest permissions by default).
- Debounce: 150 ms trailing, capped at 600 ms so continuously mutating pages still get scanned. Work is chunked into ~12 ms slices to avoid jank.
- Only the top frame is scanned.
- Minimum Chrome version: 110.

## How it works (performance)

- One `MutationObserver` on the document watches `childList`, `characterData`, and the attributes `alt`/`aria-label`/`title` (plus adapter extras). Our own `data-spoileralert-*` attributes are not observed, so the script never re-triggers itself.
- Added subtrees are scanned deeply. Text and attribute changes only re-check the enclosing containers.
- Each checked container's fingerprint (its text plus the context flag) is stored in a `WeakMap`, which works as a processed-node set that also detects text changes. An unchanged container is skipped. Changed text (for example YouTube recycling a tile for a different video) is re-checked and un-hidden if it no longer matches.
- Single-page navigation is handled through `yt-navigate-finish`, `popstate`, and a URL-change check on every scan.

## Development

```
npm test                 # matcher unit tests (node:test, no dependencies)
npm run test:fixtures    # runs fixtures/*.html in headless Chrome and checks expectations
npm run test:fixtures -- --shots   # also writes screenshots to fixtures/screenshots/
npm run icons            # regenerate icons/*.png
```

**Fixtures** (`fixtures/*.html`) are static pages that mimic each site's markup (YouTube, new and old Reddit, Instagram, Facebook, a news site, and a 5,000-card stress page). They load the real content script through a small `chrome.*` shim (`fixtures/harness/chrome-shim.js`). Elements carry `data-expect="blocked|visible|revealed"`. The harness runs scripted steps (infinite scroll, recycled nodes, click-to-reveal, SPA navigation, attribute changes) and reports PASS/FAIL in the page title and on the page. You can also serve the folder (`python3 -m http.server`) and open `http://localhost:8000/fixtures/youtube.html` in any browser. Query options: `?mode=collapse|placeholder`, `?strict=1`, `?always=phrase1|phrase2`.

## File tree

```
manifest.json
src/
  matcher.js      pure matcher (no DOM), UMD: content script + Node
  defaults.js     default lists, settings sanitizer
  adapters.js     per-site selectors  <- edit when sites change
  content.js      scanning, observer, marking, click-to-reveal
  content.css     blur / collapse / placeholder styles
  background.js   service worker: per-tab reveal-all, badge, opt-in all-sites registration
popup/            on/off, mode, count, reveal-all
options/          lists, strict mode, display mode, try-it box, all-sites toggle
test/matcher.test.js
scripts/run-fixtures.js, scripts/make-icons.js
fixtures/*.html, fixtures/harness/
icons/
```
