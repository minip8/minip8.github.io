'use strict';

// Moinkey (route #play): a 6×6 logic puzzle played with pigs and monkeys.
// Every cell ends up holding one or the other, such that
//   - no three of the same sit side by side in a row or column,
//   - every row and column has three pigs and three monkeys,
//   - cells joined by "=" match and cells joined by "×" differ.
// Puzzles are generated in the browser (the daily one from a date seed, so
// everyone gets the same grid) and are only ever as hard as the line-by-line
// solver below can crack. That is what guarantees a single solution, no
// guessing, and a Hint that can always explain a next step.
(() => {
  const N = 6;
  const HALF = N / 2;
  const EMPTY = 0;
  const PIG = 1;
  const MONKEY = 2;
  const NAME = { [PIG]: 'pig', [MONKEY]: 'monkey' };
  const EDGE_POOL = 10; // "=" / "×" links offered to the generator before pruning
  const ERROR_DELAY = 500; // ms before a conflict is flagged, so cycling a cell doesn't flash
  const STORAGE_KEY = 'minip8-moinkey';

  // Flat faces on a 40×40 box; every fill is a theme variable in style.css.
  const PIECE_SVG = {
    [PIG]: `
      <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <path class="pig-ear" d="M6 15 L8 4 L18 10 Z M34 15 L32 4 L22 10 Z" />
        <circle class="pig-skin" cx="20" cy="22" r="15" />
        <ellipse class="pig-snout" cx="20" cy="26.5" rx="8" ry="6" />
        <ellipse class="piece-ink" cx="17" cy="26.5" rx="1.4" ry="2.1" />
        <ellipse class="piece-ink" cx="23" cy="26.5" rx="1.4" ry="2.1" />
        <circle class="piece-ink" cx="13.5" cy="17.5" r="1.9" />
        <circle class="piece-ink" cx="26.5" cy="17.5" r="1.9" />
      </svg>`,
    [MONKEY]: `
      <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <circle class="monkey-fur" cx="6" cy="20" r="5.5" />
        <circle class="monkey-fur" cx="34" cy="20" r="5.5" />
        <circle class="monkey-face" cx="6" cy="20" r="2.8" />
        <circle class="monkey-face" cx="34" cy="20" r="2.8" />
        <circle class="monkey-fur" cx="20" cy="20" r="14.5" />
        <circle class="monkey-face" cx="15" cy="17.5" r="6" />
        <circle class="monkey-face" cx="25" cy="17.5" r="6" />
        <ellipse class="monkey-face" cx="20" cy="26" rx="9.5" ry="7.5" />
        <circle class="piece-ink" cx="15.5" cy="18" r="1.9" />
        <circle class="piece-ink" cx="24.5" cy="18" r="1.9" />
        <circle class="piece-ink" cx="18.6" cy="23.4" r="0.8" />
        <circle class="piece-ink" cx="21.4" cy="23.4" r="0.8" />
        <path class="piece-line" d="M15.5 27 Q20 31 24.5 27" />
      </svg>`,
  };

  const other = (value) => (value === PIG ? MONKEY : PIG);

  // Rows first, then columns; each line is its six cell indices.
  const LINES = [];
  for (let r = 0; r < N; r++) LINES.push(Array.from({ length: N }, (_, c) => r * N + c));
  for (let c = 0; c < N; c++) LINES.push(Array.from({ length: N }, (_, r) => r * N + c));
  const lineKind = (l) => (l < N ? 'row' : 'column');

  // Every legal way to fill one line: three of each, never three in a row.
  const PATTERNS = [];
  for (let bits = 0; bits < 1 << N; bits++) {
    const p = Array.from({ length: N }, (_, i) => ((bits >> i) & 1 ? PIG : MONKEY));
    if (p.filter((v) => v === PIG).length !== HALF) continue;
    if (p.some((v, i) => i >= 2 && v === p[i - 1] && v === p[i - 2])) continue;
    PATTERNS.push(p);
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, rand) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Solver and generator
  // -------------------------------------------------------------------------

  // An edge is { a, b, same } with b the cell right of (a + 1) or below (a + N) a.
  // links[line][i] is the edge between positions i and i + 1 of that line:
  // true for "=", false for "×", null for none.
  function linkTable(edges) {
    const links = LINES.map(() => new Array(N - 1).fill(null));
    for (const edge of edges) {
      const row = Math.floor(edge.a / N);
      const col = edge.a % N;
      if (edge.b === edge.a + 1) links[row][col] = edge.same;
      else links[N + col][row] = edge.same;
    }
    return links;
  }

  // Empty cells of line l that every still-possible pattern agrees on.
  function forcedInLine(cells, l, links) {
    const line = LINES[l];
    const options = PATTERNS.filter((p) =>
      p.every(
        (v, i) =>
          (cells[line[i]] === EMPTY || cells[line[i]] === v) &&
          (i === N - 1 || links[l][i] === null || (v === p[i + 1]) === links[l][i])
      )
    );
    if (!options.length) return [];
    const forced = [];
    line.forEach((index, i) => {
      const value = options[0][i];
      if (cells[index] === EMPTY && options.every((p) => p[i] === value)) {
        forced.push({ index, value, line: l });
      }
    });
    return forced;
  }

  // True when repeating that one-line-at-a-time deduction fills the whole grid.
  function solvable(givens, edges) {
    const cells = [...givens];
    const links = linkTable(edges);
    let progress = true;
    while (progress) {
      progress = false;
      for (let l = 0; l < LINES.length; l++) {
        for (const step of forcedInLine(cells, l, links)) {
          cells[step.index] = step.value;
          progress = true;
        }
      }
    }
    return !cells.includes(EMPTY);
  }

  function randomSolution(rand) {
    const rows = [];
    const columnsStayLegal = (next) =>
      next.every((value, c) => {
        const column = [...rows.map((row) => row[c]), value];
        const end = column.length - 1;
        if (end >= 2 && column[end - 1] === value && column[end - 2] === value) return false;
        return column.filter((v) => v === value).length <= HALF;
      });
    const place = () => {
      if (rows.length === N) return true;
      for (const pattern of shuffle(PATTERNS, rand)) {
        if (!columnsStayLegal(pattern)) continue;
        rows.push(pattern);
        if (place()) return true;
        rows.pop();
      }
      return false;
    };
    place();
    return rows.flat();
  }

  // Start from the full solution plus a handful of links, then drop clues for
  // as long as the solver can still finish the grid. Pieces are dropped before
  // links, which leaves a puzzle that leans on its links (about four fixed
  // pieces and five or six links) rather than one that barely has any.
  function generate(rand) {
    const solution = randomSolution(rand);
    const adjacent = [];
    for (let a = 0; a < N * N; a++) {
      if (a % N < N - 1) adjacent.push({ a, b: a + 1 });
      if (a < N * (N - 1)) adjacent.push({ a, b: a + N });
    }
    let edges = shuffle(adjacent, rand)
      .slice(0, EDGE_POOL)
      .map((edge) => ({ ...edge, same: solution[edge.a] === solution[edge.b] }));
    const givens = [...solution];

    for (const clue of [...shuffle([...givens.keys()], rand), ...shuffle(edges, rand)]) {
      if (typeof clue === 'number') {
        givens[clue] = EMPTY;
        if (!solvable(givens, edges)) givens[clue] = solution[clue];
      } else {
        const without = edges.filter((edge) => edge !== clue);
        if (solvable(givens, without)) edges = without;
      }
    }
    return { solution, givens, edges };
  }

  // -------------------------------------------------------------------------
  // Game state
  // -------------------------------------------------------------------------

  let state = null;
  let ui = null;
  let timerId = 0;
  let errorTimer = 0;

  function today() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    return {
      key: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      seed: y * 10000 + m * 100 + d,
      label: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(now),
    };
  }

  function elapsed() {
    return state.banked + (state.startedAt ? Date.now() - state.startedAt : 0);
  }

  function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = 0;
    if (state && state.startedAt) {
      state.banked = elapsed();
      state.startedAt = null;
    }
  }

  function startTimer() {
    if (timerId || state.solved) return;
    state.startedAt = Date.now();
    timerId = setInterval(() => {
      // The route changed and the page is gone: stop quietly.
      if (!ui.timer.isConnected) stopTimer();
      else ui.timer.textContent = formatTime(elapsed());
    }, 500);
  }

  // Only the daily puzzle is kept, so coming back later resumes it (or shows
  // the finished grid) instead of handing out a fresh attempt.
  function save() {
    if (state.mode !== 'daily') return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          day: state.day,
          cells: state.cells,
          elapsed: elapsed(),
          solved: state.solved,
        })
      );
    } catch {
      // Private mode or storage disabled: the game still works, it just forgets.
    }
  }

  function restore() {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      return;
    }
    const { givens, solution } = state.puzzle;
    const usable =
      saved &&
      saved.day === state.day &&
      Array.isArray(saved.cells) &&
      saved.cells.length === N * N &&
      saved.cells.every((v, i) => (givens[i] === EMPTY ? [EMPTY, PIG, MONKEY].includes(v) : v === givens[i]));
    if (!usable) return;
    state.cells = saved.cells;
    state.banked = Number(saved.elapsed) || 0;
    state.solved = state.cells.every((v, i) => v === solution[i]);
  }

  function start(mode) {
    stopTimer();
    const day = today();
    const seed = mode === 'daily' ? day.seed : Math.floor(Math.random() * 2 ** 32);
    const puzzle = generate(mulberry32(seed));
    state = {
      mode,
      day: day.key,
      puzzle,
      cells: [...puzzle.givens],
      history: [],
      banked: 0,
      startedAt: null,
      hintIndex: -1,
      focus: puzzle.givens.indexOf(EMPTY),
      solved: false,
    };
    if (mode === 'daily') restore();

    ui.sub.textContent = mode === 'daily' ? `Daily puzzle · ${day.label}` : 'Random puzzle';
    ui.daily.setAttribute('aria-pressed', String(mode === 'daily'));
    buildBoard();
    paint();
    say('');
  }

  function setCell(index, value) {
    state.cells[index] = value;
    state.hintIndex = -1;
    state.focus = index;
    startTimer();
    say('');
    if (state.cells.every((v, i) => v === state.puzzle.solution[i])) {
      stopTimer();
      state.solved = true;
    }
    save();
    paint();
  }

  function move(index, value) {
    if (state.solved || state.puzzle.givens[index] !== EMPTY || state.cells[index] === value) return;
    state.history.push({ index, value: state.cells[index] });
    setCell(index, value);
  }

  function undo() {
    const last = state.history.pop();
    if (last && !state.solved) setCell(last.index, last.value);
  }

  function clearBoard() {
    if (state.solved) return;
    state.cells = [...state.puzzle.givens];
    state.history = [];
    state.hintIndex = -1;
    say('');
    save();
    paint();
  }

  // Cells and links currently breaking a rule.
  function conflicts() {
    const { cells, puzzle } = state;
    const badCells = new Set();
    const badEdges = new Set();
    for (const line of LINES) {
      const values = line.map((index) => cells[index]);
      for (let i = 2; i < N; i++) {
        if (values[i] !== EMPTY && values[i] === values[i - 1] && values[i] === values[i - 2]) {
          [line[i], line[i - 1], line[i - 2]].forEach((index) => badCells.add(index));
        }
      }
      for (const kind of [PIG, MONKEY]) {
        if (values.filter((v) => v === kind).length > HALF) {
          line.forEach((index, i) => values[i] === kind && badCells.add(index));
        }
      }
    }
    puzzle.edges.forEach((edge, n) => {
      const a = cells[edge.a];
      const b = cells[edge.b];
      if (a !== EMPTY && b !== EMPTY && (a === b) !== edge.same) {
        badCells.add(edge.a).add(edge.b);
        badEdges.add(n);
      }
    });
    return { badCells, badEdges };
  }

  // The next step, explained with the simplest rule that settles it.
  function findHint() {
    const { cells, puzzle } = state;
    const wrong = cells.findIndex((v, i) => v !== EMPTY && v !== puzzle.solution[i]);
    if (wrong >= 0) {
      return { index: wrong, text: "This one doesn't belong here. Clear it and have another look." };
    }

    for (const edge of puzzle.edges) {
      const a = cells[edge.a];
      const b = cells[edge.b];
      if ((a === EMPTY) === (b === EMPTY)) continue;
      const known = a === EMPTY ? b : a;
      return {
        index: a === EMPTY ? edge.a : edge.b,
        text: edge.same
          ? `The = joins this cell to a ${NAME[known]}, so it is a ${NAME[known]} too.`
          : `The × sets this cell against a ${NAME[known]}, so it is a ${NAME[other(known)]}.`,
      };
    }

    for (let l = 0; l < LINES.length; l++) {
      const line = LINES[l];
      const v = line.map((index) => cells[index]);
      for (let i = 0; i < N; i++) {
        if (v[i] !== EMPTY) continue;
        const pairBefore = i >= 2 && v[i - 1] !== EMPTY && v[i - 1] === v[i - 2];
        const pairAfter = i <= N - 3 && v[i + 1] !== EMPTY && v[i + 1] === v[i + 2];
        const between = i >= 1 && i <= N - 2 && v[i - 1] !== EMPTY && v[i - 1] === v[i + 1];
        if (!pairBefore && !pairAfter && !between) continue;
        const kind = pairBefore || between ? v[i - 1] : v[i + 1];
        return {
          index: line[i],
          text: `${between ? 'This cell sits between two' : 'The two cells next to this one are both'} ${NAME[kind]}s. One more would make three in a row, so it is a ${NAME[other(kind)]}.`,
        };
      }
    }

    for (let l = 0; l < LINES.length; l++) {
      const line = LINES[l];
      const empty = line.find((index) => cells[index] === EMPTY);
      const full = [PIG, MONKEY].find((kind) => line.filter((index) => cells[index] === kind).length === HALF);
      if (empty !== undefined && full) {
        return {
          index: empty,
          text: `This ${lineKind(l)} already has three ${NAME[full]}s, so the rest are ${NAME[other(full)]}s.`,
        };
      }
    }

    const links = linkTable(puzzle.edges);
    for (let l = 0; l < LINES.length; l++) {
      const [step] = forcedInLine(cells, l, links);
      if (step) {
        return {
          index: step.index,
          text: `Try each way of finishing this ${lineKind(l)}: every one that works puts a ${NAME[step.value]} here.`,
        };
      }
    }
    return null;
  }

  function showHint() {
    if (state.solved) return;
    const hint = findHint();
    if (!hint) return;
    state.hintIndex = hint.index;
    state.focus = hint.index;
    paint();
    say(hint.text);
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  function page() {
    return `
      <section class="game-page" aria-labelledby="game-title" aria-live="off">
        <div class="game-head">
          <div>
            <h1 id="game-title">Moinkey</h1>
            <p class="game-sub" id="mk-sub"></p>
          </div>
          <div class="mk-modes">
            <button class="pill-button" id="mk-daily" type="button" aria-pressed="true">Today's puzzle</button>
            <button class="pill-button" id="mk-random" type="button">New random puzzle</button>
          </div>
        </div>

        <div class="game-layout">
          <div class="game-main">
            <div class="mk-status">
              <span class="mk-count" id="mk-progress"></span>
              <span class="mk-timer" id="mk-timer" aria-label="Time taken">0:00</span>
            </div>
            <div class="mk-board" id="mk-board" role="group" aria-label="Puzzle board"></div>
            <div class="mk-actions">
              <button class="pill-button" id="mk-undo" type="button">Undo</button>
              <button class="pill-button" id="mk-clear" type="button">Clear</button>
              <button class="pill-button" id="mk-hint" type="button">Hint</button>
            </div>
            <p class="mk-message" id="mk-message" role="status"></p>
          </div>

          <aside class="game-side" aria-labelledby="mk-rules-title">
            <h2 id="mk-rules-title">How to play</h2>
            <ol class="mk-rules">
              <li>Fill every cell with a <span class="mk-dot">${PIECE_SVG[PIG]}</span> pig or a <span class="mk-dot">${PIECE_SVG[MONKEY]}</span> monkey. Tap a cell once for a pig, twice for a monkey, a third time to clear it.</li>
              <li>Never three of the same side by side, across or down.</li>
              <li>Every row and every column has three pigs and three monkeys.</li>
              <li>Cells joined by <span class="mk-sign">=</span> match. Cells joined by <span class="mk-sign">×</span> differ.</li>
            </ol>
          </aside>
        </div>
      </section>
    `;
  }

  function buildBoard() {
    const { givens, edges } = state.puzzle;
    const cells = givens
      .map((given, i) => {
        const row = Math.floor(i / N);
        const col = i % N;
        return `<button class="mk-cell${given !== EMPTY ? ' is-given' : ''}" type="button" data-i="${i}" style="--wave: ${row + col}"><span class="mk-piece"></span></button>`;
      })
      .join('');
    // Links sit on the shared border of their two cells, in a layer above the grid.
    const links = edges
      .map((edge) => {
        const row = Math.floor(edge.a / N);
        const col = edge.a % N;
        const across = edge.b === edge.a + 1;
        const left = ((col + (across ? 1 : 0.5)) / N) * 100;
        const top = ((row + (across ? 0.5 : 1)) / N) * 100;
        return `<span class="mk-link" style="left: ${left}%; top: ${top}%" aria-hidden="true">${edge.same ? '=' : '×'}</span>`;
      })
      .join('');
    ui.board.innerHTML = cells + links;
    ui.cells = [...ui.board.querySelectorAll('.mk-cell')];
    ui.links = [...ui.board.querySelectorAll('.mk-link')];
  }

  function cellLabel(index, hasConflict) {
    const { cells, puzzle } = state;
    const parts = [`Row ${Math.floor(index / N) + 1}, column ${(index % N) + 1}`];
    parts.push(cells[index] === EMPTY ? 'empty' : NAME[cells[index]]);
    if (puzzle.givens[index] !== EMPTY) parts.push('fixed');
    for (const edge of puzzle.edges) {
      if (edge.a !== index && edge.b !== index) continue;
      const where = edge.b === edge.a + 1 ? (edge.a === index ? 'right' : 'left') : edge.a === index ? 'below' : 'above';
      parts.push(`${edge.same ? 'matches' : 'differs from'} the cell ${where === 'left' || where === 'right' ? `to the ${where}` : where}`);
    }
    if (hasConflict) parts.push('breaks a rule');
    return parts.join(', ');
  }

  function paint() {
    const { cells, puzzle } = state;
    const { badCells, badEdges } = conflicts();

    ui.cells.forEach((el, i) => {
      // Redraw a piece only when it changes, so the rest don't replay their pop-in.
      if (el.dataset.piece !== String(cells[i])) {
        el.dataset.piece = cells[i];
        el.firstElementChild.innerHTML = PIECE_SVG[cells[i]] || '';
      }
      el.classList.toggle('is-hint', i === state.hintIndex);
      if (!badCells.has(i)) el.classList.remove('is-error');
      el.tabIndex = i === state.focus ? 0 : -1;
      el.setAttribute('aria-label', cellLabel(i, el.classList.contains('is-error')));
    });
    ui.links.forEach((el, n) => {
      if (!badEdges.has(n)) el.classList.remove('is-error');
    });

    // Conflicts clear at once but only show after a pause.
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => {
      badCells.forEach((i) => {
        ui.cells[i].classList.add('is-error');
        ui.cells[i].setAttribute('aria-label', cellLabel(i, true));
      });
      badEdges.forEach((n) => ui.links[n].classList.add('is-error'));
    }, ERROR_DELAY);

    const toFill = puzzle.givens.filter((v) => v === EMPTY).length;
    const filled = cells.filter((v) => v !== EMPTY).length - (N * N - toFill);
    ui.progress.textContent = `${filled} / ${toFill} placed`;

    ui.board.classList.toggle('is-solved', state.solved);
    ui.timer.textContent = formatTime(elapsed());
    ui.undo.disabled = state.solved || !state.history.length;
    ui.clear.disabled = state.solved || filled === 0;
    ui.hint.disabled = state.solved;
  }

  function say(text) {
    ui.message.textContent = text;
  }

  function focusCell(index) {
    ui.cells[state.focus].tabIndex = -1;
    state.focus = index;
    ui.cells[index].tabIndex = 0;
    ui.cells[index].focus();
  }

  // Call after page() has been put in the DOM.
  function mount() {
    const byId = (id) => document.getElementById(id);
    ui = {
      sub: byId('mk-sub'),
      board: byId('mk-board'),
      progress: byId('mk-progress'),
      timer: byId('mk-timer'),
      message: byId('mk-message'),
      undo: byId('mk-undo'),
      clear: byId('mk-clear'),
      hint: byId('mk-hint'),
      daily: byId('mk-daily'),
    };

    const cellIndex = (event) => {
      const cell = event.target.closest('.mk-cell');
      return cell ? Number(cell.dataset.i) : -1;
    };

    ui.board.addEventListener('click', (event) => {
      const i = cellIndex(event);
      if (i >= 0) move(i, (state.cells[i] + 1) % 3);
    });
    // Right-click steps the other way round: monkey, pig, clear.
    ui.board.addEventListener('contextmenu', (event) => {
      const i = cellIndex(event);
      if (i < 0) return;
      event.preventDefault();
      move(i, (state.cells[i] + 2) % 3);
    });
    ui.board.addEventListener('keydown', (event) => {
      const i = cellIndex(event);
      if (i < 0) return;
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -N, ArrowDown: N }[event.key];
      if (step) {
        event.preventDefault();
        const next = i + step;
        const staysInRow = Math.abs(step) === N || Math.floor(next / N) === Math.floor(i / N);
        if (next >= 0 && next < N * N && staysInRow) focusCell(next);
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        move(i, EMPTY);
      }
    });

    ui.undo.addEventListener('click', undo);
    ui.clear.addEventListener('click', clearBoard);
    ui.hint.addEventListener('click', showHint);
    ui.daily.addEventListener('click', () => state.mode !== 'daily' && start('daily'));
    byId('mk-random').addEventListener('click', () => start('random'));

    start('daily');
  }

  window.Moinkey = { page, mount };
})();
