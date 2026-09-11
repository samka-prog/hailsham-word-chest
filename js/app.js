/* ============================================================
   Hailsham Word Chest — app logic
   Word data lives in data/*.json (see data/manifest.json).
   To add a new chapter set: drop a new data/chapters-X-Y.json
   file (same shape as the others) and add one entry to
   data/manifest.json. No changes needed below.
   ============================================================ */

let MANIFEST = [];
const WORD_CACHE = {};   // file -> parsed word array, so re-visiting a tab doesn't refetch
let WORDS = [];
let ACTIVE_SET = null;

let order = [];
let filtered = [];
let idx = 0;
let known = new Set();
let unknown = new Set();
let clozeCorrect = 0, clozeAttempted = 0, clozeAnswered = false;

const catLabel = { idiom: "Idiom", verb: "Verb", adj: "Adjective" };

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------- BOOTSTRAP ---------- */
async function init() {
  try {
    const res = await fetch('data/manifest.json');
    if (!res.ok) throw new Error('manifest fetch failed: ' + res.status);
    MANIFEST = await res.json();
  } catch (err) {
    document.getElementById('chapter-sub').textContent =
      'Could not load data/manifest.json — see console (running from file:// blocks fetch; use a local server or GitHub Pages).';
    console.error(err);
    return;
  }

  renderChapterTabs();
  await loadChapterSet(MANIFEST[0]);
  wireStaticControls();
}

function renderChapterTabs() {
  const nav = document.getElementById('chapter-tabs');
  nav.innerHTML = '';
  MANIFEST.forEach((set, i) => {
    const btn = document.createElement('button');
    btn.textContent = set.label;
    btn.id = 'btn-' + set.id;
    if (i === 0) btn.classList.add('active');
    btn.addEventListener('click', () => loadChapterSet(set));
    nav.appendChild(btn);
  });
}

async function loadChapterSet(set) {
  ACTIVE_SET = set;
  document.querySelectorAll('#chapter-tabs button').forEach(b => {
    b.classList.toggle('active', b.id === 'btn-' + set.id);
  });
  document.getElementById('chapter-sub').textContent = 'Loading…';

  if (!WORD_CACHE[set.file]) {
    try {
      const res = await fetch(set.file);
      if (!res.ok) throw new Error('fetch failed: ' + res.status);
      WORD_CACHE[set.file] = await res.json();
    } catch (err) {
      document.getElementById('chapter-sub').textContent =
        'Could not load ' + set.file + ' — see console.';
      console.error(err);
      return;
    }
  }

  WORDS = WORD_CACHE[set.file];
  document.getElementById('chapter-sub').textContent = set.subtitle;
  document.querySelector('#category-filter option[value="all"]').textContent =
    'All categories (' + WORDS.length + ')';
  document.getElementById('sort-order').value = 'freq';
  document.getElementById('category-filter').value = 'all';

  order = WORDS.map((_, i) => i);
  applySort();
}

/* ---------- FILTER + SORT ---------- */
function applySort() {
  const cat = document.getElementById('category-filter').value;
  const sortVal = document.getElementById('sort-order').value;

  filtered = order.filter(i => cat === 'all' || WORDS[i].c === cat);

  if (sortVal === 'freq') {
    filtered.sort((a, b) => (WORDS[b].f || 0) - (WORDS[a].f || 0) || WORDS[a].t.localeCompare(WORDS[b].t));
  } else if (sortVal === 'az') {
    filtered.sort((a, b) => WORDS[a].t.localeCompare(WORDS[b].t));
  } else {
    shuffle(filtered);
  }

  idx = 0;
  known.clear(); unknown.clear();
  clozeCorrect = 0; clozeAttempted = 0;
  renderFlash();
  renderCloze();
}

/* ---------- FLASHCARDS ---------- */
function renderFlash() {
  if (filtered.length === 0) return;
  const cardEl = document.getElementById('flash-card');
  const frontFace = cardEl.querySelector('.front');
  const backFace = cardEl.querySelector('.back');
  const w = WORDS[filtered[idx]];
  cardEl.classList.remove('flipped');
  frontFace.innerHTML = `<div class="term">${w.t}</div><div class="category-tag">${catLabel[w.c]}</div><div class="hint">Tap to reveal meaning</div>`;
  frontFace.setAttribute('data-num', (idx + 1) + ' / ' + filtered.length);
  backFace.innerHTML = `<div class="definition">${w.d}</div>`;
  backFace.setAttribute('data-num', (idx + 1) + ' / ' + filtered.length);
  updateProgress();
  updateStats();
}

