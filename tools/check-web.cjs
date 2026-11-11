// The referee's browser check, the same for both builds. It serves a build's web folder the way a plain
// web host would, opens it in headless Chromium at phone and PC sizes, takes screenshots, and measures
// them against a picture drawn straight from the shared files.
//
//   node tools/check-web.cjs <web folder> <folder for screenshots>
//
// It changes nothing in a build. It needs Node and Playwright with Chromium.
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");

const web = path.resolve(process.argv[2] || "web");
const out = path.resolve(process.argv[3] || "check-out");
const shared = path.join(__dirname, "..", "shared");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".png": "image/png", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".txt": "text/plain" };

// What step 1 asks for: one upright picture, 9 tiles wide and 18 tall, as big as fits, centered.
const PIC_W = 288, PIC_H = 576, TOP = 48, COVER = "#2f5a2a", BARS = "#2a1a14", WORDS = "#fff4d8";

const VIEWS = [
  { name: "phone", width: 390, height: 844, dpr: 3, touch: true },
  { name: "phone-with-browser-bars", width: 390, height: 664, dpr: 3, touch: true },
  { name: "phone-sideways", width: 844, height: 390, dpr: 3, touch: true },
  { name: "small-phone", width: 360, height: 640, dpr: 2, touch: true },
  { name: "pc", width: 1280, height: 720, dpr: 1, touch: false, thenResize: { width: 500, height: 900 } },
];

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

