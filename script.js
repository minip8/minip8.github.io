'use strict';

const app = document.getElementById('app');
const themeToggle = document.getElementById('theme-toggle');

const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
const THEME_STORAGE_KEY = 'minip8-theme';

const posts = [
  {
    slug: 'rs-neuralnet',
    title: 'Rust neural net',
    date: '12-04-2026',
    categories: ['Rust', 'ML'],
    excerpt: 'A blazingly slow neural net',
    path: 'content/projects/rs-neuralnet/index.md',
  },
  {
    slug: 'cpp-exchange',
    title: 'C++ exchange',
    date: '26-07-2026',
    categories: ['C++'],
    excerpt: 'A modern exchange',
    path: 'content/projects/exchange/index.md',
  },
  {
    slug: 'unswbc26',
    title: 'UNSW Battlecode 2026',
    date: '16-10-2026',
    categories: ['Battlecode'],
    excerpt: '@Claude',
    path: 'content/projects/unswbc26/index.md',
  },
  {
    slug: 'mac-poker-bot',
    title: 'MAC Poker Bot',
    date: '20-10-2026',
    categories: ['Hackathon', 'ML'],
    excerpt: 'merch where',
    path: 'content/projects/mac-poker-bot/index.md',
  },
];

function setTheme(theme) {
  const resolvedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = resolvedTheme;
  localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
  document.documentElement.style.colorScheme = resolvedTheme;
  if (themeToggle) {
    // Icon swap is CSS-driven off data-theme; only the label changes here.
    const label = `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`;
    themeToggle.setAttribute('aria-label', label);
    themeToggle.setAttribute('title', label);
  }
  const themeColor = resolvedTheme === 'dark' ? '#111111' : '#ffffff';
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', themeColor);
  }
}

function getPreferredTheme() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return themeMedia.matches ? 'dark' : 'light';
}

setTheme(getPreferredTheme());

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  });
}

function handleSystemThemeChange(event) {
  if (!localStorage.getItem(THEME_STORAGE_KEY)) {
    setTheme(event.matches ? 'dark' : 'light');
  }
}

if (typeof themeMedia.addEventListener === 'function') {
  themeMedia.addEventListener('change', handleSystemThemeChange);
} else if (typeof themeMedia.addListener === 'function') {
  // iOS Safari < 14 uses addListener/removeListener on MediaQueryList.
  themeMedia.addListener(handleSystemThemeChange);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractMathSegments(markdownText) {
  const segments = [];
  let protectedText = String(markdownText);

  // Preserve display math first so inline replacement does not split it.
  protectedText = protectedText.replace(/\$\$[\s\S]+?\$\$/g, (match) => {
    const token = `@@MATH_${segments.length}@@`;
    segments.push(match);
    return token;
  });

  protectedText = protectedText.replace(/\\\[[\s\S]+?\\\]/g, (match) => {
    const token = `@@MATH_${segments.length}@@`;
    segments.push(match);
    return token;
  });

  // Inline math (single-line) after display math placeholders are in place.
  protectedText = protectedText.replace(/(?<!\\)\$(?!\$)([^\n$]|\\\$)+?(?<!\\)\$/g, (match) => {
    const token = `@@MATH_${segments.length}@@`;
    segments.push(match);
    return token;
  });

  protectedText = protectedText.replace(/\\\([^\n]+?\\\)/g, (match) => {
    const token = `@@MATH_${segments.length}@@`;
    segments.push(match);
    return token;
  });

  return { protectedText, segments };
}

function restoreMathSegments(html, segments) {
  return html.replace(/@@MATH_(\d+)@@/g, (_, idx) => {
    const segment = segments[Number(idx)];
    return segment ? escapeHtml(segment) : '';
  });
}

const dateFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' });

function parsePostDate(value) {
  const match = /^([0-3]?\d)-([0-1]?\d)-(\d{4})$/.exec(String(value).trim());
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return new Date(value);
}

function formatDate(value) {
  // `posts` dates are dd-mm-yyyy. This must be parsed explicitly and *before*
  // any new Date() attempt: JS reads a bare `04-12-2026` as mm-dd-yyyy and would
  // silently render 4 December as "Apr 12". The explicit parse also sidesteps
  // mobile Safari's stricter Date parser.
  const match = /^([0-3]?\d)-([0-1]?\d)-(\d{4})$/.exec(String(value).trim());
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const parsed = new Date(year, month - 1, day);
    // Reject overflow (e.g. 31-02-2026 rolling into March).
    if (parsed.getDate() === day && parsed.getMonth() === month - 1) {
      return dateFormatter.format(parsed);
    }
  }

  // Anything else (ISO strings, etc.) falls back to the native parser.
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return dateFormatter.format(parsed);
  }

  return String(value);
}

