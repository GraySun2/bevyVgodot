// The referee's check for step 2, "Thumbs", the same for both builds. It serves a build's web folder the way a
// plain web host would, opens it in headless Chromium, works the thumb stick with real touch events (and, at PC
// size, the mouse and the keys), and reads where the mage and the knob are from screenshots alone.
//
//   node tools/check-step-02.cjs <web folder> <folder for screenshots>
//
// It changes nothing in a build and looks at nothing but the page. It needs Node and Playwright with Chromium.
//
// The test browser draws with software, and at a phone's real sharpness (three screen pixels to a point) it
// manages only a few frames a second, which no phone is that slow at. So the walking is checked at phone size
// drawn at one screen pixel to a point, where it keeps up, and one view at the real sharpness checks that the
// picture and a thumb on the stick still work there. Every view's frames a second are in the report. Where a
// check turns on timing, it allows for the frames the test browser drew.
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");

const web = path.resolve(process.argv[2] || "web");
const out = path.resolve(process.argv[3] || "check-out");
const shared = path.join(__dirname, "..", "shared");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".png": "image/png", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".txt": "text/plain" };

// What the asks say, in sprite-sheet pixels. The picture is 288 by 576: a 48 pixel strip, the lot (288 by 384),
// a 144 pixel strip. Places on the lot below are the middle of the mage's sprite, counted from the lot's corner.
const PIC_W = 288, PIC_H = 576, TOP = 48, STICK = { x: 72, y: 432 + 72 }, REACH = 28, DEAD = 8, SPEED = 96;
const START = { x: 144, y: 80 }, MIN = 16, MAX_X = 272, MAX_Y = 368;
const HOUSE = { x0: 96, y0: 0, x1: 192, y1: 64 }, CRATE = { x0: 192, y0: 32, x1: 224, y1: 64 }, HALF = 10;

function serve() {
  const seen = new Map();
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
    const f = path.join(web, p);
    if (!f.startsWith(web) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("not found"); seen.set(p, -1); return; }
    const body = fs.readFileSync(f); seen.set(p, body.length);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream", "Content-Length": body.length });
    res.end(body);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ server, seen, url: "http://127.0.0.1:" + server.address().port + "/" })));
}

// ---- The ruler: runs in a blank page of its own. ----
// setup() draws the picture the shared files describe, with no mage and no knob. look() reads one screenshot:
// it takes the color at the middle of each of the picture's 288 by 576 pixels, and finds the mage and the knob
// as the places where that differs from the plain picture.
async function setup({ sheet, controls, sprites, lot, ctl, TOP, STICK }) {
  const load = (b64) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = "data:image/png;base64," + b64; });
  const mk = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h }).getContext("2d", { willReadFrequently: true });
  const art = await load(sheet), con = await load(controls), T = 32;
  const base = mk(288, 576); base.fillStyle = "#2f5a2a"; base.fillRect(0, 0, 288, 576);
  const d = (c, name, x, y) => { const sp = sprites.sprites[name]; c.drawImage(art, sp.x, sp.y, T, T, x, y, T, T); };
  lot.ground.forEach((r, ty) => [...r].forEach((ch, tx) => d(base, lot.ground_legend[ch], tx * T, TOP + ty * T)));
  lot.things.forEach((r, ty) => [...r].forEach((ch, tx) => { const n = lot.things_legend[ch]; if (n) d(base, n, tx * T, TOP + ty * T); }));
  const B = ctl.pieces.stick_base, K = ctl.pieces.stick_knob;
  base.drawImage(con, B.x, B.y, B.w, B.h, STICK.x - B.w / 2, STICK.y - B.h / 2, B.w, B.h);
  const piece = (data, w, h) => { let x0 = w, x1 = -1, y0 = h, y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] >= 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { data, w, h, x0, y0, x1, y1 }; };
  const R = { base: base.getImageData(0, 0, 288, 576).data, mage: {}, load, mk };
  for (const f of ["down", "up", "left", "right"]) { const c = mk(T, T); d(c, "mage_" + f, 0, 0); R.mage[f] = piece(c.getImageData(0, 0, T, T).data, T, T); }
  { const c = mk(K.w, K.h); c.drawImage(con, K.x, K.y, K.w, K.h, 0, 0, K.w, K.h); R.knob = piece(c.getImageData(0, 0, K.w, K.h).data, K.w, K.h); }
  window.R = R; return true;
}

