/* jshint esversion: 9 */
'use strict';

const GITHUB_USERNAME = 'minip8';

// =====================================================================
// NAVBAR — scroll state
// =====================================================================
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

// =====================================================================
// HAMBURGER — mobile menu
// =====================================================================
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('nav-links');

hamburger.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  hamburger.classList.toggle('active', isOpen);
  hamburger.setAttribute('aria-expanded', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

// Close when any link is tapped
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  });
});

// =====================================================================
// SCROLL REVEAL — IntersectionObserver
// =====================================================================
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target); // fire once
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// =====================================================================
// GITHUB PROJECTS
// =====================================================================

/**
 * Escapes a string for safe insertion into HTML to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates that a URL is a safe GitHub HTTPS URL.
 * @param {string} url
 * @returns {string}
 */
function sanitizeGithubUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && parsed.hostname === 'github.com') {
      return url;
    }
  } catch (_) { /* invalid URL */ }
  return '#';
}

/**
 * Returns a human-readable relative date string.
 * @param {string} dateStr  ISO 8601 date string
 * @returns {string}
 */
function relativeDate(dateStr) {
  const diffMs   = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.floor(diffMs / 864e5);

  if (diffDays === 0)  return 'today';
  if (diffDays === 1)  return 'yesterday';
  if (diffDays < 30)   return `${diffDays}d ago`;
  if (diffDays < 365)  return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}yr ago`;
}

/** Common language → colour map */
const LANG_COLORS = {
  JavaScript:  '#f1e05a',
  TypeScript:  '#3178c6',
  Python:      '#3572a5',
  Java:        '#b07219',
  C:           '#555555',
  'C++':       '#f34b7d',
  'C#':        '#178600',
  Go:          '#00add8',
  Rust:        '#dea584',
  HTML:        '#e34c26',
  CSS:         '#563d7c',
  Ruby:        '#701516',
  Swift:       '#f05138',
  Kotlin:      '#7f52ff',
  Dart:        '#00b4ab',
  PHP:         '#4f5d95',
  Shell:       '#89e051',
  'Jupyter Notebook': '#da5b0b',
  Vue:         '#41b883',
  Svelte:      '#ff3e00',
};

function getLangColor(lang) {
  return LANG_COLORS[lang] || '#666666';
}

/**
 * Builds the HTML string for a single project card.
 * All user-controlled data is passed through escapeHtml.
 * @param {Object} repo
 * @returns {string}
 */
function buildProjectCard(repo, index) {
  const safeUrl  = sanitizeGithubUrl(repo.html_url);
  const safeName = escapeHtml(repo.name);
  const safeDesc = repo.description ? escapeHtml(repo.description) : null;

  const langHtml = repo.language ? `
    <span class="project-lang">
      <span class="lang-dot" style="background:${getLangColor(repo.language)}" aria-hidden="true"></span>
      ${escapeHtml(repo.language)}
    </span>` : '';

  const starsHtml = repo.stargazers_count > 0 ? `
    <span class="project-stat" aria-label="${repo.stargazers_count} stars">
      ★ ${repo.stargazers_count}
    </span>` : '';

  const forksHtml = repo.forks_count > 0 ? `
    <span class="project-stat" aria-label="${repo.forks_count} forks">
      ⑂ ${repo.forks_count}
    </span>` : '';

  return `
    <a
      href="${safeUrl}"
      target="_blank"
      rel="noopener noreferrer"
      class="project-card reveal"
      aria-label="${safeName} — open on GitHub"
      style="transition-delay:${index * 0.055}s"
    >
      <div class="project-header">
        <span class="project-name">${safeName}</span>
        <span class="project-arrow" aria-hidden="true">↗</span>
      </div>
      <p class="${safeDesc ? 'project-desc' : 'project-desc no-desc'}">
        ${safeDesc || 'No description'}
      </p>
      <div class="project-footer">
        ${langHtml}
        ${starsHtml}
        ${forksHtml}
        <span class="project-updated" aria-label="Updated ${relativeDate(repo.updated_at)}">
          ${relativeDate(repo.updated_at)}
        </span>
      </div>
    </a>`;
}

async function fetchProjects() {
  const grid = document.getElementById('projects-grid');

  try {
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(GITHUB_USERNAME)}/repos?sort=updated&per_page=30&type=public`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );

    if (!res.ok) {
      throw new Error(`GitHub API responded with ${res.status}`);
    }

    const repos = await res.json();

    // Only own repos; sort by stars descending, then most-recently-updated
    const filtered = repos
      .filter(r => !r.fork && !r.archived)
      .sort((a, b) =>
        b.stargazers_count - a.stargazers_count ||
        new Date(b.updated_at) - new Date(a.updated_at)
      );

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="error-state">
          <p>No public repositories found.</p>
          <a href="https://github.com/${encodeURIComponent(GITHUB_USERNAME)}"
             target="_blank" rel="noopener noreferrer"
             style="color:var(--accent-red)">
            View profile on GitHub →
          </a>
        </div>`;
      return;
    }

    grid.innerHTML = filtered.map((repo, i) => buildProjectCard(repo, i)).join('');

    // Register new cards with the reveal observer
    grid.querySelectorAll('.project-card.reveal').forEach(el => revealObserver.observe(el));

  } catch (err) {
    console.error('Failed to fetch GitHub repos:', err);
    grid.innerHTML = `
      <div class="error-state">
        <p>Could not load projects right now.</p>
        <a href="https://github.com/${encodeURIComponent(GITHUB_USERNAME)}"
           target="_blank" rel="noopener noreferrer"
           style="color:var(--accent-red)">
          View on GitHub →
        </a>
      </div>`;
  }
}

// Bootstrap
fetchProjects();