// ---------------------------------------------------------------------------
// Home: About → Posts timeline (with the car) → Contact
// ---------------------------------------------------------------------------

const DAY_MS = 86400000;
const CONTACT_ENDPOINT = 'https://minip8.com/api/contact';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Car swerve: x follows a sine of distance driven; the car points along its path.
const SWERVE_AMPLITUDE = 44; // px either side of centre
const SWERVE_PERIOD = 560; // px of driving per full left-right-left weave
const SWERVE_EASE = 240; // px over which the swerve fades in off the grid / out at the finish
// Where the car parks on the starting grid, from the top of .lane. Must match
// .car-pin's margin-top and the pole slot in GRID_SVG.
const CAR_PARK_OFFSET = 106;
const CAR_HEIGHT = 62;

const timeline = { reversed: false };
const car = { facingUp: false, lastScrollY: window.scrollY };

function chronologicalPosts() {
  return [...posts].sort((a, b) => parsePostDate(a.date) - parsePostDate(b.date));
}

function daysBetween(a, b) {
  return Math.round(Math.abs(parsePostDate(b.date) - parsePostDate(a.date)) / DAY_MS);
}

const CAR_SVG = `
  <svg class="car" id="car" viewBox="0 0 40 88" focusable="false">
    <rect x="2" y="2" width="36" height="7" rx="1.5" fill="#141311" />
    <rect class="car-livery" x="4" y="3.5" width="32" height="3" rx="1" />
    <rect x="0" y="12" width="9" height="17" rx="3" fill="#141311" />
    <rect x="31" y="12" width="9" height="17" rx="3" fill="#141311" />
    <path class="car-livery" d="M15 8 H25 L28 30 L30 50 L24 62 L22 80 H18 L16 62 L10 50 L12 30 Z" />
    <path d="M19 10 H21 V80 H19 Z" fill="#f5f2ec" opacity="0.9" />
    <ellipse cx="20" cy="42" rx="4.5" ry="6" fill="#141311" />
    <rect x="1" y="58" width="8" height="14" rx="3" fill="#141311" />
    <rect x="31" y="58" width="8" height="14" rx="3" fill="#141311" />
    <rect x="3" y="80" width="34" height="6" rx="2" fill="#141311" />
    <rect class="car-livery" x="5" y="81.5" width="30" height="3" rx="1" />
  </svg>
`;

// Starting grid painted at the top of the lane: two empty staggered slots,
// the pole slot the car parks in, and the start line just ahead of it.
const GRID_SVG = `
  <svg class="start-grid" viewBox="0 0 160 190" focusable="false">
    <path d="M22 58 V70 H58 V58" />
    <path d="M102 98 V110 H138 V98" />
    <path d="M60 140 V152 H100 V140" />
    <text x="40" y="86">P3</text>
    <text x="120" y="126">P2</text>
    <rect class="start-line" x="16" y="166" width="128" height="6" rx="1" />
  </svg>
`;