async function look({ shot, W, H, dpr, TOP, STICK, wantBars }) {
  const R = window.R, img = await R.load(shot), w = img.width, h = img.height, g = R.mk(w, h); g.drawImage(img, 0, 0);
  const a = g.getImageData(0, 0, w, h).data, s = Math.min(W / 288, H / 576) * dpr, x0 = (w - 288 * s) / 2, y0 = (h - 576 * s) / 2;
  const pic = new Uint8Array(288 * 576 * 3);
  for (let py = 0; py < 576; py++) for (let px = 0; px < 288; px++) {
    const sx = Math.max(0, Math.min(w - 1, Math.floor(x0 + (px + 0.5) * s))), sy = Math.max(0, Math.min(h - 1, Math.floor(y0 + (py + 0.5) * s))), o = (sy * w + sx) * 4, i = (py * 288 + px) * 3;
    pic[i] = a[o]; pic[i + 1] = a[o + 1]; pic[i + 2] = a[o + 2];
  }
  const TOL = 24, base = R.base;
  const off = (i, c, j) => Math.abs(pic[i] - c[j]) > TOL || Math.abs(pic[i + 1] - c[j + 1]) > TOL || Math.abs(pic[i + 2] - c[j + 2]) > TOL;
  // Where the picture differs from the plain one, in a band of rows: the tightest box around the busiest 40 by 40 patch.
  const blob = (ya, yb) => {
    const hh = yb - ya, sum = new Int32Array((hh + 1) * 289); let n = 0;
    for (let y = 0; y < hh; y++) for (let x = 0; x < 288; x++) { const p = (ya + y) * 288 + x, m = off(p * 3, base, p * 4) ? 1 : 0; n += m; sum[(y + 1) * 289 + x + 1] = m + sum[y * 289 + x + 1] + sum[(y + 1) * 289 + x] - sum[y * 289 + x]; }
    if (!n) return null;
    const win = 40; let best = -1, bx = 0, by = 0;
    for (let y = 0; y + win <= hh || y === 0; y++) for (let x = 0; x + win <= 288; x++) { const y2 = Math.min(hh, y + win), c = sum[y2 * 289 + x + win] - sum[y * 289 + x + win] - sum[y2 * 289 + x] + sum[y * 289 + x]; if (c > best) { best = c; bx = x; by = y; } }
    let bx0 = 288, bx1 = -1, by0 = 576, by1 = -1;
    for (let y = by; y < Math.min(hh, by + win); y++) for (let x = bx; x < bx + win; x++) { const p = (ya + y) * 288 + x; if (off(p * 3, base, p * 4)) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (ya + y < by0) by0 = ya + y; if (ya + y > by1) by1 = ya + y; } }
    return { n, inPatch: best, x0: bx0, y0: by0, x1: bx1, y1: by1 };
  };
  // How many pixels around a piece are wrong if the piece's top-left corner is at (tx, ty).
  const misses = (pc, tx, ty, ya, yb) => { let m = 0; for (let y = ty - 3; y < ty + pc.h + 3; y++) { if (y < ya || y >= yb) continue; for (let x = tx - 3; x < tx + pc.w + 3; x++) { if (x < 0 || x >= 288) continue; const p = y * 288 + x, ix = x - tx, iy = y - ty, q = (iy * pc.w + ix) * 4; if (ix >= 0 && iy >= 0 && ix < pc.w && iy < pc.h && pc.data[q + 3] >= 128) { if (off(p * 3, pc.data, q)) m++; } else if (off(p * 3, base, p * 4)) m++; } } return m; };
  const fit = (pc, b, ya, yb) => { let best = null; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const tx = b.x0 - pc.x0 + dx, ty = b.y0 - pc.y0 + dy, m = misses(pc, tx, ty, ya, yb); if (!best || m < best.m) best = { m, tx, ty }; } return best; };
  const res = { mage: null, knob: null };
  const mb = blob(TOP, TOP + 384);
  if (mb) { let best = null; for (const f of Object.keys(R.mage)) { const r = fit(R.mage[f], mb, TOP, TOP + 384); if (!best || r.m < best.m) best = { ...r, f }; }
    res.mage = { x: best.tx + 16, y: best.ty + 16 - TOP, facing: best.f, wrongPixelsNearby: best.m, changedPixels: mb.n, tx: best.tx, ty: best.ty }; }
  const kb = blob(TOP + 384, 576);
  if (kb) { const r = fit(R.knob, kb, TOP + 384, 576); res.knob = { dx: r.tx + R.knob.w / 2 - STICK.x, dy: r.ty + R.knob.h / 2 - STICK.y, wrongPixelsNearby: r.m, changedPixels: kb.n, tx: r.tx, ty: r.ty }; }
  // The whole picture against the shared files, with the mage and the knob put where they were found.
  let wrong = 0; const put = (pc, tx, ty, x, y) => { if (!pc) return null; const ix = x - tx, iy = y - ty; if (ix < 0 || iy < 0 || ix >= pc.w || iy >= pc.h) return null; const q = (iy * pc.w + ix) * 4; return pc.data[q + 3] >= 128 ? q : null; };
  const mp = res.mage ? R.mage[res.mage.facing] : null;
  for (let y = 0; y < 576; y++) for (let x = 0; x < 288; x++) { const p = y * 288 + x; let q = res.knob ? put(R.knob, res.knob.tx, res.knob.ty, x, y) : null;
    if (q !== null) { if (off(p * 3, R.knob.data, q)) wrong++; continue; } q = res.mage ? put(mp, res.mage.tx, res.mage.ty, x, y) : null;
    if (q !== null) { if (off(p * 3, mp.data, q)) wrong++; continue; } if (off(p * 3, base, p * 4)) wrong++; }
  res.pictureWrongPct = Math.round((wrong / (288 * 576)) * 10000) / 100;
  if (wantBars) { let n = 0, ok = 0; for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { if (x >= x0 - 2 && x < x0 + 288 * s + 2 && y >= y0 - 2 && y < y0 + 576 * s + 2) continue; const o = (y * w + x) * 4; n++; if (Math.abs(a[o] - 0x2a) <= 8 && Math.abs(a[o + 1] - 0x1a) <= 8 && Math.abs(a[o + 2] - 0x14) <= 8) ok++; } res.barsRightColorPct = n ? Math.round((ok / n) * 10000) / 100 : null; }
  if (res.mage) { delete res.mage.tx; delete res.mage.ty; } if (res.knob) { delete res.knob.tx; delete res.knob.ty; }
  return res;
}

