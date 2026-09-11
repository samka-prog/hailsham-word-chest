# Hailsham Word Chest

A small vocabulary trainer (flashcards + fill-in-the-gap) for B2–C2 words and
idioms drawn from *Never Let Me Go*, organized by chapter range.

## Structure

```
index.html          shell page — no word data lives here
css/styles.css       all styling
js/app.js            app logic; fetches data/ at runtime
data/
  manifest.json       list of chapter sets (id, label, subtitle, file)
  chapters-1-3.json    word data for Chapters 1–3
  chapters-4-7.json    word data for Chapters 4–7
  chapters-8-11.json   word data for Chapters 8–11
```

The word lists are pure data (JSON), not embedded in the HTML/JS. `app.js`
reads `data/manifest.json` to know which chapter sets exist, builds the tab
buttons from it, and fetches the matching JSON file on demand (cached after
first load) — so the app scales to any number of chapter sets without
touching any code.

## Running locally

Opening `index.html` directly (`file://…`) will **not** work — browsers
block `fetch()` of local files for security reasons (CORS). Serve the folder
over HTTP instead:

```bash
# from the project root
python3 -m http.server 8000
# or
npx serve .
```

Then visit `http://localhost:8000`.

## Publishing on GitHub Pages

1. Push this folder as a repo (or a subfolder of one).
2. In the repo settings, enable **Pages** → source: the branch/folder
   containing `index.html`.
3. GitHub Pages serves over HTTPS, so `fetch()` works with no further setup.

## Adding a new chapter set

1. Create `data/chapters-X-Y.json` — an array of word objects:

   ```json
   {
     "t": "term or idiom",
     "c": "idiom | verb | adj",
     "f": 1,
     "d": "short definition",
     "s": "Original example sentence with ___ marking the blank."
   }
   ```

   - `t` — the exact term/idiom to be typed/matched in the fill-in-the-gap mode
   - `c` — category, must be one of `idiom`, `verb`, `adj`
   - `f` — usefulness/frequency score, 1 (rare) to 5 (very common) — powers
     the "Most useful first" sort
   - `d` — short definition
   - `s` — an **original** example sentence (not quoted from the book, for
     copyright reasons) with `___` marking the blank

2. Add one entry to `data/manifest.json`:

   ```json
   { "id": "chXY", "label": "Chapters X–Y", "subtitle": "…", "file": "data/chapters-X-Y.json" }
   ```

3. Done — no HTML/JS changes needed. The new tab appears automatically.

## Word count

- Chapters 1–3: 52 words
- Chapters 4–7: 52 words
- Chapters 8–11: 50 words
