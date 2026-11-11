// The referee's kit, shared by the checks from step 3 on. It is the same for both builds and knows nothing
// about either engine: it serves a web folder like a plain host, works the page with real touches, mouse
// presses and keys, and reads everything it judges from screenshots (and, for sound, from what the page
// sends to the speakers).
//
// What it reads from one screenshot ("look"):
//   - where the mage is and which way it faces,
//   - what is on every tile of the lot (the ground, the thing on it, and whether the aim mark is there),
//   - where the stick's knob is, how full the mana bar is, and which picture each button shows,
//   - how much of the picture can't be explained by the shared art.
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");

const shared = path.join(__dirname, "..", "shared");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".png": "image/png", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".txt": "text/plain", ".pck": "application/octet-stream" };

// The picture, in sprite-sheet pixels: 288 by 576. A 48 pixel strip, the lot (288 by 384), a 144 pixel strip.
// Places on the lot are the middle of the mage's sprite, counted from the lot's top-left corner.
const K = { PIC_W: 288, PIC_H: 576, TOP: 48, LOT_W: 9, LOT_H: 12, T: 32, STICK: { x: 72, y: 504 }, REACH: 28, SPEED: 96, START: { x: 144, y: 80 }, MIN: 16, MAX_X: 272, MAX_Y: 368,
  HOUSE: { x0: 96, y0: 0, x1: 192, y1: 64 }, CRATE: { x0: 192, y0: 32, x1: 224, y1: 64 }, HALF: 10, MANA: { x: 8, y: 8, w: 120, h: 12, full: 100, back: 6.5 } };

// What is on the screen besides the lot, by step: the stick, the mana bar, the spell buttons, the counts.
const BUTTONS = [
  { name: "gust", from: 3, x: 156, y: 444, on: "spell_gust", off: "spell_gust_off", cost: 8, key: "1" },
  { name: "break_ground", from: 4, x: 220, y: 444, on: "spell_break_ground", off: "spell_break_ground_off", cost: 14, key: "2" },
  { name: "sprout", from: 4, x: 156, y: 508, on: "spell_sprout", off: "spell_sprout_off", cost: 10, key: "3" },
  { name: "draw", from: 5, x: 220, y: 508, on: "spell_draw", off: "spell_draw_off", cost: 10, key: "4" },
];
const COUNTS = [{ name: "seeds", from: 4, icon: "icon_seed", x: 8, y: 26, dx: 28, dy: 27, max: 3 }, { name: "crops", from: 5, icon: "icon_crop", x: 72, y: 26, dx: 92, dy: 27, max: 3 }];
const layoutFor = (step) => ({ stick: step >= 2, mana: step >= 3, buttons: BUTTONS.filter((b) => step >= b.from), counts: COUNTS.filter((c) => step >= c.from) });

function serve(web) {
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

// ---------------- The ruler: runs in a blank page of its own ----------------
async function rulerSetup({ sheet, controls, sprites, lot, ctl }) {
  const load = (b64) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = "data:image/png;base64," + b64; });
  const mk = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h }).getContext("2d", { willReadFrequently: true });
  const art = await load(sheet), con = await load(controls), T = 32;
  const box = (data, w, h) => { let x0 = w, x1 = -1, y0 = h, y1 = -1, n = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] >= 128) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { data, w, h, x0, y0, x1, y1, n }; };
  const R = { load, mk, sprite: {}, piece: {}, lot, tiles: new Map() };
  for (const [name, sp] of Object.entries(sprites.sprites)) { const c = mk(T, T); c.drawImage(art, sp.x, sp.y, T, T, 0, 0, T, T); R.sprite[name] = box(c.getImageData(0, 0, T, T).data, T, T); }
  for (const [name, p] of Object.entries(ctl.pieces)) { const c = mk(p.w, p.h); c.drawImage(con, p.x, p.y, p.w, p.h, 0, 0, p.w, p.h); R.piece[name] = box(c.getImageData(0, 0, p.w, p.h).data, p.w, p.h); }
  // For finding the mage: a handful of its own pixels, spread over the sprite, to try before the whole sprite.
  R.mage = {};
  for (const f of ["down", "up", "left", "right"]) { const sp = R.sprite["mage_" + f], solid = []; for (let i = 0; i < T * T; i++) if (sp.data[i * 4 + 3] >= 128) solid.push(i); const pick = []; for (let k = 0; k < 8; k++) pick.push(solid[Math.floor(((k + 0.5) * solid.length) / 8)]); R.mage[f] = { sp, solid, pick }; }
  // What a tile can look like: its ground, one thing on it or none, with the aim mark or without.
  R.tile = (ground, thing, aim) => { const key = ground + "|" + thing + "|" + aim; let t = R.tiles.get(key); if (t) return t; t = new Uint8Array(T * T * 3);
    const lay = (pc) => { for (let i = 0; i < T * T; i++) if (pc.data[i * 4 + 3] >= 128) { t[i * 3] = pc.data[i * 4]; t[i * 3 + 1] = pc.data[i * 4 + 1]; t[i * 3 + 2] = pc.data[i * 4 + 2]; } };
    lay(R.sprite[ground]); if (thing) lay(R.sprite[thing]); if (aim) lay(R.piece.aim); R.tiles.set(key, t); return t; };
  window.R = R; return Object.keys(R.sprite).length;
}