// Waits for the cover the way step 1's check does: most of the picture in the cover's color, with pale words on it.
async function coverStats({ shot, W, H, dpr }) {
  const R = window.R, img = await R.load(shot), w = img.width, h = img.height, g = R.mk(w, h); g.drawImage(img, 0, 0);
  const a = g.getImageData(0, 0, w, h).data, s = Math.min(W / 288, H / 576) * dpr, x0 = (w - 288 * s) / 2, y0 = (h - 576 * s) / 2; let n = 0, cov = 0, words = 0;
  for (let y = Math.ceil(y0); y < y0 + 576 * s - 1; y += 2) for (let x = Math.ceil(x0); x < x0 + 288 * s - 1; x += 2) { const o = (y * w + x) * 4; n++;
    if (Math.abs(a[o] - 0x2f) <= 8 && Math.abs(a[o + 1] - 0x5a) <= 8 && Math.abs(a[o + 2] - 0x2a) <= 8) cov++; else if (Math.abs(a[o] - 0xff) <= 40 && Math.abs(a[o + 1] - 0xf4) <= 40 && Math.abs(a[o + 2] - 0xd8) <= 40) words++; }
  return { coverPct: (cov / n) * 100, words };
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { server, seen, url } = await serve();
  const b64 = (f) => fs.readFileSync(path.join(shared, f)).toString("base64"), json = (f) => JSON.parse(fs.readFileSync(path.join(shared, f), "utf8"));
  const rulerBrowser = await chromium.launch(), ruler = await (await rulerBrowser.newContext()).newPage();
  await ruler.evaluate(setup, { sheet: b64("sprites.png"), controls: b64("controls.png"), sprites: json("sprites.json"), lot: json("lot.json"), ctl: json("controls.json"), TOP, STICK });
  const report = { web, step: 2, checks: [], views: {} };
  const round = (n) => Math.round(n * 100) / 100;

  // One view of the game: a browser at a real pixel density, the page loaded, and hands to work it with.
  async function open(v) {
    const browser = await chromium.launch({ args: ["--force-device-scale-factor=" + v.dpr] });
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dpr, hasTouch: v.touch, isMobile: v.touch });
    const page = await ctx.newPage(), errs = [], cdp = await ctx.newCDPSession(page);
    page.on("pageerror", (e) => errs.push("page error: " + String(e.message).slice(0, 300)));
    page.on("console", (m) => { if (m.type() === "error") errs.push("console error: " + m.text().slice(0, 300)); });
    const s = Math.min(v.width / PIC_W, v.height / PIC_H), gx = (v.width - PIC_W * s) / 2, gy = (v.height - PIC_H * s) / 2;
    const css = (px, py) => ({ x: round(gx + px * s), y: round(gy + py * s) });
    let shots = 0;
    const V = { v, page, errs, css, name: v.name, fps: null, q: 3,
      async shot(label) { const b = await page.screenshot(); if (label) fs.writeFileSync(path.join(out, v.name + "-" + String(++shots).padStart(2, "0") + "-" + label + ".png"), b); return b; },
      async look(label, wantBars) { const b = await V.shot(label); return ruler.evaluate(look, { shot: b.toString("base64"), W: v.width, H: v.height, dpr: v.dpr, TOP, STICK, wantBars: !!wantBars }); },
      wait: (ms) => page.waitForTimeout(ms),
      // Frames a second the page is drawing right now, and from that how far the mage goes in one frame.
      async pace() { V.fps = round(await page.evaluate(() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else ok(n / 1.5); }; requestAnimationFrame(f); }))); V.q = Math.max(2, SPEED / Math.max(1, V.fps)); return V.fps; },
      async close() { report.views[v.name] = { size: v.width + "x" + v.height + " @" + v.dpr, secondsToCover: V.secondsToCover, framesASecondInTheTestBrowser: V.fps }; await ctx.close(); await browser.close(); } };
    // Fingers, as real touch events. A finger is put down, slid and lifted by its number.
    const pts = new Map();
    const send = (type) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: [...pts].map(([id, p]) => ({ id, x: p.x, y: p.y, radiusX: 6, radiusY: 6, force: 1 })) });
    V.finger = { down: async (id, px, py) => { pts.set(id, css(px, py)); await send("touchStart"); }, slide: async (id, px, py) => { pts.set(id, css(px, py)); await send("touchMove"); },
      lift: async (id) => { pts.delete(id); await send(pts.size ? "touchMove" : "touchEnd"); } };
    V.mouse = { down: async (px, py) => { const p = css(px, py); await page.mouse.move(p.x, p.y); await page.mouse.down(); }, slide: async (px, py) => { const p = css(px, py); await page.mouse.move(p.x, p.y); }, lift: () => page.mouse.up() };
    // Holds the stick toward (dx, dy) for some milliseconds, with a finger or with the mouse, then lets the game settle.
    V.push = async (dx, dy, ms, far = 45) => { const m = Math.hypot(dx, dy), tx = STICK.x + (dx / m) * far, ty = STICK.y + (dy / m) * far;
      if (v.touch) { await V.finger.down(1, STICK.x, STICK.y); await V.finger.slide(1, tx, ty); await V.wait(ms); await V.finger.lift(1); }
      else { await V.mouse.down(STICK.x, STICK.y); await V.mouse.slide(tx, ty); await V.wait(ms); await V.mouse.lift(); }
      await V.wait(Math.max(200, 3000 / Math.max(1, V.fps || 30))); };
    // Walks the mage to about a place on open ground, by pushing, looking, and pushing again.
    V.walkTo = async (x, y, tol = 8) => { let l = null; for (let i = 0; i < 8; i++) { l = await V.look(); if (!l.mage) return l; const dx = x - l.mage.x, dy = y - l.mage.y, dist = Math.hypot(dx, dy); if (dist <= Math.max(tol, V.q * 1.5)) return l;
        await V.push(dx, dy, Math.max(20, (dist / SPEED) * 1000 - 1500 / Math.max(1, V.fps || 30))); } return V.look(); };
    const t0 = Date.now(); await page.goto(url, { waitUntil: "load", timeout: 120000 });
    let hits = 0; while (Date.now() - t0 < 120000) { await V.wait(700); const c = await ruler.evaluate(coverStats, { shot: (await page.screenshot()).toString("base64"), W: v.width, H: v.height, dpr: v.dpr }); hits = c.coverPct > 80 && c.words > 20 ? hits + 1 : 0; if (hits >= 2) break; }
    V.coverSeen = hits >= 2; V.secondsToCover = round((Date.now() - t0) / 1000);
    return V;
  }
  // One line of the report. "want" is what the ask says, "got" what the page showed.
  const check = (V, name, ok, got, want) => { const c = { view: V.name, check: name, ok: !!ok, got, want }; report.checks.push(c); console.log((c.ok ? "  ok   " : "  MISS ") + V.name + ": " + name + (c.ok ? "" : "  got " + JSON.stringify(got) + ", want " + want)); return c.ok; };
  const at = (l) => (l.mage ? { x: l.mage.x, y: l.mage.y, facing: l.mage.facing } : null);
  const near = (l, x, y, tol) => !!l.mage && Math.abs(l.mage.x - x) <= tol && Math.abs(l.mage.y - y) <= tol;
  const onLot = (l) => !!l.mage && l.mage.x >= MIN - 1 && l.mage.x <= MAX_X + 1 && l.mage.y >= MIN - 1 && l.mage.y <= MAX_Y + 1;
  const clear = (l) => { if (!l.mage) return false; const hit = (b) => l.mage.x + HALF > b.x0 + 1 && l.mage.x - HALF < b.x1 - 1 && l.mage.y + HALF > b.y0 + 1 && l.mage.y - HALF < b.y1 - 1; return !hit(HOUSE) && !hit(CRATE); };
  const knobAt = (l, dx, dy, tol = 1.5) => !!l.knob && Math.abs(l.knob.dx - dx) <= tol && Math.abs(l.knob.dy - dy) <= tol;
  const kn = (l) => (l.knob ? { dx: l.knob.dx, dy: l.knob.dy } : null);
  const WALL = 3; // how close to a wall counts as up against it, in pixels
  // Did the mage go the way it was pushed, about as far as the time allows? A push can't end between two frames,
  // so it may run up to a few frames long, and the mage may be a frame short.
  const farEnough = (V, d, secs) => d >= SPEED * secs - V.q - 3 && d <= SPEED * secs + 3 * V.q + 8;
  const went = (V, b, e, dx, dy, secs) => { if (!b.mage || !e.mage) return false; const mx = e.mage.x - b.mage.x, my = e.mage.y - b.mage.y, d = Math.hypot(mx, my), m = Math.hypot(dx, dy);
    return farEnough(V, d, secs) && (mx * dx + my * dy) / (d * m) >= Math.cos((12 * Math.PI) / 180); };
  const how = (b, e) => (b.mage && e.mage ? { movedX: e.mage.x - b.mage.x, movedY: e.mage.y - b.mage.y, facing: e.mage.facing } : null);
  const about = (dx, dy, secs) => "moved about " + round((dx / Math.hypot(dx, dy)) * SPEED * secs) + ", " + round((dy / Math.hypot(dx, dy)) * SPEED * secs);
  const slow = (V) => check(V, "the test browser keeps up here (8 frames a second or more)", V.fps >= 8, V.fps + " frames a second", "8 or more, or the timed checks in this view mean nothing");

  // ---------- An upright phone at its real sharpness: the picture, and a thumb on the stick ----------
  {
    const V = await open({ name: "phone-sharp", width: 390, height: 844, dpr: 3, touch: true });
    check(V, "the cover shows", V.coverSeen, V.coverSeen, "the cover within 2 minutes");
    await V.page.touchscreen.tap(195, 300); await V.wait(2500); await V.pace();
    let l = await V.look("start", true);
    check(V, "after the tap, the mage is on the start tile, facing the player", near(l, START.x, START.y, 1) && l.mage.facing === "down", at(l), "x 144, y 80, facing down");
    check(V, "the stick is drawn, with the knob resting on the middle of the base", knobAt(l, 0, 0, 1), kn(l), "the knob 0, 0 from the base's middle");
    check(V, "the picture matches the shared files", l.pictureWrongPct <= 1, l.pictureWrongPct + "% of pixels wrong", "1% or less");
    check(V, "outside the picture is #2a1a14", l.barsRightColorPct === null || l.barsRightColorPct >= 99, l.barsRightColorPct, "99% or more");
    await V.finger.down(1, STICK.x, STICK.y); await V.finger.slide(1, STICK.x + 45, STICK.y); await V.wait(2000); l = await V.look("thumb-right"); await V.finger.lift(1); await V.wait(1500); const after = await V.look();
    check(V, "a thumb on the stick moves the knob and walks the mage, and the knob goes back", l.mage && l.mage.x - START.x >= 20 && Math.abs(l.mage.y - START.y) <= 1 && knobAt(l, 28, 0) && knobAt(after, 0, 0, 1) && after.mage.facing === "right", { mage: at(l), knobHeld: kn(l), knobAfter: kn(after), mageAfter: at(after) }, "the mage walking right, the knob 28 out and then back");
    check(V, "no page errors", V.errs.length === 0, [...new Set(V.errs)].slice(0, 6), "none");
    await V.close();
  }

  // ---------- An upright phone, one thumb: the walking ----------
  {
    const V = await open({ name: "phone", width: 390, height: 844, dpr: 1, touch: true });
    check(V, "the cover shows", V.coverSeen, V.coverSeen, "the cover within 2 minutes");
    await V.page.touchscreen.tap(195, 300); await V.wait(1500); await V.pace(); slow(V);
    let l = await V.look("start", true), b;
    check(V, "after the tap, the mage is on the start tile, facing the player", near(l, START.x, START.y, 1) && l.mage.facing === "down", at(l), "x 144, y 80, facing down");
    check(V, "the stick is drawn, with the knob resting on the middle of the base", knobAt(l, 0, 0, 1), kn(l), "the knob 0, 0 from the base's middle");
    check(V, "the picture matches the shared files", l.pictureWrongPct <= 1, l.pictureWrongPct + "% of pixels wrong", "1% or less");

    // The knob follows the thumb and stops 28 pixels out.
    await V.finger.down(1, STICK.x + 6, STICK.y); await V.wait(600); l = await V.look("thumb-6-right");
    check(V, "a thumb 6 pixels off the middle moves the knob there", knobAt(l, 6, 0), kn(l), "the knob at 6, 0");
    check(V, "and the mage stands still (8 pixels or less)", near(l, START.x, START.y, 1), at(l), "x 144, y 80");
    await V.finger.slide(1, STICK.x - 30, STICK.y - 40); await V.wait(300); l = await V.look("thumb-far-up-left");
    check(V, "a thumb 50 pixels out holds the knob 28 pixels out, on the thumb's side", knobAt(l, -16.8, -22.4), kn(l), "the knob at -16.8, -22.4");
    await V.finger.lift(1); await V.wait(400); l = await V.look();
    check(V, "the knob goes back to the middle when the thumb lifts", knobAt(l, 0, 0, 1), kn(l), "the knob at 0, 0");

    // Up from under the house is the house.
    b = l; await V.push(0, -1, 700); l = await V.look("up-against-the-house");
    check(V, "walking up below the house, the mage stops at the house", l.mage && b.mage && Math.abs(l.mage.y - 74) <= WALL && Math.abs(l.mage.x - b.mage.x) <= 1 && clear(l), at(l), "x " + (b.mage ? b.mage.x : "?") + ", y 74");
    check(V, "and faces up", l.mage && l.mage.facing === "up", at(l), "facing up");
    // The four corners, and the edges.
    await V.push(-1, 0, 2000); l = await V.look("left-edge");
    check(V, "walking left, the mage stops at the lot's left edge", l.mage && Math.abs(l.mage.x - MIN) <= WALL && onLot(l), at(l), "x 16");
    check(V, "and faces left", l.mage && l.mage.facing === "left", at(l), "facing left");
    await V.push(0, -1, 1200); await V.push(-1, -1, 700); l = await V.look("corner-top-left");
    check(V, "the top left corner is reached, and the mage can't leave it", near(l, MIN, MIN, WALL) && onLot(l), at(l), "x 16, y 16");
    await V.push(1, 0, 1400); l = await V.look("house-left-wall");
    check(V, "walking right along the top, the mage stops at the house's left wall", near(l, 86, 16, WALL) && clear(l), at(l), "x 86, y 16");
    check(V, "and faces right", l.mage && l.mage.facing === "right", at(l), "facing right");
    await V.push(1, 1, 350); l = await V.look("slide-down-the-wall");
    check(V, "pushing down and right against that wall, the mage slides down it", l.mage && Math.abs(l.mage.x - 86) <= WALL && l.mage.y >= 24 && l.mage.y <= 72 && clear(l), at(l), "x 86, y between 24 and 72");
    await V.push(0, 1, 4500); await V.push(-1, 0, 1500); await V.push(-1, 1, 600); l = await V.look("corner-bottom-left");
    check(V, "the bottom left corner is reached, and the mage can't leave it", near(l, MIN, MAX_Y, WALL) && onLot(l), at(l), "x 16, y 368");
    await V.push(1, 0, 3500); l = await V.look();
    check(V, "walking right along the bottom, the mage faces right", l.mage && l.mage.facing === "right", at(l), "facing right");
    await V.push(1, 1, 600); l = await V.look("corner-bottom-right");
    check(V, "the bottom right corner is reached, and the mage can't leave it", near(l, MAX_X, MAX_Y, WALL) && onLot(l), at(l), "x 272, y 368");
    await V.push(0, -1, 4500); await V.push(1, -1, 600); l = await V.look("corner-top-right");
    check(V, "the top right corner is reached, and the mage can't leave it", near(l, MAX_X, MIN, WALL) && onLot(l), at(l), "x 272, y 16");
    // The crate, and the gap above it. Walls put the mage where the test needs it, so nothing here turns on timing.
    b = await V.walkTo(MAX_X, 47, 9); await V.push(-1, 0, 900); l = await V.look("crate-right-side");
    check(V, "walking left at the crate's height, the mage stops at the crate", l.mage && b.mage && Math.abs(l.mage.x - 234) <= WALL && Math.abs(l.mage.y - b.mage.y) <= 1 && clear(l), at(l), "x 234, y " + (b.mage ? b.mage.y : "?"));
    await V.push(1, 0, 300); await V.push(0, -1, 900); await V.push(-1, 0, 1000); l = await V.look("between-house-and-crate");
    check(V, "above the crate, the mage walks in as far as the house's right wall", near(l, 202, 16, WALL) && clear(l), at(l), "x 202, y 16");
    await V.push(0, 1, 700); l = await V.look("on-top-of-crate");
    check(V, "and walking down from there, it stops at the top of the crate", near(l, 202, 22, WALL) && clear(l), at(l), "x 202, y 22");
    // Out to open ground for the rest: up and right to the corner, down the right side, then in.
    await V.push(0, -1, 400); await V.push(1, 0, 1100); await V.walkTo(MAX_X, 208, 10); l = await V.walkTo(144, 208, 8);
    check(V, "the mage walks over rubble and weeds to the middle of the lot", near(l, 144, 208, 8 + V.q * 1.5), at(l), "about x 144, y 208");
    check(V, "the picture still matches the shared files, with the mage drawn over the things on the lot", l.pictureWrongPct <= 1, l.pictureWrongPct + "% of pixels wrong", "1% or less");

    // Facing, at slants. The mage keeps its facing after it stops.
    // (An exactly even slant can't be made with a finger, so that one is tried with the keys, at PC size.)
    for (const [dx, dy, want] of [[2, 1, "right"], [1, 2, "down"], [-1, -2, "up"], [-2, -1, "left"], [-5, -4, "left"], [4, 5, "down"], [5, -4, "right"], [-4, 5, "down"], [4, -5, "up"]]) {
      b = await V.look(); await V.push(dx, dy, 400); l = await V.look();
      check(V, "a push toward " + dx + ", " + dy + " walks that way and leaves the mage facing " + want, went(V, b, l, dx, dy, 0.4) && l.mage.facing === want, how(b, l), about(dx, dy, 0.4) + ", facing " + want);
    }
    // Speed: two pushes along open ground, one two seconds longer than the other.
    const run = async (dx, dy, ms) => { const s0 = await V.look(); await V.push(dx, dy, ms); const e = await V.look(); return s0.mage && e.mage ? Math.hypot(e.mage.x - s0.mage.x, e.mage.y - s0.mage.y) : NaN; };
    const home = async (x, y) => { await V.push(-1, 0, 3200); await V.walkTo(MIN, y, 6); };
    await home(MIN, 84); let d1 = await run(1, 0, 500); await home(MIN, 84); let d2 = await run(1, 0, 2500);
    check(V, "the mage walks at 96 pixels a second", Math.abs((d2 - d1) / 2 - SPEED) <= 4 + V.q, { halfSecond: round(d1), twoAndAHalfSeconds: round(d2), pixelsASecond: round((d2 - d1) / 2) }, "192 pixels more in the push two seconds longer");
    await home(MIN, 100); d1 = await run(1, 1, 500); await home(MIN, 100); d2 = await run(1, 1, 2500);
    check(V, "and at the same 96 pixels a second at a slant", Math.abs((d2 - d1) / 2 - SPEED) <= 4 + V.q, { halfSecond: round(d1), twoAndAHalfSeconds: round(d2), pixelsASecond: round((d2 - d1) / 2) }, "192 pixels more in the push two seconds longer");
    // Just past the 8 pixel rest: full speed.
    await V.walkTo(60, 208); b = await V.look(); await V.finger.down(1, STICK.x + 12, STICK.y); await V.wait(700); l = await V.look("thumb-12-right"); await V.finger.lift(1); await V.wait(300);
    check(V, "a thumb 12 pixels off the middle walks the mage", l.mage && b.mage && l.mage.x - b.mage.x >= SPEED * 0.7 - 2 * V.q - 8 && knobAt(l, 12, 0), { moved: l.mage && b.mage ? l.mage.x - b.mage.x : null, knob: kn(l) }, "moved about 67 pixels in 0.7 seconds, the knob at 12, 0");
    // The thumb keeps hold when it slides off the strip.
    await V.walkTo(144, 300); b = await V.look(); await V.finger.down(1, STICK.x, STICK.y); await V.finger.slide(1, STICK.x + 20, STICK.y - 60); await V.finger.slide(1, 144, 300); await V.wait(600); l = await V.look("thumb-slid-onto-the-lot"); await V.finger.lift(1); await V.wait(300);
    check(V, "a thumb that slides off the strip onto the lot keeps hold of the stick", l.mage && b.mage && b.mage.y - l.mage.y >= 20 && l.mage.x - b.mage.x >= 4 && !!l.knob && Math.hypot(l.knob.dx, l.knob.dy) >= 26, { moved: l.mage && b.mage ? { x: l.mage.x - b.mage.x, y: l.mage.y - b.mage.y } : null, knob: kn(l) }, "the mage walking up and a little right, the knob 28 pixels out");
    // Touches that start somewhere else do nothing.
    await V.walkTo(144, 208); b = await V.look();
    await V.finger.down(1, 144, 300); await V.finger.slide(1, 110, 480); await V.finger.slide(1, STICK.x + 25, STICK.y); await V.wait(600); l = await V.look("touch-from-the-lot"); await V.finger.lift(1); await V.wait(250);
    check(V, "a touch that starts on the lot and slides onto the stick does nothing", near(l, b.mage.x, b.mage.y, 1) && knobAt(l, 0, 0, 1), { mage: at(l), knob: kn(l) }, "the mage and the knob where they were");
    await V.finger.down(1, 216, STICK.y); await V.finger.slide(1, 150, STICK.y); await V.finger.slide(1, STICK.x + 25, STICK.y); await V.wait(600); l = await V.look("touch-from-the-right-half"); await V.finger.lift(1); await V.wait(250);
    check(V, "a touch that starts in the right half of the strip does nothing", near(l, b.mage.x, b.mage.y, 1) && knobAt(l, 0, 0, 1), { mage: at(l), knob: kn(l) }, "the mage and the knob where they were");
    // A second finger doesn't disturb the first.
    await V.push(-1, 0, 3200); await V.walkTo(MIN, 208, 6); b = await V.look();
    await V.finger.down(1, STICK.x, STICK.y); await V.finger.slide(1, STICK.x + 45, STICK.y); await V.wait(400);
    await V.finger.down(2, 216, STICK.y); await V.finger.slide(2, 200, STICK.y - 150); await V.wait(400); const mid = await V.look("second-finger-down");
    await V.finger.lift(2); await V.wait(500); const late = await V.look("second-finger-lifted"); await V.finger.lift(1); await V.wait(400); l = await V.look();
    check(V, "a second finger put down and lifted does not disturb the thumb on the stick", mid.mage && late.mage && l.mage && mid.mage.x - b.mage.x >= SPEED * 0.8 - 2 * V.q - 8 && late.mage.x - mid.mage.x >= SPEED * 0.5 - 2 * V.q - 8 && Math.abs(l.mage.y - b.mage.y) <= 1 && knobAt(mid, 28, 0) && knobAt(late, 28, 0) && knobAt(l, 0, 0, 1),
      { movedWithTwoFingers: mid.mage && b.mage ? mid.mage.x - b.mage.x : null, movedAfterTheSecondLifted: late.mage && mid.mage ? late.mage.x - mid.mage.x : null, driftedUpOrDown: l.mage && b.mage ? l.mage.y - b.mage.y : null, knobs: [kn(mid), kn(late), kn(l)] }, "walking right the whole time, then the knob back at rest");
    // The page keeps still.
    const still = await V.page.evaluate(() => ({ scrollX: window.scrollX, scrollY: window.scrollY, zoom: window.visualViewport ? window.visualViewport.scale : 1, selected: String(window.getSelection ? window.getSelection() : "").length }));
    check(V, "after all that dragging the page has not scrolled, zoomed or selected anything", still.scrollX === 0 && still.scrollY === 0 && still.zoom === 1 && still.selected === 0, still, "no scroll, zoom 1, nothing selected");
    check(V, "no page errors", V.errs.length === 0, [...new Set(V.errs)].slice(0, 6), "none");
    await V.close();
  }

  // ---------- A small phone: the tap that takes the cover away, made on the stick ----------
  {
    const V = await open({ name: "small-phone", width: 360, height: 640, dpr: 1, touch: true });
    check(V, "the cover shows", V.coverSeen, V.coverSeen, "the cover within 2 minutes");
    await V.finger.down(1, STICK.x + 20, STICK.y); await V.wait(250); await V.finger.lift(1); await V.wait(1500); await V.pace(); slow(V);
    let l = await V.look("cover-tapped-where-the-stick-is");
    check(V, "a tap on the cover where the stick will be takes the cover away and does not move the mage", near(l, START.x, START.y, 1) && l.mage.facing === "down" && knobAt(l, 0, 0, 1), { mage: at(l), knob: kn(l) }, "the mage on the start tile, the knob at rest");
    check(V, "the picture matches the shared files at this size", l.pictureWrongPct <= 1, l.pictureWrongPct + "% of pixels wrong", "1% or less");
    await V.push(1, 0, 500); const e = await V.look("then-the-stick-works");
    check(V, "and the stick works after that", went(V, l, e, 1, 0, 0.5) && e.mage.facing === "right", how(l, e), about(1, 0, 0.5) + ", facing right");
    check(V, "no page errors", V.errs.length === 0, [...new Set(V.errs)].slice(0, 6), "none");
    await V.close();
  }

  // ---------- A phone turned sideways: the same upright picture, and the stick still under the thumb ----------
  {
    const V = await open({ name: "phone-sideways", width: 640, height: 360, dpr: 2, touch: true });
    check(V, "the cover shows", V.coverSeen, V.coverSeen, "the cover within 2 minutes");
    await V.page.touchscreen.tap(320, 150); await V.wait(1500); await V.pace(); slow(V);
    let l = await V.look("start", true);
    check(V, "the picture matches the shared files, stick and all", l.pictureWrongPct <= 3 && knobAt(l, 0, 0, 1), { wrongPct: l.pictureWrongPct, knob: kn(l) }, "3% or less, the knob at rest");
    await V.push(0, 1, 500); let e = await V.look("stick-down");
    check(V, "the stick walks the mage here too", went(V, l, e, 0, 1, 0.5) && e.mage.facing === "down", how(l, e), about(0, 1, 0.5) + ", facing down");
    const b = e; await V.finger.down(1, STICK.x, STICK.y); await V.finger.slide(1, STICK.x + 30, STICK.y); await V.finger.slide(1, 440, STICK.y); await V.wait(600); l = await V.look("thumb-off-the-picture"); await V.finger.lift(1); await V.wait(300);
    check(V, "a thumb that slides off the picture onto the bars keeps hold of the stick", l.mage && b.mage && l.mage.x - b.mage.x >= SPEED * 0.6 - 2 * V.q - 8 && knobAt(l, 28, 0), { moved: l.mage && b.mage ? l.mage.x - b.mage.x : null, knob: kn(l) }, "the mage walking right, the knob 28 pixels out");
    check(V, "no page errors", V.errs.length === 0, [...new Set(V.errs)].slice(0, 6), "none");
    await V.close();
  }

  // ---------- A PC: the mouse on the stick, and the keys ----------
  {
    const V = await open({ name: "pc", width: 1280, height: 720, dpr: 1, touch: false });
    check(V, "the cover shows", V.coverSeen, V.coverSeen, "the cover within 2 minutes");
    await V.page.mouse.click(640, 300); await V.wait(1500); await V.pace(); slow(V);
    let l = await V.look("start", true), b;
    check(V, "the picture matches the shared files, stick and all", l.pictureWrongPct <= 3 && knobAt(l, 0, 0, 1) && near(l, START.x, START.y, 1), { wrongPct: l.pictureWrongPct, knob: kn(l), mage: at(l) }, "3% or less, the knob at rest, the mage on the start tile");
    await V.mouse.down(STICK.x, STICK.y); await V.mouse.slide(STICK.x - 45, STICK.y); await V.wait(600); l = await V.look("mouse-on-the-stick"); await V.mouse.lift(); await V.wait(400); const after = await V.look();
    check(V, "the mouse works the stick: press, drag, let go", l.mage && START.x - l.mage.x >= SPEED * 0.6 - 2 * V.q - 8 && knobAt(l, -28, 0, 2) && knobAt(after, 0, 0, 1) && after.mage.facing === "left", { mage: at(l), knobHeld: kn(l), knobAfter: kn(after) }, "the mage walking left, the knob 28 out and then back");
    const press = async (keys, ms) => { for (const k of keys) await V.page.keyboard.down(k); await V.wait(ms); for (const k of keys) await V.page.keyboard.up(k); await V.wait(Math.max(200, 3000 / Math.max(1, V.fps || 30))); };
    await V.walkTo(144, 208);
    for (const [keys, dx, dy, want] of [[["d"], 1, 0, "right"], [["s"], 0, 1, "down"], [["a"], -1, 0, "left"], [["w"], 0, -1, "up"], [["ArrowRight"], 1, 0, "right"], [["ArrowDown"], 0, 1, "down"], [["ArrowLeft"], -1, 0, "left"], [["ArrowUp"], 0, -1, "up"], [["d", "s"], 1, 1, "right"], [["ArrowLeft", "ArrowUp"], -1, -1, "left"], [["a", "s"], -1, 1, "left"], [["ArrowRight", "ArrowUp"], 1, -1, "right"]]) {
      // The facing is read while the keys are still down: two keys never lift in the same instant, and the one
      // that lifts last would turn the mage its own way for a frame.
      b = await V.look(); const t0 = Date.now(); for (const k of keys) await V.page.keyboard.down(k); await V.wait(400); const held = await V.look(); const secs = (Date.now() - t0) / 1000; await press(keys, 0); l = await V.look();
      check(V, "the key" + (keys.length > 1 ? "s " : " ") + keys.join(" and ") + " walk" + (keys.length > 1 ? "" : "s") + " the mage, facing " + want, went(V, b, l, dx, dy, secs) && held.mage && held.mage.facing === want && (keys.length > 1 || l.mage.facing === want),
        { ...how(b, l), facingWhileHeld: held.mage ? held.mage.facing : null, seconds: round(secs) }, about(dx, dy, secs) + ", facing " + want);
    }
    const run = async (keys, ms) => { const s0 = await V.look(); await press(keys, ms); const e = await V.look(); return s0.mage && e.mage ? Math.hypot(e.mage.x - s0.mage.x, e.mage.y - s0.mage.y) : NaN; };
    const home = async (y) => { await press(["a"], 3200); await V.walkTo(MIN, y, 6); };
    await home(84); let d1 = await run(["d"], 500); await home(84); let d2 = await run(["d"], 2500);
    check(V, "with a key the mage walks at 96 pixels a second", Math.abs((d2 - d1) / 2 - SPEED) <= 4 + V.q, { halfSecond: round(d1), twoAndAHalfSeconds: round(d2), pixelsASecond: round((d2 - d1) / 2) }, "192 pixels more in the press two seconds longer");
    await home(100); d1 = await run(["d", "s"], 500); await home(100); d2 = await run(["d", "s"], 2500);
    check(V, "and with two keys, at a slant, the same 96 pixels a second", Math.abs((d2 - d1) / 2 - SPEED) <= 4 + V.q, { halfSecond: round(d1), twoAndAHalfSeconds: round(d2), pixelsASecond: round((d2 - d1) / 2) }, "192 pixels more in the press two seconds longer");
    await press(["a"], 3200); await press(["w"], 4200); await press(["a", "w"], 500); l = await V.look("keys-into-the-corner");
    check(V, "the keys can't walk the mage off the lot either", near(l, MIN, MIN, WALL) && onLot(l), at(l), "x 16, y 16");
    check(V, "no page errors", V.errs.length === 0, [...new Set(V.errs)].slice(0, 6), "none");
    await V.close();
  }

  await rulerBrowser.close(); server.close();
  const files = [...seen.entries()].filter(([, n]) => n >= 0).sort((p, q) => q[1] - p[1]);
  report.download = { files: files.length, bytes: files.reduce((n, [, b]) => n + b, 0), biggest: files[0] ? { file: files[0][0], bytes: files[0][1] } : null };
  report.notFound = [...seen.entries()].filter(([, n]) => n < 0).map(([p]) => p);
  report.passed = report.checks.filter((c) => c.ok).length; report.missed = report.checks.filter((c) => !c.ok).length;
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("\n" + report.passed + " checks passed, " + report.missed + " missed. " + path.join(out, "report.json"));
})().catch((e) => { console.error(e); process.exit(1); });
