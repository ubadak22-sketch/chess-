# Offline Chess (yellow & brown)

Static, offline-capable chess for one device: **Player vs Player** and **Player vs AI** (local engine in a Web Worker).
No server, accounts, CDNs, or network calls during play.

## Files
```
index.html  manifest.webmanifest  sw.js
css/style.css
js/chess.js    rules: legal moves, check/mate, castling, en passant, promotion, draws
js/worker.js   AI + analysis engine (alpha-beta search)
js/db.js       IndexedDB (games = start FEN + UCI move list; stats; settings)
js/app.js      UI, replay, stats, puzzles, export
data/puzzles.js  sample puzzles
tests/perft.js   move-generation test
```
## Dependencies / licenses
None. The rules engine and AI are original code in this repo (MIT-style, use freely). If you later swap in
chess.js or Stockfish, download the files into `js/`, add them to `sw.js` (`F` list), and keep their license
files (BSD-2 / GPLv3 respectively — Stockfish's GPL has distribution obligations).

## Run & test locally
Service workers and Web Workers need http(s), not `file://`:
```
cd offline-chess && python3 -m http.server 8000     # open http://localhost:8000
node tests/perft.js                                 # expects "perft OK"
```
Manual checks: play a game in each mode; try castling, en passant, promotion; finish a game and use Replay
(Play/Pause/Stop/Prev/Next, ←/→ keys) with animation on and off; check Stats; reload (data persists).

## Deploy to GitHub Pages
Push the folder contents to a repo, then Settings → Pages → deploy from branch `main`, folder `/ (root)`.
Open the `https://<user>.github.io/<repo>/` URL once while online.

## Offline / PWA
On first load the service worker caches all files; afterwards the app works with no connection.
**When you edit any file, bump `V` in `sw.js`** (e.g. `chess-v2`) or browsers keep serving the old cache.
No icons are included, so browsers may offer "add to home screen" with a default icon (add icons to the manifest if wanted).

## Backup
Settings → Export backup downloads a JSON file with all games, stats and settings. Importing is not implemented.
Clearing browser site data deletes saved games and stats — export first.

## Add puzzles
Append objects to `data/puzzles.js` (format explained at the top of that file).

## Known limits
AI is modest (Hard may take a few seconds); analysis is depth-2 and shallow; draws by agreement and
same-colour-bishop endings are not detected; stats can't be reset or imported yet.