async function rulerLook({ shot, W, H, dpr, wantBars, layout, K }) {
  const R = window.R, T = 32, PW = 288, PH = 576, TOP = K.TOP, img = await R.load(shot), w = img.width, h = img.height, g = R.mk(w, h); g.drawImage(img, 0, 0);
  const a = g.getImageData(0, 0, w, h).data, s = Math.min(W / PW, H / PH) * dpr, x0 = (w - PW * s) / 2, y0 = (h - PH * s) / 2;
  // The color at the middle of each of the picture's pixels.
  const pic = new Uint8Array(PW * PH * 3);
  for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) { const sx = Math.max(0, Math.min(w - 1, Math.floor(x0 + (px + 0.5) * s))), sy = Math.max(0, Math.min(h - 1, Math.floor(y0 + (py + 0.5) * s))), o = (sy * w + sx) * 4, i = (py * PW + px) * 3; pic[i] = a[o]; pic[i + 1] = a[o + 1]; pic[i + 2] = a[o + 2]; }
  const TOL = 24, off = (i, c, j) => Math.abs(pic[i] - c[j]) > TOL || Math.abs(pic[i + 1] - c[j + 1]) > TOL || Math.abs(pic[i + 2] - c[j + 2]) > TOL;
  const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)], is = (i, c, tol = TOL) => Math.abs(pic[i] - c[0]) <= tol && Math.abs(pic[i + 1] - c[1]) <= tol && Math.abs(pic[i + 2] - c[2]) <= tol;
  const res = { mage: null, knob: null, tiles: [], aimed: [], mana: null, buttons: {} };
  // What the picture should be, built up as each part is found. -1 where nothing is known.
  const want = new Int16Array(PW * PH * 3).fill(-1), set = (p, r, gg, b) => { want[p * 3] = r; want[p * 3 + 1] = gg; want[p * 3 + 2] = b; };
  const strip = rgb("#2f5a2a"); for (let y = 0; y < PH; y++) if (y < TOP || y >= TOP + 384) for (let x = 0; x < PW; x++) set(y * PW + x, ...strip);
  const layPiece = (pc, tx, ty) => { for (let y = 0; y < pc.h; y++) for (let x = 0; x < pc.w; x++) { const q = (y * pc.w + x) * 4; if (pc.data[q + 3] >= 128 && tx + x >= 0 && tx + x < PW && ty + y >= 0 && ty + y < PH) set((ty + y) * PW + tx + x, pc.data[q], pc.data[q + 1], pc.data[q + 2]); } };

  // ---- the mage: tried at every place on the lot, a few of its pixels first, then all of them ----
  { let best = null;
    for (const [f, m] of Object.entries(R.mage)) for (let ty = TOP - 8; ty <= TOP + 384 - T + 8; ty++) for (let tx = -8; tx <= PW - T + 8; tx++) {
      let miss = 0; for (const i of m.pick) { const x = tx + (i % T), y = ty + ((i / T) | 0); if (x < 0 || x >= PW || y < 0 || y >= PH || off((y * PW + x) * 3, m.sp.data, i * 4)) { if (++miss > 2) break; } }
      if (miss > 2) continue; let wrong = 0; const cap = best ? best.wrong : m.solid.length * 0.3;
      for (const i of m.solid) { const x = tx + (i % T), y = ty + ((i / T) | 0); if (x < 0 || x >= PW || y < 0 || y >= PH || off((y * PW + x) * 3, m.sp.data, i * 4)) { if (++wrong > cap) break; } }
      if (wrong <= cap && (!best || wrong < best.wrong)) best = { f, tx, ty, wrong };
    }
    if (best) res.mage = { x: best.tx + 16, y: best.ty + 16 - TOP, facing: best.f, wrongPixels: best.wrong, tileX: Math.floor((best.tx + 16) / T), tileY: Math.floor((best.ty + 16 - TOP) / T), tx: best.tx, ty: best.ty }; }
  const mageMask = new Uint8Array(PW * PH); if (res.mage) { const sp = R.mage[res.mage.facing].sp; for (const i of R.mage[res.mage.facing].solid) { const x = res.mage.tx + (i % T), y = res.mage.ty + ((i / T) | 0); if (x >= 0 && x < PW && y >= 0 && y < PH) mageMask[y * PW + x] = 1; } }

  // ---- every tile of the lot: which ground, which thing, aim mark or not ----
  const grounds = (tx, ty) => [...new Set([R.lot.ground_legend[R.lot.ground[ty][tx]], "soil", "soil_wet"])], things = [null, "rubble", "weeds", "crate", "crop_seed", "crop_sprout", "crop_grown", "crop_ripe"];
  for (let ty = 0; ty < K.LOT_H; ty++) { const row = []; for (let tx = 0; tx < K.LOT_W; tx++) { let best = null;
      for (const gr of grounds(tx, ty)) for (const th of things) for (const aim of [false, true]) { const t = R.tile(gr, th, aim); let wrong = 0, seen = 0;
          for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const p = (TOP + ty * T + y) * PW + tx * T + x; if (mageMask[p]) continue; seen++; if (off(p * 3, t, (y * T + x) * 3)) wrong++; }
          if (!best || wrong < best.wrong) best = { ground: gr, thing: th, aim, wrong, seen }; }
      row.push({ ground: best.ground, thing: best.thing, aim: best.aim, wrongPixels: best.wrong }); if (best.aim) res.aimed.push({ x: tx, y: ty });
      const t = R.tile(best.ground, best.thing, best.aim); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) set((TOP + ty * T + y) * PW + tx * T + x, t[(y * T + x) * 3], t[(y * T + x) * 3 + 1], t[(y * T + x) * 3 + 2]); }
    res.tiles.push(row); }
  if (res.mage) layPiece(R.mage[res.mage.facing].sp, res.mage.tx, res.mage.ty);

  // ---- the bottom strip: the stick's base, the buttons, then the knob as what is left over ----
  if (layout.stick) layPiece(R.piece.stick_base, K.STICK.x - 48, K.STICK.y - 48);
  for (const b of layout.buttons || []) { const score = (name) => { const pc = R.piece[name]; let wrong = 0; for (let y = 0; y < pc.h; y++) for (let x = 0; x < pc.w; x++) { const q = (y * pc.w + x) * 4; if (pc.data[q + 3] >= 128 && off(((b.y + y) * PW + b.x + x) * 3, pc.data, q)) wrong++; } return wrong; };
    const on = score(b.on), offS = score(b.off), shows = Math.min(on, offS) > R.piece[b.on].n * 0.25 ? "neither" : on <= offS ? "on" : "off"; res.buttons[b.name] = { shows, wrongPixels: Math.min(on, offS) }; if (shows !== "neither") layPiece(R.piece[shows === "on" ? b.on : b.off], b.x, b.y); }
  if (layout.stick) { const kp = R.piece.stick_knob; let bx0 = PW, bx1 = -1, by0 = PH, by1 = -1, n = 0;
    for (let y = TOP + 384; y < PH; y++) for (let x = 0; x < 144; x++) { const p = y * PW + x; if (Math.abs(pic[p * 3] - want[p * 3]) > TOL || Math.abs(pic[p * 3 + 1] - want[p * 3 + 1]) > TOL || Math.abs(pic[p * 3 + 2] - want[p * 3 + 2]) > TOL) { n++; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; } }
    if (n > 40) { let best = null; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const tx = bx0 - kp.x0 + dx, ty = by0 - kp.y0 + dy; let wrong = 0;
          for (let y = 0; y < kp.h; y++) for (let x = 0; x < kp.w; x++) { const q = (y * kp.w + x) * 4, X = tx + x, Y = ty + y; if (kp.data[q + 3] < 128) continue; if (X < 0 || X >= PW || Y < 0 || Y >= PH || off((Y * PW + X) * 3, kp.data, q)) wrong++; }
          if (!best || wrong < best.wrong) best = { tx, ty, wrong }; }
      res.knob = { dx: best.tx + kp.w / 2 - K.STICK.x, dy: best.ty + kp.h / 2 - K.STICK.y, wrongPixels: best.wrong }; layPiece(kp, best.tx, best.ty); } }

  // ---- the mana bar: a border, and inside it the mana from the left ----
  if (layout.mana) { const m = K.MANA, border = rgb("#fff4d8"), full = rgb("#5ac8e8"), empty = rgb("#1f3a36"); let borderOk = 0, borderN = 0, wrong = 0; const fills = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (x === 0 || y === 0 || x === m.w - 1 || y === m.h - 1) { borderN++; const p = (m.y + y) * PW + m.x + x; if (is(p * 3, border)) borderOk++; set(p, ...border); }
    for (let y = 1; y < m.h - 1; y++) { let fill = 0; while (fill < m.w - 2 && is(((m.y + y) * PW + m.x + 1 + fill) * 3, full)) fill++; fills.push(fill); }
    fills.sort((p, q) => p - q); const fill = fills[fills.length >> 1];
    for (let y = 1; y < m.h - 1; y++) for (let x = 0; x < m.w - 2; x++) { const p = (m.y + y) * PW + m.x + 1 + x, c = x < fill ? full : empty; if (!is(p * 3, c)) wrong++; set(p, ...c); }
    res.mana = { filledPixels: fill, mana: Math.round((fill / (m.w - 2)) * 1000) / 10, borderRightPct: Math.round((borderOk / borderN) * 100), wrongPixelsInside: wrong }; }

  // ---- the counts: a small picture, then a number written with the digit pieces ----
  res.counts = {};
  for (const c of layout.counts || []) { const ic = R.piece[c.icon]; let iconWrong = 0;
    for (let y = 0; y < ic.h; y++) for (let x = 0; x < ic.w; x++) { const q = (y * ic.w + x) * 4; if (ic.data[q + 3] >= 128 && off(((c.y + y) * PW + c.x + x) * 3, ic.data, q)) iconWrong++; }
    layPiece(ic, c.x, c.y); let text = "", wrongPx = 0;
    for (let k = 0; k < (c.max || 3); k++) { const X = c.dx + k * 12; let best = null, ink = 0;
      for (let y = 0; y < 14; y++) for (let x = 0; x < 10; x++) if (!is(((c.dy + y) * PW + X + x) * 3, strip)) ink++;
      if (ink <= 6) break;
      for (let d = 0; d <= 9; d++) { const pc = R.piece["digit_" + d]; let w = 0; for (let y = 0; y < 14; y++) for (let x = 0; x < 10; x++) { const q = (y * 10 + x) * 4, p = ((c.dy + y) * PW + X + x) * 3; if (pc.data[q + 3] >= 128 ? off(p, pc.data, q) : !is(p, strip)) w++; } if (!best || w < best.w) best = { d, w }; }
      wrongPx += best.w; if (best.w > 20) text += "?"; else { text += best.d; layPiece(R.piece["digit_" + best.d], X, c.dy); } }
    res.counts[c.name] = { text, value: /^[0-9]+$/.test(text) ? Number(text) : null, iconWrongPixels: iconWrong, wrongPixels: wrongPx }; }

  // ---- how much of the picture the shared art can't explain ----
  let wrong = 0; for (let p = 0; p < PW * PH; p++) if (want[p * 3] >= 0 && (Math.abs(pic[p * 3] - want[p * 3]) > TOL || Math.abs(pic[p * 3 + 1] - want[p * 3 + 1]) > TOL || Math.abs(pic[p * 3 + 2] - want[p * 3 + 2]) > TOL)) wrong++;
  res.pictureWrongPct = Math.round((wrong / (PW * PH)) * 10000) / 100;
  if (wantBars) { let n = 0, ok = 0; for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { if (x >= x0 - 2 && x < x0 + PW * s + 2 && y >= y0 - 2 && y < y0 + PH * s + 2) continue; const o = (y * w + x) * 4; n++; if (Math.abs(a[o] - 0x2a) <= 8 && Math.abs(a[o + 1] - 0x1a) <= 8 && Math.abs(a[o + 2] - 0x14) <= 8) ok++; } res.barsRightColorPct = n ? Math.round((ok / n) * 10000) / 100 : null; }
  if (res.mage) { delete res.mage.tx; delete res.mage.ty; }
  return res;
}