function homePage() {
  return `
    <section class="hero" id="about" aria-labelledby="hero-title">
      <div class="start-lights" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span class="is-off"></span>
      </div>
      <h1 id="hero-title">A lap through my experiences</h1>
      <p>I'm a computer science student who enjoys solving cool problems and exploring the intricacies of computers.</p>
    </section>

    <section class="timeline-section" id="posts" aria-labelledby="posts-heading">
      <div class="timeline-head">
        <div class="timeline-title">
          <h2 id="posts-heading">Posts</h2>
          <span class="timeline-order" id="timeline-order"></span>
        </div>
        <button class="pill-button" id="reverse-track" type="button" aria-pressed="false">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" /></svg>
          Reverse track
        </button>
      </div>

      <div class="track">
        <div class="lane" id="lane" aria-hidden="true">
          ${GRID_SVG}
          <div class="finish-line"></div>
          <div class="car-pin">
            <div class="car-sway" id="car-sway">${CAR_SVG}</div>
          </div>
        </div>

        <div class="track-content">
          <div class="track-start"></div>
          <ol class="track-list" id="track-list"></ol>
          <div class="track-finish"></div>
        </div>
      </div>

      <div class="lap-again">
        <p class="track-marker">
          <span>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 21V4" /><path d="M5 4h13l-2.5 4L18 12H5" /></svg>
            <span id="finish-label"></span>
          </span>
        </p>
        <button class="race-button" id="another-lap" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
          Another lap?
        </button>
      </div>
    </section>

    <section class="contact-section" id="contact" aria-labelledby="contact-heading">
      <h2 id="contact-heading">Contact me</h2>
      <div id="contact-body">${contactFormMarkup()}</div>
    </section>
  `;
}

function renderTimeline() {
  const list = document.getElementById('track-list');
  if (!list) return;

  const chrono = chronologicalPosts();
  const latest = chrono[chrono.length - 1];
  const ordered = timeline.reversed ? [...chrono].reverse() : chrono;

  list.innerHTML = ordered
    .map((post, i) => {
      const gap =
        i === 0
          ? ''
          : (() => {
              const days = daysBetween(ordered[i - 1], post);
              const label = `${timeline.reversed ? '−' : '+'}${days} ${days === 1 ? 'day' : 'days'}`;
              return `<div class="track-gap"><span>${label}</span></div>`;
            })();
      const latestTag = post === latest ? ' · <span class="post-card-latest">Latest</span>' : '';
      return `
        <li>
          ${gap}
          <article class="post-card reveal">
            <p class="post-card-meta">${formatDate(post.date)}${latestTag}</p>
            <h3><a href="#project/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3>
            <p class="post-card-excerpt">${escapeHtml(post.excerpt)}</p>
            <div class="tag-row">${post.categories.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
          </article>
        </li>
      `;
    })
    .join('');

  document.getElementById('timeline-order').textContent = timeline.reversed
    ? 'newest first'
    : 'oldest first';
  document.getElementById('reverse-track').setAttribute('aria-pressed', String(timeline.reversed));
  document.getElementById('finish-label').textContent = timeline.reversed
    ? 'FINISH · WHERE IT ALL BEGAN'
    : 'FINISH · NEXT LAP SOON';
  updateCar();
}

