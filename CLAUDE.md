# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal static site (`minip8.github.io`) served straight off GitHub Pages from the repo root on `main`. There is no build step, no package manager, no test suite, and no dependencies checked in — `index.html`, `style.css`, `script.js` are shipped verbatim. Pushing to `main` deploys.

Third-party libs (MathJax 3 tex-svg, marked, DOMPurify) are `defer`-loaded from jsDelivr CDNs in `index.html`. Don't introduce a bundler or npm install to add a library; add a `<script defer>` tag.

## Local development

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Must be served over HTTP. Opening `index.html` via `file://` breaks post pages, because `loadMarkdown()` `fetch()`es the markdown files and file:// origins are blocked by CORS.

## Architecture

Single-page app with a hash router. `renderRoute()` in `script.js:273` reads `location.hash` and swaps `innerHTML` on `#app`:

- `#home` (default) → `homePage()`
- `#posts` → `postsPage()`
- `#project/<slug>` → `projectPage(post)`, then `loadMarkdown(post)` fetches and renders the markdown asynchronously
- unknown slug → inline 404 markup

Page content lives in template-literal functions, not in `index.html`. `index.html` only carries the shell (header, empty `<main id="app">`, footer). To change home/posts copy, edit the functions in `script.js`, not the HTML.

### Posts registry

`posts` (`script.js:9`) is the single source of truth — a hardcoded array, no index file or directory scan. Adding a post is two steps:

1. Create `content/projects/<slug>/index.md` plus any images alongside it.
2. Append an entry `{ slug, title, date, categories, excerpt, path }` to `posts`.

`date` is `DD-MM-YYYY`. `formatDate()` parses that with an explicit `d-m-yyyy` regex **before** trying `new Date(value)` — order matters, because JS reads a bare `04-12-2026` as `MM-DD-YYYY` and would render 4 December as "Apr 12". The explicit parse also sidesteps mobile Safari's stricter parser. `new Date()` remains as a fallback for other formats (ISO, etc.). Keep the format consistent.

### Markdown → HTML pipeline

`sanitizeMarkdown()` runs a specific order that must be preserved:

1. `extractMathSegments()` pulls `$$…$$`, `\[…\]`, `$…$`, `\(…\)` out and replaces each with an `@@MATH_n@@` token — display math first, so inline matching can't split it.
2. `marked.parse()` runs on the math-free text (so marked never mangles `_`, `\`, `*` inside formulas).
3. `restoreMathSegments()` puts the raw math back, HTML-escaped.
4. `DOMPurify.sanitize()`.
5. `resolveRelativeAssetUrls()` rewrites relative `img[src]` / `a[href]` against the markdown file's directory.
6. Back in `loadMarkdown()`, `MathJax.typesetPromise([root])` typesets the injected DOM.

Consequences when authoring or debugging posts:

- Inline `$…$` must stay on one line (`[^\n$]` in the regex). Multi-line math needs `$$…$$`.
- Images in markdown are written relative to the `.md` file (`![alt](mnist_fashion_train.png)`) and resolved at render time — do not hardcode `content/projects/...` paths.
- Markdown does not honour single-newline line breaks (`breaks: false`); the existing post uses explicit `<br>`.
- If math renders as literal `$…$`, the failure is almost always the regex in `extractMathSegments()`, not MathJax config.

### Theming

`data-theme="light|dark"` is set on `<html>`; every colour is a CSS custom property defined twice in `style.css` — `:root` and `:root[data-theme='dark']`. Any new colour needs both. Preference is stored under `localStorage['minip8-theme']`; when unset, the site follows `prefers-color-scheme` live. `setTheme()` also syncs `style.colorScheme` and the `<meta name="theme-color">` tag.

Layout is capped at `max-width: 860px` via `.page-shell`, with breakpoints at 840px (tablet) and 600px (phone). Much of the git history is mobile/iPad layout fixes — check both breakpoints after touching `style.css`.

## Conventions

- Commits follow Conventional Commits, with the post slug as scope for post-specific work: `feat(rs-neuralnet): cost function`, `fix: phone text margin`.
- All interpolated user-ish data goes through `escapeHtml()` before landing in a template literal; markdown goes through `DOMPurify` instead.