async function rulerCover({ shot, W, H, dpr }) {
  const R = window.R, img = await R.load(shot), w = img.width, h = img.height, g = R.mk(w, h); g.drawImage(img, 0, 0);
  const a = g.getImageData(0, 0, w, h).data, s = Math.min(W / 288, H / 576) * dpr, x0 = (w - 288 * s) / 2, y0 = (h - 576 * s) / 2; let n = 0, cov = 0, words = 0;
  for (let y = Math.ceil(y0); y < y0 + 576 * s - 1; y += 2) for (let x = Math.ceil(x0); x < x0 + 288 * s - 1; x += 2) { const o = (y * w + x) * 4; n++;
    if (Math.abs(a[o] - 0x2f) <= 8 && Math.abs(a[o + 1] - 0x5a) <= 8 && Math.abs(a[o + 2] - 0x2a) <= 8) cov++; else if (Math.abs(a[o] - 0xff) <= 40 && Math.abs(a[o + 1] - 0xf4) <= 40 && Math.abs(a[o + 2] - 0xd8) <= 40) words++; }
  return { coverPct: (cov / n) * 100, words };
}

// Put into the game's page before it starts: everything the page sends to the speakers also goes to a meter
// that keeps the last half minute of it. The meter sits on the browser's own sound thread, so it misses nothing
// while the page is busy (the test browser holds a page's timers back for a moment after each touch). It
// changes nothing a player hears. Asked "what since then?", it answers with a reading for every 20 milliseconds:
// the time, the loudest point, and the strongest pitch in hertz (0 when it is quiet).
function soundMeter() {
  const recs = [], connect = AudioNode.prototype.connect;
  const code = 'class RefereeMeter extends AudioWorkletProcessor { constructor() { super(); this.buf = new Float32Array(1024); this.n = 0; this.t = 0; }' +
    ' process(inputs) { const inp = inputs[0], L = inp && inp[0], R = inp && inp[1]; if (this.n === 0) this.t = currentTime;' +
    ' for (let i = 0; i < 128; i++) this.buf[this.n + i] = L ? (R ? (L[i] + R[i]) / 2 : L[i]) : 0;' +
    ' this.n += 128; if (this.n >= 1024) { this.port.postMessage({ t: this.t, w: Date.now(), s: this.buf }); this.buf = new Float32Array(1024); this.n = 0; } return true; } }' +
    ' registerProcessor("referee-meter", RefereeMeter);';
  // The meter takes a moment to load, and a page may play its first sound in that moment. So a second, plain
  // listener is there from the start and remembers the last two thirds of a second; when the meter is ready,
  // what the listener remembers is put in front of the meter's own blocks.
  const tap = (ctx) => { if (ctx.__tap) return ctx.__tap; const g = ctx.createGain(); connect.call(g, ctx.destination); ctx.__tap = g; const rec = { ctx, blocks: [], ready: false, error: null }; recs.push(rec);
    try { const mute = ctx.createGain(); mute.gain.value = 0; connect.call(mute, ctx.destination);
      const early = ctx.createAnalyser(); early.fftSize = 32768; early.channelCount = 1; early.channelCountMode = "explicit"; connect.call(g, early); connect.call(early, mute);
      ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: "text/javascript" }))).then(() => {
        const node = new AudioWorkletNode(ctx, "referee-meter", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: "explicit" });
        node.port.onmessage = (e) => { rec.blocks.push(e.data); if (rec.blocks.length > 1400) rec.blocks.shift(); };
        connect.call(g, node); connect.call(node, mute);
        const snap = new Float32Array(32768), tS = ctx.currentTime, wS = Date.now(), len = 1024 / ctx.sampleRate; early.getFloatTimeDomainData(snap);
        for (let k = 0; k < 32; k++) { const t = tS - (32 - k) * len; if (t >= 0) rec.blocks.push({ t, w: wS - (31 - k) * len * 1000, s: snap.slice(k * 1024, (k + 1) * 1024) }); }
        early.disconnect(); rec.ready = true; }).catch((e) => { rec.error = String(e); }); } catch (e) { rec.error = String(e); }
    return g; };
  AudioNode.prototype.connect = function (dest, ...rest) {
    try { if (dest instanceof AudioDestinationNode && !(typeof OfflineAudioContext !== "undefined" && dest.context instanceof OfflineAudioContext)) return connect.call(this, tap(dest.context), ...rest); } catch (e) { /* fall through to the page's own call */ }
    return connect.call(this, dest, ...rest);
  };
  // The strongest pitch in 2048 samples: a plain FFT, as nothing here needs to be fast.
  const N = 2048, re = new Float64Array(N), im = new Float64Array(N), hann = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  function pitch(all, end, rate) {
    for (let i = 0; i < N; i++) { const k = end - N + i; re[i] = k >= 0 ? all[k] * hann[i] : 0; im[i] = 0; }
    for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { const a = re[i]; re[i] = re[j]; re[j] = a; } }
    for (let len = 2; len <= N; len <<= 1) { const ang = (-2 * Math.PI) / len; for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) { const wr = Math.cos(ang * k), wi = Math.sin(ang * k), a = i + k, b = a + len / 2, xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr; re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; } }
    let top = 0, at = 0; for (let i = 2; i < 512; i++) { const m = re[i] * re[i] + im[i] * im[i]; if (m > top) { top = m; at = i; } } return (at * rate) / N;
  }
  // The sound thread's clock drifts against the page's clock, so every block of sound carries the wall-clock
  // time it was finished at. A block can be stamped late but never early, so the earliest stamp among its
  // neighbors (a second either side) says when it really played.
  function since(t0) {
    const out = [], wallToPage = Date.now() - performance.now();
    for (const rec of recs) { const rate = rec.ctx.sampleRate, len = (1024 / rate) * 1000, bl = rec.blocks; if (!bl.length) continue;
      const lag = bl.map((b) => b.w - b.t * 1000), start = bl.map((b, k) => { let m = Infinity; for (let j = k; j >= 0 && b.t - bl[j].t <= 1; j--) if (lag[j] < m) m = lag[j]; for (let j = k + 1; j < bl.length && bl[j].t - b.t <= 1; j++) if (lag[j] < m) m = lag[j]; return b.t * 1000 + m - wallToPage - len; });
      let from = 0; while (from < bl.length - 1 && start[from + 1] < t0 - 200) from++;
      const n = bl.length - from, all = new Float32Array(n * 1024); for (let k = 0; k < n; k++) all.set(bl[from + k].s, k * 1024); const hop = Math.round(rate * 0.02);
      for (let a = 0; a + hop <= all.length; a += hop) { const k = Math.floor(a / 1024), at = start[from + k] + ((a - k * 1024) / rate) * 1000; if (at < t0) continue; let peak = 0; for (let i = a; i < a + hop; i++) { const v = Math.abs(all[i]); if (v > peak) peak = v; }
        out.push([at, peak, peak > 0.02 ? Math.round(pitch(all, a + hop, rate)) : 0]); } }
    return out.sort((p, q) => p[0] - q[0]);
  }
  window.__sound = { now: () => performance.now(), since, states: () => recs.map((r) => r.ctx.state + (r.error ? ", meter failed: " + r.error : r.ready ? "" : ", meter not ready")) };
}

