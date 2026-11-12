/*
 * Per-site adapters. When a site changes its DOM, this is the file to edit.
 *
 * Adapter fields:
 *   id            short name, shown in the popup
 *   hosts         hostname regexes this adapter applies to
 *   units         card-like containers that get blurred/hidden as a whole
 *   blocks        (generic only) heading/paragraph/link elements checked when
 *                 they are not inside an eligible card
 *   maxUnitText   a unit whose own text is longer than this is not treated as a
 *                 card (e.g. a whole news article); its blocks are checked instead
 *   excludeNested true: a unit's text excludes nested units (Facebook comments
 *                 inside posts). false: nested units are covered by the outer one.
 *   attrs         extra attributes whose values count as text
 *   context(el)   optional; returns an Element or string describing what the
 *                 unit sits inside. If that context mentions GTA 6, the unit only
 *                 needs a spoiler term (e.g. a comment under a GTA 6 video).
 *   spaEvents     DOM events that signal single-page navigation
 */
(function (root) {
  'use strict';

  const YOUTUBE_COMMENTS = 'ytd-comment-view-model, ytd-comment-renderer, ytm-comment-renderer';

  const youtube = {
    id: 'youtube',
    hosts: [/(^|\.)youtube\.com$/],
    units: [
      // home, subscriptions, channel grids
      'ytd-rich-item-renderer', 'ytd-grid-video-renderer', 'yt-lockup-view-model',
      // search results
      'ytd-video-renderer', 'ytd-playlist-renderer', 'ytd-radio-renderer', 'ytd-movie-renderer',
      // watch-page sidebar, playlists, end screen
      'ytd-compact-video-renderer', 'ytd-compact-playlist-renderer', 'ytd-compact-radio-renderer',
      'ytd-playlist-video-renderer', 'ytd-playlist-panel-video-renderer',
      '.ytp-videowall-still', '.ytp-ce-element',
      // Shorts shelf + Shorts player
      'ytd-reel-item-renderer', 'ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2',
      'ytd-reel-video-renderer',
      // watch page title + description, community posts, comments, notifications
      'ytd-watch-metadata', 'ytd-post-renderer', 'ytd-backstage-post-renderer',
      YOUTUBE_COMMENTS, 'ytd-notification-renderer',
      // m.youtube.com
      'ytm-video-with-context-renderer', 'ytm-compact-video-renderer', 'ytm-reel-item-renderer',
      'ytm-rich-item-renderer',
    ],
    maxUnitText: Infinity,
    excludeNested: false,
    attrs: [],
    // Comments inherit the topic from the video they sit under (YouTube puts
    // the video title in document.title).
    context(el) {
      return el.matches(YOUTUBE_COMMENTS) ? document.title : null;
    },
    spaEvents: ['yt-navigate-finish', 'yt-page-data-updated'],
  };

  const reddit = {
    id: 'reddit',
    hosts: [/(^|\.)reddit\.com$/],
    units: [
      // new Reddit (shreddit web components)
      'shreddit-post', 'shreddit-comment > [slot="comment"]', '[data-testid="search-post-unit"]',
      'reddit-pdp-right-rail-post', 'community-highlight-card',
      // old.reddit.com
      '.thing.link', '.thing.comment > .entry', '.search-result',
    ],
    maxUnitText: Infinity,
    excludeNested: false,
    attrs: ['post-title', 'subreddit-prefixed-name', 'data-subreddit'],
    // The URL names the subreddit and, on comment pages, the post title slug
    // (/r/GTA6/comments/abc/lucia_ending_explained/), so comments on r/GTA6 or
    // under a GTA 6 thread only need a spoiler term. Posts carry their own
    // subreddit attribute (read as text), so they don't inherit the URL.
    context(el) {
      if (el.hasAttribute('subreddit-prefixed-name') || el.hasAttribute('data-subreddit')) return null;
      try { return decodeURIComponent(location.pathname); } catch (_) { return location.pathname; }
    },
    spaEvents: [],
  };

  const instagram = {
    id: 'instagram',
    hosts: [/(^|\.)instagram\.com$/],
    units: ['article', 'a[href*="/p/"]', 'a[href*="/reel/"]'],
    maxUnitText: Infinity,
    excludeNested: false,
    attrs: [],
    context: null,
    spaEvents: [],
  };

  const facebook = {
    id: 'facebook',
    hosts: [/(^|\.)facebook\.com$/],
    units: ['div[data-pagelet^="FeedUnit"]', 'div[aria-posinset]', '[role="article"]'],
    maxUnitText: Infinity,
    // Comments are role=article nested inside the post's role=article.
    excludeNested: true,
    attrs: [],
    context(el) {
      const parent = el.parentElement && el.parentElement.closest('[role="article"]');
      return parent || null;
    },
    spaEvents: [],
  };

  const generic = {
    id: 'generic',
    hosts: [],
    units: ['article', '[role="article"]', 'li', 'figure', '[class*="card" i]', '[class*="teaser" i]'],
    blocks: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'figcaption', 'blockquote', 'dd', 'dt', 'td', 'summary'],
    maxUnitText: 1500,
    excludeNested: false,
    attrs: [],
    // Paragraphs inside a long article that is about GTA 6 only need a spoiler term.
    context(el) {
      const art = el.closest('article, [role="article"]');
      if (art && art !== el && (art.textContent || '').length > 1500) return art;
      const og = document.querySelector('meta[property="og:type"]');
      if (og && /article/i.test(og.getAttribute('content') || '') && el.closest('main, [role="main"], article')) {
        return document.title + ' ' + ((document.querySelector('h1') || {}).textContent || '');
      }
      return null;
    },
    spaEvents: [],
  };

  const SITE_ADAPTERS = [youtube, reddit, instagram, facebook];

  function finalize(a) {
    return Object.assign({}, a, {
      unitSelector: a.units.join(', '),
      blockSelector: a.blocks ? a.blocks.join(', ') : null,
      allSelector: a.units.concat(a.blocks || []).join(', '),
    });
  }

  /** Pick the adapter for a hostname. `forceId` is only used by test fixtures. */
  function pick(hostname, forceId) {
    const all = SITE_ADAPTERS.concat(generic);
    if (forceId) {
      const f = all.find((a) => a.id === forceId);
      if (f) return finalize(f);
    }
    const a = SITE_ADAPTERS.find((ad) => ad.hosts.some((re) => re.test(hostname)));
    return finalize(a || generic);
  }

  root.GTA6Adapters = { pick, ids: SITE_ADAPTERS.concat(generic).map((a) => a.id) };
})(typeof globalThis !== 'undefined' ? globalThis : this);
