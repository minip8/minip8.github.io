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

function homePage() {
  return `
    <section class="posts-panel posts-page" aria-labelledby="posts-heading">
      <div class="section-head">
        <h2 id="posts-heading">Posts</h2>
        <p>${posts.length} entries</p>
      </div>
      <div class="posts-list">
        ${[...posts]
          .sort((a, b) => parsePostDate(b.date) - parsePostDate(a.date))
          .map(
            (post) => `
              <article class="post-row">
                <div class="post-meta">${formatDate(post.date)}</div>
                <div class="post-body">
                  <h3><a href="#project/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3>
                  <p>${escapeHtml(post.excerpt)}</p>
                  <div class="tag-row">${post.categories.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
                </div>
              </article>
            `
          )
          .join('')}
      </div>
    </section>
  `;
}

function aboutPage() {
  return `
    <section id="about">
      <h2>About</h2>
      <p>A computer science student who enjoys solving cool problems and exploring the intricacies of computers :)</p>
    </section>
  `;
}


function projectPage(post) {
  return `
    <article class="project-page">
      <div class="project-head">
        <a class="back-link" href="#home">Back</a>
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

async function renderRoute() {
  const hash = window.location.hash.slice(1) || 'home';

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

  if (hash === 'posts') {
    app.innerHTML = homePage();
    return;
  }

  if (hash === 'about') {
    app.innerHTML = aboutPage();
    return;
  }

  app.innerHTML = homePage();
}

window.addEventListener('hashchange', renderRoute);
renderRoute();