function updateCar() {
  const lane = document.getElementById('lane');
  const sway = document.getElementById('car-sway');
  const carEl = document.getElementById('car');
  if (!lane || !sway || !carEl) return;

  // How far the car has driven from its grid slot. CSS sticky does the actual
  // moving; this mirrors it so the swerve only runs while the car is moving,
  // easing in as it leaves the grid and out as it reaches the finish.
  const laneRect = lane.getBoundingClientRect();
  const stickyTop = window.innerHeight / 2 - CAR_HEIGHT / 2;
  const maxTravel = Math.max(0, laneRect.height - CAR_PARK_OFFSET - CAR_HEIGHT);
  const travel = Math.min(Math.max(stickyTop - (laneRect.top + CAR_PARK_OFFSET), 0), maxTravel);
  const ease = Math.max(0, Math.min(1, travel / SWERVE_EASE, (maxTravel - travel) / SWERVE_EASE));

  const amplitude = reducedMotion.matches ? 0 : SWERVE_AMPLITUDE * ease;
  const phase = (2 * Math.PI * travel) / SWERVE_PERIOD;
  const x = amplitude * Math.sin(phase);
  const slope = amplitude * ((2 * Math.PI) / SWERVE_PERIOD) * Math.cos(phase);
  const angle = (-Math.atan(slope) * 180) / Math.PI;
  sway.style.transform = `translateX(${x.toFixed(1)}px) rotate(${angle.toFixed(1)}deg)`;

  // Always drive forwards: face the way the page is scrolling. Parked on the
  // grid, it faces down the track ready to start.
  carEl.classList.toggle('is-facing-up', travel > 0 && car.facingUp);
}

let carFrame = 0;
window.addEventListener(
  'scroll',
  () => {
    if (carFrame) return;
    carFrame = requestAnimationFrame(() => {
      carFrame = 0;
      const delta = window.scrollY - car.lastScrollY;
      if (Math.abs(delta) > 2) car.facingUp = delta < 0;
      car.lastScrollY = window.scrollY;
      updateCar();
    });
  },
  { passive: true }
);
window.addEventListener('resize', updateCar);

function bindTimeline() {
  document.getElementById('reverse-track')?.addEventListener('click', () => {
    timeline.reversed = !timeline.reversed;
    renderTimeline();
  });

  document.getElementById('another-lap')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  });
}

function contactFormMarkup() {
  return `
    <form class="contact-form" id="contact-form" novalidate>
      <div class="field">
        <label for="cf-name">Name</label>
        <input id="cf-name" name="name" type="text" autocomplete="name" maxlength="100" required />
      </div>
      <div class="field">
        <label for="cf-email">Your email</label>
        <input id="cf-email" name="email" type="email" autocomplete="email" maxlength="200" required />
      </div>
      <div class="field field-wide">
        <label for="cf-message">Message</label>
        <textarea id="cf-message" name="message" rows="6" maxlength="5000" required></textarea>
      </div>
      <div class="hp-field" aria-hidden="true">
        <label for="cf-website">Leave this empty</label>
        <input id="cf-website" name="website" type="text" tabindex="-1" autocomplete="off" />
      </div>
      <div class="form-actions">
        <button class="submit-button" id="contact-submit" type="submit">
          <span id="contact-submit-label">Send message</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
        <p class="form-error" id="contact-error" role="alert"></p>
      </div>
    </form>
  `;
}

function contactSentMarkup() {
  return `
    <div class="contact-sent" role="status">
      <p>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        Message sent — thanks!
      </p>
      <button class="pill-button" id="contact-again" type="button">Send another</button>
    </div>
  `;
}

function bindContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.getElementById('contact-error');
    const button = document.getElementById('contact-submit');
    const label = document.getElementById('contact-submit-label');
    error.textContent = '';

    if (!form.reportValidity()) return;

    button.disabled = true;
    label.textContent = 'Sending…';

    try {
      const response = await fetch(CONTACT_ENDPOINT, { method: 'POST', body: new FormData(form) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Could not send right now. Please try again later.');
      }
      const body = document.getElementById('contact-body');
      body.innerHTML = contactSentMarkup();
      document.getElementById('contact-again').addEventListener('click', () => {
        body.innerHTML = contactFormMarkup();
        bindContactForm();
        document.getElementById('cf-name').focus();
      });
    } catch (err) {
      error.textContent =
        err instanceof TypeError
          ? 'Could not reach the server. Check your connection and try again.'
          : err.message;
      button.disabled = false;
      label.textContent = 'Send message';
    }
  });
}