// Runs inside a blank page: measures a screenshot against what the ask describes.
async function measure({ shot, sheet, sprites, lot, W, H, dpr, mode, PIC_W, PIC_H, TOP, COVER, BARS, WORDS }) {
  const load = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  const img = await load("data:image/png;base64," + shot), art = await load("data:image/png;base64," + sheet);
  const w = img.width, h = img.height;
  const got = Object.assign(document.createElement("canvas"), { width: w, height: h }).getContext("2d", { willReadFrequently: true });
  got.drawImage(img, 0, 0);
  const s = Math.min(W / PIC_W, H / PIC_H) * dpr, pw = PIC_W * s, ph = PIC_H * s, x0 = (w - pw) / 2, y0 = (h - ph) / 2;
  const want = Object.assign(document.createElement("canvas"), { width: w, height: h }).getContext("2d", { willReadFrequently: true });
  want.imageSmoothingEnabled = false;
  want.fillStyle = BARS; want.fillRect(0, 0, w, h); want.fillStyle = COVER; want.fillRect(x0, y0, pw, ph);
  if (mode === "lot") {
    const T = 32, draw = (name, tx, ty) => { const sp = sprites.sprites[name]; want.drawImage(art, sp.x, sp.y, T, T, x0 + tx * T * s, y0 + (TOP + ty * T) * s, T * s, T * s); };
    lot.ground.forEach((r, ty) => [...r].forEach((ch, tx) => draw(lot.ground_legend[ch], tx, ty)));
    lot.things.forEach((r, ty) => [...r].forEach((ch, tx) => { const n = lot.things_legend[ch]; if (n) draw(n, tx, ty); }));
    draw("mage_down", lot.start.x, lot.start.y);
  }
  const a = got.getImageData(0, 0, w, h).data, b = want.getImageData(0, 0, w, h).data;
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const near = (o, c, tol) => Math.abs(a[o] - c[0]) <= tol && Math.abs(a[o + 1] - c[1]) <= tol && Math.abs(a[o + 2] - c[2]) <= tol;
  const cBars = hex(BARS), cCover = hex(COVER), cWords = hex(WORDS);
  let inside = 0, outside = 0, diffIn = 0, barsOk = 0, coverOk = 0, words = 0, bx0 = w, bx1 = -1, by0 = h, by1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    // leave a one-pixel rim around the picture's edge out of the count, where rounding may fall either way
    const dx = Math.min(Math.abs(x - x0), Math.abs(x - (x0 + pw))), dy = Math.min(Math.abs(y - y0), Math.abs(y - (y0 + ph)));
    const isIn = x >= x0 && x < x0 + pw && y >= y0 && y < y0 + ph;
    if ((dx < 1.5 && y > y0 - 2 && y < y0 + ph + 2) || (dy < 1.5 && x > x0 - 2 && x < x0 + pw + 2)) continue;
    if (isIn) {
      inside++;
      if (Math.abs(a[o] - b[o]) > 24 || Math.abs(a[o + 1] - b[o + 1]) > 24 || Math.abs(a[o + 2] - b[o + 2]) > 24) diffIn++;
      if (near(o, cCover, 8)) coverOk++;
      if (near(o, cWords, 40)) { words++; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    } else { outside++; if (near(o, cBars, 8)) barsOk++; }
  }
  const pct = (n, d) => d ? Math.round((n / d) * 10000) / 100 : null, tile = 32 * s;
  const r = { image: w + "x" + h, picture: { x: Math.round(x0), y: Math.round(y0), w: Math.round(pw), h: Math.round(ph) }, barsRightColorPct: pct(barsOk, outside) };
  if (mode === "cover") Object.assign(r, { coverColorPct: pct(coverOk, inside), wordsPixels: words,
    wordsBox: words ? { tilesWide: +((bx1 - bx0 + 1) / tile).toFixed(2), tilesTall: +((by1 - by0 + 1) / tile).toFixed(2), offCenterXTiles: +((((bx0 + bx1) / 2) - w / 2) / tile).toFixed(2), offCenterYTiles: +((((by0 + by1) / 2) - h / 2) / tile).toFixed(2) } : null });
  else r.differsFromSharedFilesPct = pct(diffIn, inside);
  return r;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { server, seen, url } = await serve();
  const sheet = fs.readFileSync(path.join(shared, "sprites.png")).toString("base64");
  const sprites = JSON.parse(fs.readFileSync(path.join(shared, "sprites.json"), "utf8")), lot = JSON.parse(fs.readFileSync(path.join(shared, "lot.json"), "utf8"));
  const rulerBrowser = await chromium.launch();
  const ruler = await (await rulerBrowser.newContext()).newPage();
  const size = (shot, v, mode) => ruler.evaluate(measure, { shot: shot.toString("base64"), sheet, sprites, lot, W: v.width, H: v.height, dpr: v.dpr, mode, PIC_W, PIC_H, TOP, COVER, BARS, WORDS });
  const report = { web, views: {}, errors: [] };
  for (const v of VIEWS) {
    // A real screen's pixel density, not only an emulated one: with emulation alone the browser tells a page
    // its canvas has one screen pixel for each CSS pixel, which no real phone does.
    const browser = await chromium.launch({ args: ["--force-device-scale-factor=" + v.dpr] });
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dpr, hasTouch: v.touch, isMobile: v.touch });
    const page = await ctx.newPage(), errs = [];
    page.on("pageerror", (e) => errs.push("page error: " + String(e.message).slice(0, 300)));
    page.on("console", (m) => { if (m.type() === "error") errs.push("console error: " + m.text().slice(0, 300)); });
    const t0 = Date.now();
    await page.goto(url, { waitUntil: "load", timeout: 120000 });
    // Wait for the cover: the picture in the cover's color with the words on it, seen twice in a row.
    let cover = null, shot = null, hits = 0;
    while (Date.now() - t0 < 120000) {
      await page.waitForTimeout(700); shot = await page.screenshot(); cover = await size(shot, v, "cover");
      hits = cover.coverColorPct > 80 && cover.wordsPixels > 50 ? hits + 1 : 0; if (hits >= 2) break;
    }
    const secondsToCover = +((Date.now() - t0) / 1000).toFixed(1);
    fs.writeFileSync(path.join(out, v.name + "-1-cover.png"), shot);
    if (v.touch) await page.touchscreen.tap(v.width / 2, v.height / 2); else await page.mouse.click(v.width / 2, v.height / 2);
    await page.waitForTimeout(1500); shot = await page.screenshot();
    fs.writeFileSync(path.join(out, v.name + "-2-lot.png"), shot);
    const res = { size: v.width + "x" + v.height + " @" + v.dpr, coverSeen: hits >= 2, secondsToCover, cover, lot: await size(shot, v, "lot") };
    if (v.thenResize) {
      await page.setViewportSize(v.thenResize); await page.waitForTimeout(1500); shot = await page.screenshot();
      fs.writeFileSync(path.join(out, v.name + "-3-resized.png"), shot);
      res.afterResize = { size: v.thenResize.width + "x" + v.thenResize.height, lot: await size(shot, { ...v, ...v.thenResize }, "lot") };
    }
    if (errs.length) res.errors = [...new Set(errs)].slice(0, 8);
    report.views[v.name] = res;
    await ctx.close(); await browser.close();
  }
  await rulerBrowser.close(); server.close();
  const files = [...seen.entries()].filter(([, n]) => n >= 0).sort((p, q) => q[1] - p[1]);
  report.download = { files: files.length, bytes: files.reduce((n, [, b]) => n + b, 0), biggest: files[0] ? { file: files[0][0], bytes: files[0][1] } : null };
  report.notFound = [...seen.entries()].filter(([, n]) => n < 0).map(([p]) => p);
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