// What was heard since a moment, summed up from the meter's readings: how loud, for how long, and its pitch
// (the middle reading, and the pitch at its start and at its end).
function heardIn(log, t) {
  const round = (n) => Math.round(n * 100) / 100, loud = log.filter((e) => e[1] > 0.02), peak = log.reduce((m, e) => Math.max(m, e[1]), 0);
  const mid = (list) => { const v = list.map((e) => e[2]).filter((h) => h > 0).sort((p, q) => p - q); return v.length ? v[v.length >> 1] : 0; }, third = Math.max(1, Math.ceil(loud.length / 3));
  return { heard: loud.length > 0, loudest: round(peak), seconds: loud.length ? round((loud[loud.length - 1][0] - loud[0][0] + 20) / 1000) : 0, startsAfterMs: loud.length ? Math.round(loud[0][0] - t) : null,
    hz: mid(loud), hzStart: mid(loud.slice(0, third)), hzEnd: mid(loud.slice(-third)), readings: log.length };
}
// Which of the shared sounds it was: the one whose pitch, length and rise or fall are nearest.
function nameSound(s, refs) {
  if (!s.heard || !refs) return null; const lg = (a, b) => Math.log2(Math.max(20, a) / Math.max(20, b)); let best = null;
  for (const [name, r] of Object.entries(refs)) { const d = Math.abs(lg(s.hz, r.hz)) + 3 * Math.abs(s.seconds - r.seconds) + 0.5 * Math.abs(lg(s.hzEnd, s.hzStart) - lg(r.hzEnd, r.hzStart)); if (!best || d < best.d) best = { name, d }; }
  return best.name;
}