function renderFooter() {
  const year = document.getElementById('footer-year');
  if (year) year.textContent = String(new Date().getFullYear());

  const stats = document.getElementById('footer-stats');
  const chrono = chronologicalPosts();
  if (stats && chrono.length) {
    const days = daysBetween(chrono[0], chrono[chrono.length - 1]);
    stats.textContent = `${chrono.length} ${chrono.length === 1 ? 'post' : 'posts'} · ${days} days on track`;
  }
}


function projectPage(post) {
  return `
    <article class="project-page">
      <div class="project-head">
        <a class="back-link" href="#posts">Back to posts</a>
        <h1>${escapeHtml(post.title)}</h1>
      </div>
      <section class="markdown-card project-content">
        <div id="markdown-root" class="markdown-body">
          <p class="loading">Loading markdown…</p>
        </div>
      </section>
    </article>
  `;
}

function resolveRelativeAssetUrls(html, markdownPath) {
  if (!markdownPath) {
    return html;
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const markdownUrl = new URL(markdownPath, window.location.href);
  const baseUrl = new URL('./', markdownUrl);
  const isRelative = (value) => {
    if (!value) return false;
    return !/^(?:[a-z]+:|\/\/|#|\/)/i.test(value);
  };

  container.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (isRelative(src)) {
      img.setAttribute('src', new URL(src, baseUrl).pathname);
    }
  });

  container.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (isRelative(href)) {
      anchor.setAttribute('href', new URL(href, baseUrl).pathname);
    }
  });

  return container.innerHTML;
}

function sanitizeMarkdown(markdownText, markdownPath) {
  if (window.marked && window.DOMPurify) {
    const { protectedText, segments } = extractMathSegments(markdownText);
    marked.setOptions({ gfm: true, breaks: false });
    const parsedHtml = marked.parse(protectedText);
    const htmlWithMath = restoreMathSegments(parsedHtml, segments);
    const sanitizedHtml = DOMPurify.sanitize(htmlWithMath);
    return resolveRelativeAssetUrls(sanitizedHtml, markdownPath);
  }

  return `<pre>${escapeHtml(markdownText)}</pre>`;
}

async function loadMarkdown(post) {
  const root = document.getElementById('markdown-root');
  if (!root) return;

  try {
    const response = await fetch(post.path, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load ${post.path}`);
    }

    root.innerHTML = sanitizeMarkdown(await response.text(), post.path);
    if (window.MathJax?.typesetPromise) {
      await window.MathJax.typesetPromise([root]);
    }
  } catch (error) {
    root.innerHTML = `
      <div class="markdown-error">
        <h2>Markdown not available</h2>
        <p>Check that <code>${escapeHtml(post.path)}</code> exists.</p>
      </div>
    `;
  }
}

// Sections on the home page that the nav can jump to.
const HOME_SECTIONS = ['home', 'about', 'posts', 'contact'];

function showHome(section) {
  // Re-render only when coming from elsewhere, so jumping between sections
  // keeps the timeline's direction and anything typed in the form.
  if (!document.getElementById('track-list')) {
    app.innerHTML = homePage();
    renderTimeline();
    bindTimeline();
    bindContactForm();
  }

  const target = section === 'home' ? null : document.getElementById(section);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

async function renderRoute() {
  const hash = window.location.hash.slice(1) || 'home';

  if (HOME_SECTIONS.includes(hash)) {
    showHome(hash);
    return;
  }

  if (hash.startsWith('project/')) {
    const slug = decodeURIComponent(hash.slice('project/'.length));
    const post = posts.find((item) => item.slug === slug);

    if (!post) {
      app.innerHTML = `
        <section class="intro error-view">
          <p class="eyebrow">404</p>
          <h1>That project does not exist.</h1>
          <p class="intro-copy">Go back to the posts list and choose a different writeup.</p>
          <a class="back-link" href="#posts">Return to posts</a>
        </section>
      `;
      return;
    }

    app.innerHTML = projectPage(post);
    await loadMarkdown(post);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  showHome('home');
}

window.addEventListener('hashchange', renderRoute);
renderFooter();
renderRoute();