function updateProgress() {
  const pct = filtered.length ? ((idx + 1) / filtered.length * 100) : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-label').textContent = filtered.length ? (idx + 1) + ' / ' + filtered.length : '0 / 0';
}
function updateStats() {
  document.getElementById('known-count').textContent = known.size;
  document.getElementById('unknown-count').textContent = unknown.size;
}

/* ---------- CLOZE ---------- */
function renderCloze() {
  if (filtered.length === 0) return;
  clozeAnswered = false;
  const w = WORDS[filtered[idx]];
  document.getElementById('cloze-card').setAttribute('data-num', idx + 1);
  document.getElementById('cloze-cat').textContent = catLabel[w.c];
  document.getElementById('cloze-def').textContent = "Definition: " + w.d;
  const parts = w.s.split('___');
  document.getElementById('cloze-sentence').innerHTML =
    parts[0] + `<input type="text" class="blank-input" id="blank-input" autocomplete="off" spellcheck="false">` + (parts[1] || '');
  document.getElementById('cloze-feedback').textContent = '';
  document.getElementById('cloze-feedback').className = 'feedback';
  updateProgress();
  document.getElementById('cloze-correct').textContent = clozeCorrect;
  document.getElementById('cloze-attempted').textContent = clozeAttempted;
  const input = document.getElementById('blank-input');
  if (input) {
    input.focus();
    input.addEventListener('keydown', e => { if (e.key === 'Enter') checkCloze(); });
  }
}

function normalize(str) {
  return str.trim().toLowerCase().replace(/[.,!?;:'"]/g, '');
}

function checkCloze() {
  if (clozeAnswered) return;
  const w = WORDS[filtered[idx]];
  const input = document.getElementById('blank-input');
  const guess = normalize(input.value);
  const answer = normalize(w.t);
  const fb = document.getElementById('cloze-feedback');
  clozeAttempted++;
  if (guess === answer || (guess.length > 3 && answer.includes(guess))) {
    clozeCorrect++;
    fb.textContent = "Correct — \"" + w.t + "\"";
    fb.className = 'feedback correct';
  } else {
    fb.textContent = "Not quite. The answer is \"" + w.t + "\".";
    fb.className = 'feedback wrong';
  }
  clozeAnswered = true;
  document.getElementById('cloze-correct').textContent = clozeCorrect;
  document.getElementById('cloze-attempted').textContent = clozeAttempted;
}

/* ---------- STATIC CONTROLS (wired once) ---------- */
function wireStaticControls() {
  document.getElementById('category-filter').addEventListener('change', applySort);
  document.getElementById('sort-order').addEventListener('change', applySort);

  document.getElementById('flash-card').addEventListener('click', function () {
    this.classList.toggle('flipped');
  });
  document.getElementById('next-btn').addEventListener('click', () => {
    idx = (idx + 1) % filtered.length; renderFlash();
  });
  document.getElementById('prev-btn').addEventListener('click', () => {
    idx = (idx - 1 + filtered.length) % filtered.length; renderFlash();
  });
  document.getElementById('shuffle-btn').addEventListener('click', () => {
    shuffle(filtered); idx = 0; renderFlash();
  });
  document.getElementById('knowit-btn').addEventListener('click', () => {
    known.add(filtered[idx]); unknown.delete(filtered[idx]);
    idx = (idx + 1) % filtered.length; renderFlash();
  });
  document.getElementById('dontknow-btn').addEventListener('click', () => {
    unknown.add(filtered[idx]); known.delete(filtered[idx]);
    idx = (idx + 1) % filtered.length; renderFlash();
  });

  document.getElementById('check-btn').addEventListener('click', checkCloze);
  document.getElementById('reveal-btn').addEventListener('click', () => {
    if (clozeAnswered) return;
    const w = WORDS[filtered[idx]];
    document.getElementById('blank-input').value = w.t;
    const fb = document.getElementById('cloze-feedback');
    fb.textContent = "Revealed: \"" + w.t + "\"";
    fb.className = 'feedback';
    clozeAnswered = true;
  });
  document.getElementById('cloze-next-btn').addEventListener('click', () => {
    idx = (idx + 1) % filtered.length; renderCloze();
  });

  const flashBtn = document.getElementById('btn-flash');
  const clozeBtn = document.getElementById('btn-cloze');
  const flashMode = document.getElementById('flash-mode');
  const clozeMode = document.getElementById('cloze-mode');

  flashBtn.addEventListener('click', () => {
    flashBtn.classList.add('active'); clozeBtn.classList.remove('active');
    flashMode.style.display = 'flex'; clozeMode.style.display = 'none';
    idx = 0; renderFlash();
  });
  clozeBtn.addEventListener('click', () => {
    clozeBtn.classList.add('active'); flashBtn.classList.remove('active');
    clozeMode.style.display = 'flex'; flashMode.style.display = 'none';
    idx = 0; renderCloze();
  });
}

init();