// ---------------- A referee for one web folder ----------------
async function referee(web, out, step, layout) {
  fs.mkdirSync(out, { recursive: true });
  const { server, seen, url } = await serve(web);
  const b64 = (f) => fs.readFileSync(path.join(shared, f)).toString("base64"), json = (f) => JSON.parse(fs.readFileSync(path.join(shared, f), "utf8"));
  const lot = json("lot.json");
  const rulerBrowser = await chromium.launch(), ruler = await (await rulerBrowser.newContext()).newPage();
  await ruler.evaluate(rulerSetup, { sheet: b64("sprites.png"), controls: b64("controls.png"), sprites: json("sprites.json"), lot, ctl: json("controls.json") });
  // Each shared sound is played once through the same meter the game's page gets, in a page of the referee's
  // own. What the meter makes of it there is what a build's sound is compared with.
  const sounds = {};
  { const list = json("sounds.json").sounds, sb = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] }), sc = await sb.newContext(); await sc.addInitScript(soundMeter); const sp = await sc.newPage(); await sp.goto(url + "__no_such_page__").catch(() => {});
    for (const [name, sd] of Object.entries(list)) { const log = await sp.evaluate(async ({ b, ms }) => { window.__ctx = window.__ctx || new AudioContext(); const raw = Uint8Array.from(atob(b), (ch) => ch.charCodeAt(0)).buffer, abuf = await window.__ctx.decodeAudioData(raw), src = window.__ctx.createBufferSource(); src.buffer = abuf; src.connect(window.__ctx.destination);
        await new Promise((ok) => setTimeout(ok, 400)); const t = window.__sound.now(); src.start(); await new Promise((ok) => setTimeout(ok, ms + 450)); return { t, log: window.__sound.since(t) }; }, { b: b64(sd.file), ms: sd.seconds * 1000 });
      sounds[name] = heardIn(log.log, log.t); }
    await sb.close(); }
  const report = { web, step, checks: [], views: {}, sharedSoundsThroughTheMeter: sounds };
  const round = (n) => Math.round(n * 100) / 100;

  // One view of the game: a browser at a real pixel density, the page loaded, and hands to work it with.
  async function open(v) {
    const browser = await chromium.launch({ args: ["--force-device-scale-factor=" + v.dpr] });
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dpr, hasTouch: v.touch, isMobile: v.touch, ...(v.film ? { recordVideo: { dir: path.join(out, "film"), size: { width: v.width, height: v.height } } } : {}) });
    await ctx.addInitScript(soundMeter);
    const page = await ctx.newPage(), errs = [], cdp = await ctx.newCDPSession(page);
    page.on("pageerror", (e) => errs.push("page error: " + String(e.message).slice(0, 300)));
    page.on("console", (m) => { if (m.type() === "error") errs.push("console error: " + m.text().slice(0, 300)); });
    const s = Math.min(v.width / K.PIC_W, v.height / K.PIC_H), gx = (v.width - K.PIC_W * s) / 2, gy = (v.height - K.PIC_H * s) / 2;
    const css = (px, py) => ({ x: round(gx + px * s), y: round(gy + py * s) });
    let shots = 0;
    const V = { v, page, errs, css, name: v.name, fps: null, q: 3,
      async shot(label) { const b = await page.screenshot(); if (label) fs.writeFileSync(path.join(out, v.name + "-" + String(++shots).padStart(2, "0") + "-" + label + ".png"), b); return b; },
      // One look: a screenshot, read by the ruler. "at" is the clock time the screenshot was taken, to the nearest it can be known.
      // It comes in two halves, for when there is no time to read between two screenshots: snap takes the
      // screenshot (quick), read has the ruler read it (a third of a second).
      async snap(label) { const t0 = Date.now(), b = await page.screenshot(), t1 = Date.now(); if (label) fs.writeFileSync(path.join(out, v.name + "-" + String(++shots).padStart(2, "0") + "-" + label + ".png"), b); return { b, at: (t0 + t1) / 2 }; },
      async read(s, wantBars) { const l = await ruler.evaluate(rulerLook, { shot: s.b.toString("base64"), W: v.width, H: v.height, dpr: v.dpr, wantBars: !!wantBars, layout, K }); l.at = s.at; return l; },
      async look(label, wantBars) { return V.read(await V.snap(label), wantBars); },
      // Slows the page's own work, the way a slow phone would (1 is not slowed).
      slow: (rate) => cdp.send("Emulation.setCPUThrottlingRate", { rate }),
      wait: (ms) => page.waitForTimeout(ms),
      // Frames a second the page is drawing right now, and from that how far the mage goes in one frame.
      async pace() { V.fps = round(await page.evaluate(() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else ok(n / 1.5); }; requestAnimationFrame(f); }))); V.q = Math.max(2, K.SPEED / Math.max(1, V.fps)); return V.fps; },
      settle: () => V.wait(Math.max(200, 3000 / Math.max(1, V.fps || 30))),
      async close() { report.views[v.name] = { size: v.width + "x" + v.height + " @" + v.dpr, secondsToCover: V.secondsToCover, framesASecondInTheTestBrowser: V.fps }; const video = v.film ? page.video() : null; await ctx.close(); if (video) { const f = await video.path(); fs.renameSync(f, path.join(out, v.film)); } await browser.close(); } };
    // Fingers, as real touch events. A finger is put down, slid and lifted by its number.
    const pts = new Map();
    const send = (type) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: [...pts].map(([id, p]) => ({ id, x: p.x, y: p.y, radiusX: 6, radiusY: 6, force: 1 })) });
    V.finger = { down: async (id, px, py) => { pts.set(id, css(px, py)); await send("touchStart"); }, slide: async (id, px, py) => { pts.set(id, css(px, py)); await send("touchMove"); },
      // One finger lifts while the others stay: a touch end that names just that finger. (Leaving it out of the
      // next move does not lift it in the test browser.)
      lift: async (id) => { const p = pts.get(id); if (!p) return; pts.delete(id); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [{ id, x: p.x, y: p.y, radiusX: 6, radiusY: 6, force: 1 }] }); } };
    V.mouse = { down: async (px, py) => { const p = css(px, py); await page.mouse.move(p.x, p.y); await page.mouse.down(); }, slide: async (px, py) => { const p = css(px, py); await page.mouse.move(p.x, p.y); }, lift: () => page.mouse.up() };
    // A short press at a place on the picture, with a finger of its own (number 7) or the mouse.
    // It is held for at least two and a half of the page's frames, as no real tap is shorter than a frame.
    V.tap = async (px, py, ms) => { ms = ms || Math.max(60, 2500 / Math.max(1, V.fps || 30)); if (v.touch) { await V.finger.down(7, px, py); await V.wait(ms); await V.finger.lift(7); } else { await V.mouse.down(px, py); await V.wait(ms); await V.mouse.lift(); } };
    V.tapTile = (tx, ty, ms) => V.tap(tx * K.T + 16, K.TOP + ty * K.T + 16, ms);
    V.tapButton = (b, ms) => V.tap(b.x + 28, b.y + 28, ms);
    // Holds the stick toward (dx, dy) for some milliseconds, then lets the game settle.
    V.push = async (dx, dy, ms, far = 45) => { const m = Math.hypot(dx, dy), tx = K.STICK.x + (dx / m) * far, ty = K.STICK.y + (dy / m) * far;
      if (v.touch) { await V.finger.down(1, K.STICK.x, K.STICK.y); await V.finger.slide(1, tx, ty); await V.wait(ms); await V.finger.lift(1); }
      else { await V.mouse.down(K.STICK.x, K.STICK.y); await V.mouse.slide(tx, ty); await V.wait(ms); await V.mouse.lift(); }
      await V.settle(); };
    // Walks the mage to about a place on open ground, by pushing, looking, and pushing again.
    V.walkTo = async (x, y, tol = 6) => { let l = null; for (let i = 0; i < 10; i++) { l = await V.look(); if (!l.mage) return l; const dx = x - l.mage.x, dy = y - l.mage.y, dist = Math.hypot(dx, dy); if (dist <= Math.max(tol, V.q * 1.5)) return l;
        await V.push(dx, dy, Math.max(20, (dist / K.SPEED) * 1000 - 1500 / Math.max(1, V.fps || 30))); } return V.look(); };
    // Walks to the middle of a tile, across first and then up or down, or the other way round.
    V.walkToTile = async (tx, ty, tol = 6) => V.walkTo(tx * K.T + 16, ty * K.T + 16, tol);
    // Sound: what the page has sent to the speakers since a moment, as how loud and for how long.
    V.sound = { now: () => page.evaluate(() => window.__sound.now()), states: () => page.evaluate(() => window.__sound.states()), readings: (t) => page.evaluate((t0) => window.__sound.since(t0), t),
      async since(t) { const s = heardIn(await page.evaluate((t0) => window.__sound.since(t0), t), t); s.name = nameSound(s, sounds); return s; } };
    const t0 = Date.now(); await page.goto(url, { waitUntil: "load", timeout: 120000 });
    let hits = 0; while (Date.now() - t0 < 120000) { await V.wait(700); const c = await ruler.evaluate(rulerCover, { shot: (await page.screenshot()).toString("base64"), W: v.width, H: v.height, dpr: v.dpr }); hits = c.coverPct > 80 && c.words > 20 ? hits + 1 : 0; if (hits >= 2) break; }
    V.coverSeen = hits >= 2; V.secondsToCover = round((Date.now() - t0) / 1000);
    return V;
  }
  // One line of the report. "want" is what the ask says, "got" what the page showed.
  const check = (V, name, ok, got, want) => { const c = { view: V.name, check: name, ok: !!ok, got, want }; report.checks.push(c); console.log((c.ok ? "  ok   " : "  MISS ") + V.name + ": " + name + (c.ok ? "" : "  got " + JSON.stringify(got) + ", want " + want)); return c.ok; };
  async function finish() {
    await rulerBrowser.close(); server.close();
    const files = [...seen.entries()].filter(([, n]) => n >= 0).sort((p, q) => q[1] - p[1]);
    report.download = { files: files.length, bytes: files.reduce((n, [, b]) => n + b, 0), biggest: files[0] ? { file: files[0][0], bytes: files[0][1] } : null };
    report.notFound = [...seen.entries()].filter(([, n]) => n < 0).map(([p]) => p);
    report.passed = report.checks.filter((c) => c.ok).length; report.missed = report.checks.filter((c) => !c.ok).length;
    fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
    console.log("\n" + report.passed + " checks passed, " + report.missed + " missed. " + path.join(out, "report.json"));
    return report;
  }
  // Small helpers every step's check uses.
  const at = (l) => (l.mage ? { x: l.mage.x, y: l.mage.y, facing: l.mage.facing } : null);
  const near = (l, x, y, tol) => !!l.mage && Math.abs(l.mage.x - x) <= tol && Math.abs(l.mage.y - y) <= tol;
  const knobAt = (l, dx, dy, tol = 1.5) => !!l.knob && Math.abs(l.knob.dx - dx) <= tol && Math.abs(l.knob.dy - dy) <= tol;
  const thing = (l, tx, ty) => l.tiles[ty][tx].thing, aimedAt = (l) => (l.aimed.length === 1 ? l.aimed[0].x + "," + l.aimed[0].y : l.aimed.length ? "more than one" : "none");
  const lotThing = (tx, ty) => lot.things_legend[lot.things[ty][tx]];
  return { open, check, finish, report, lot, round, at, near, knobAt, thing, aimedAt, lotThing, sounds };
}

module.exports = { K, referee, serve, layoutFor, BUTTONS, COUNTS };
