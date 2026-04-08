'use strict';

const app = document.getElementById('app');
const themeToggle = document.getElementById('theme-toggle');

const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
const THEME_STORAGE_KEY = 'minip8-theme';

const posts = [
  {
    slug: 'hello',
    title: 'Hello',
    date: '08-04-2026',
    categories: ['hello', 'world'],
    excerpt: 'Hello world',
    path: 'content/projects/hello/index.md',
  },
];

function setTheme(theme) {
  const resolvedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = resolvedTheme;
  localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
  document.documentElement.style.colorScheme = resolvedTheme;
  if (themeToggle) {
    themeToggle.textContent = resolvedTheme === 'dark' ? 'Light' : 'Dark';
    themeToggle.setAttribute('aria-label', `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`);
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

themeMedia.addEventListener('change', (event) => {
  if (!localStorage.getItem(THEME_STORAGE_KEY)) {
    setTheme(event.matches ? 'dark' : 'light');
  }
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function homePage() {
  return `
    <section class="intro">
      <p class="eyebrow">About</p>
      <h1>A showcase of stuff I enjoyed exploring</h1>
      <p class="intro-copy">
        I hope you find it interesting!
      </p>
    </section>

    <section class="about-card" id="about">
      <h2>Who am I?</h2>
      <p>A computer science student who enjoys solving cool problems and exploring the intricacies of computers :)</p>
      <a class="back-link" href="#posts">Open posts</a>
    </section>
  `;
}

function postsPage() {
  return `
    <section class="intro intro-tight">
      <p class="eyebrow">Posts</p>
      <h1>Project explorations</h1>
      <p class="intro-copy">
    </section>

    <section class="posts-panel posts-page" aria-labelledby="posts-heading">
      <div class="section-head">
        <h2 id="posts-heading">Posts</h2>
        <p>${posts.length} entries</p>
      </div>
      <div class="posts-list">
        ${posts
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

function sanitizeMarkdown(markdownText) {
  if (window.marked && window.DOMPurify) {
    marked.setOptions({ gfm: true, breaks: true });
    return DOMPurify.sanitize(marked.parse(markdownText));
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

    root.innerHTML = sanitizeMarkdown(await response.text());
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
    app.innerHTML = postsPage();
    return;
  }

  app.innerHTML = homePage();
}

window.addEventListener('hashchange', renderRoute);
renderRoute();