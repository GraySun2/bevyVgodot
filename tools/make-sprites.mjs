// Draws the one sprite sheet that both builds use: shared/sprites.png and shared/sprites.json.
// Run: node tools/make-sprites.mjs
// Every sprite is drawn here in code on a 16 by 16 grid and doubled to a 32 by 32 pixel tile.
// The colors are the studio's own "Cozy top-down" palette. Making this sheet counts for neither build.
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const OUT = process.env.SPRITES_OUT || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "shared");
const G = 16, TILE = 32, COLS = 8;

const PAL = {
  a: "#2f5a2a", b: "#4a8a3a", c: "#6cb04a", d: "#8ccf5e", e: "#b4e27a", f: "#e8f0a0",
  g: "#6a4028", h: "#8a5a3a", i: "#a8744a", j: "#d8b07a", k: "#ecd2a0", l: "#fff4d8",
  m: "#3a7ac8", n: "#5aa8e8", o: "#9ad6f4",
  p: "#e8743a", q: "#f4a43a", r: "#ffd25a", s: "#e2604a", t: "#f2a0b0", u: "#ffffff",
  v: "#173c3a", w: "#ecdfc2", x: "#fbf4e2", y: "#7cbca4", z: "#9ed8bf",
  A: "#5a3a28", B: "#2a1a14", C: "#c84a3a", D: "#7a4a8a", E: "#b07ad0",
};

// A sprite is a grid of palette letters; "." is see-through.
function grid(rows, w = G, h = G) {
  if (rows.length !== h) throw new Error("want " + h + " rows, got " + rows.length);
  rows.forEach((r, n) => { if (r.length !== w) throw new Error("row " + n + " is " + r.length + " wide: " + r); });
  return rows.map((r) => r.split(""));
}
const blank = (w = G, h = G, ch = ".") => Array.from({ length: h }, () => Array(w).fill(ch));
function rect(g, x, y, w, h, ch) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && g[j][i] !== undefined) g[j][i] = ch; }
const put = (g, x, y, ch) => { if (g[y] && g[y][x] !== undefined) g[y][x] = ch; };
const mirror = (g) => g.map((r) => r.slice().reverse());
// A stone seen from above: outline, a light top-left, a shaded bottom-right.
function stone(g, x, y, w, h) {
  rect(g, x + 1, y, w - 2, h, "A"); rect(g, x, y + 1, w, h - 2, "A");
  rect(g, x + 1, y + 1, w - 2, h - 2, "w");
  rect(g, x + 1, y + 1, Math.max(1, w - 4), 1, "x"); put(g, x + 1, y + 2, "x");
  rect(g, x + 2, y + h - 2, w - 3, 1, "j"); rect(g, x + w - 2, y + 2, 1, h - 3, "j");
}

const S = {};

// ---------- the lot ----------
S.grass = grid([
  "dddddddddddddddd", "ddddddddddeddddd", "dddcddddddeedddd", "ddccdddddddddddd",
  "dddddddddddddddd", "ddddddddddddcddd", "dddddeddddddccdd", "ddddeedddddddddd",
  "dddddddddddddddd", "ddddddddcddddddd", "dcdddddccddddddd", "dccddddddddddedd",
  "ddddddddddddeedd", "dddddddddddddddd", "ddddddcddddddddd", "dddddddddddddddd"]);
S.grass_flowers = grid([
  "dddddddddddddddd", "dddddddddddcdddd", "ddduddddddccdddd", "dduruddddddddddd",
  "ddduddddddddtddd", "dddddddddddtrtdd", "ddddddeddddddtdd", "dddddeeddddddddd",
  "dddddddddddddddd", "ddcddddddddddddd", "dccddddduddddddd", "dddddddurudddddd",
  "dddddddduddddcdd", "ddddddddddddccdd", "dddeeddddddddddd", "dddddddddddddddd"]);
function soil(ring, base, hi, lo, glint) {
  const g = blank(G, G, base);
  rect(g, 0, 0, G, 1, ring); rect(g, 0, G - 1, G, 1, ring); rect(g, 0, 0, 1, G, ring); rect(g, G - 1, 0, 1, G, ring);
  ["0,0", "15,0", "0,15", "15,15"].forEach((c) => { const [x, y] = c.split(",").map(Number); put(g, x, y, "d"); });
  for (const y of [2, 6, 10]) { rect(g, 2, y, 12, 1, hi); rect(g, 2, y + 1, 12, 1, lo); }
  if (glint) { rect(g, 4, 4, 2, 1, glint); rect(g, 10, 8, 2, 1, glint); rect(g, 5, 12, 2, 1, glint); }
  return g;
}
S.soil = soil("A", "g", "i", "h", null);
S.soil_wet = soil("B", "A", "h", "g", "n");
S.rubble = (() => { const g = blank(); stone(g, 4, 2, 8, 7); stone(g, 0, 7, 8, 7); stone(g, 8, 8, 8, 6); return g; })();
S.weeds = grid([
  "................", "................", "....a.....a.....", "....ab...ab..E..",
  ".a...ab..ab.EDE.", ".ab..ab.ab...E..", "..ab.abab...a...", "..ab.abab..ab...",
  "a..abbbab.ab....", "ab.abbbbbab..a..", ".ababbcbbb..ab..", ".abbbbcbbbbab...",
  "..abbccbcbbb....", "..abbbcbbbba....", "...aabbbbaa.....", "................"]);
S.crate = grid([
  "................", ".gggggggggggggg.", ".gjjjjjjjjjjjjg.", ".gjkkkkkkkkkkjg.",
  ".gjkkkkkkkkkkjg.", ".gjjjjjjjjjjjjg.", ".gggggggggggggg.", ".giihiihiihiiig.",
  ".giihiihiihiiig.", ".giihrrhiihiiig.", ".giihrrhiihiiig.", ".giihiihiihiiig.",
  ".giihiihiihiiig.", ".gggggggggggggg.", "..AAAAAAAAAAAA..", "................"]);
S.stairs_down = grid([
  "dwwwwwwwwwwwwwwd", "wxxxxxxxxxxxxxxw", "wxkkkkkkkkkkkkxw", "wxjjjjjjjjjjjjxw",
  "wxjjjjjjjjjjjjxw", "wxiiiiiiiiiiiixw", "wxiiiiiiiiiiiixw", "wxhhhhhhhhhhhhxw",
  "wxhhhhhhhhhhhhxw", "wxggggggggggggxw", "wxggggggggggggxw", "wxAAAAAAAAAAAAxw",
  "wxAAAAAAAAAAAAxw", "wxBBBBBBBBBBBBxw", "wxBBBBBBBBBBBBxw", "dwwwwwwwwwwwwwwd"]);

// ---------- the crop, four stages, drawn over soil ----------
S.crop_seed = grid([
  "................", "................", "................", "................",
  "................", ".....k..........", "....kj....k.....", ".........kj.....",
  "................", "......k.........", ".....kj.....k...", "...........kj...",
  "................", "................", "................", "................"]);
S.crop_sprout = grid([
  "................", "................", "................", "................",
  "................", ".....e....e.....", "....edc..cde....", "....dccbbccd....",
  ".....ccbbcc.....", ".......bb.......", ".......bb.......", "......abba......",
  "................", "................", "................", "................"]);
S.crop_grown = grid([
  "................", "................", "................", ".....bb..bb.....",
  "....bccbbccb....", "...bcddccddcb...", "...bcdeccedcb...", "....bcdccdcb....",
  "..bb.bcccb.bb...", ".bccbbbcbbbccb..", ".bcdccbcbccdcb..", "..bcddcccddcb...",
  "...bbccbccbb....", ".....bbbbb......", "................", "................"]);
S.crop_ripe = grid([
  "................", "................", ".......bb.......", "......bccb......",
  ".....bc..cb.....", "....AAAbbAAA....", "...AqqqpqqqqA...", "..AqrqqpqqqqpA..",
  "..AqrqqpqqqqpA..", "..AqqqqpqqqqpA..", "..AqqqqpqqqppA..", "...ApqqpqqppA...",
  "....AAppppAA....", "......AAAA......", "................", "................"]);

// ---------- the mage, facing four ways ----------
const hat = [
  "................", ".......BB.......", "......BDEB......", "......BDDEB.....",
  ".....BDDDEB.....", ".....BDDDDEB....", "....BrrrrrrB....", "..BBDDDDDDDDBB..", "..BDDDDDDDDDDB.."];
const robe = ["...BmmnmmnmmB...", "...BkmmmmmmkB...", "....BmmmmmmB....", "....BABBBBAB...."];
S.mage_down = grid([...hat, "...BBkkkkkkBB...", "....BkBkkBkB....", "....BkkkkkkB....", ...robe]);
S.mage_up = grid([...hat, "...BBggggggBB...", "....BggggggB....", "....BggggggB....",
  "...BmmmmmmmmB...", "...BkmmmmmmkB...", "....BmmmmmmB....", "....BABBBBAB...."]);
S.mage_right = grid([...hat, "...BBggkkkkBB...", "....BgkkkBkB....", "....BgkkkkkB....",
  "...BmmmmnmmmB...", "...BmmmmmmkkB...", "....BmmmmmmB....", "....BABBBBAB...."]);
S.mage_left = mirror(S.mage_right);

// ---------- the house, three tiles wide and two tall ----------
(() => {
  const W = 48, H = 32, g = blank(W, H, "C");
  for (let y = 0; y < 20; y += 4) {                       // shingle rows
    rect(g, 0, y, W, 1, "s");
    for (let x = (y / 4) % 2 ? 4 : 0; x < W; x += 8) rect(g, x, y + 1, 1, 3, "A");
  }
  rect(g, 0, 9, W, 2, "s"); rect(g, 0, 11, W, 1, "A");     // the ridge
  rect(g, 0, 0, W, 1, "B"); rect(g, 0, 0, 1, 20, "B"); rect(g, W - 1, 0, 1, 20, "B");
  rect(g, 0, 19, W, 2, "B");                               // the eave and its shadow
  rect(g, 35, 3, 7, 6, "A"); rect(g, 36, 4, 5, 4, "i"); rect(g, 37, 5, 3, 2, "B"); // the chimney
  rect(g, 1, 21, W - 2, 10, "w"); rect(g, 1, 21, W - 2, 1, "j");                    // the front wall
  rect(g, 0, 21, 1, 11, "g"); rect(g, W - 1, 21, 1, 11, "g"); rect(g, 0, 31, W, 1, "g");
  for (const x of [6, 34]) {                                // two windows
    rect(g, x, 23, 8, 6, "g"); rect(g, x + 1, 24, 6, 4, "n"); rect(g, x + 1, 24, 3, 1, "o"); rect(g, x + 4, 24, 1, 4, "g");
  }
  rect(g, 20, 22, 8, 10, "g"); rect(g, 21, 23, 6, 9, "h"); rect(g, 21, 23, 6, 1, "i"); put(g, 25, 27, "r"); // the door
  const names = [["house_nw", "house_n", "house_ne"], ["house_sw", "house_s", "house_se"]];
  names.forEach((row, ty) => row.forEach((name, tx) => { S[name] = g.slice(ty * 16, ty * 16 + 16).map((r) => r.slice(tx * 16, tx * 16 + 16)); }));
})();

// ---------- the dungeon ----------
S.floor = (() => {
  const g = blank(G, G, "g");
  rect(g, 0, 7, G, 1, "A"); rect(g, 0, 15, G, 1, "A");
  rect(g, 7, 0, 1, 7, "A"); rect(g, 15, 0, 1, 7, "A"); rect(g, 3, 8, 1, 7, "A"); rect(g, 11, 8, 1, 7, "A");
  [[2, 2], [12, 4], [6, 10], [13, 12]].forEach(([x, y]) => put(g, x, y, "h"));
  return g;
})();
S.wall = (() => {
  const g = blank(G, G, "v");
  rect(g, 0, 7, G, 1, "B"); rect(g, 0, 15, G, 1, "B");
  rect(g, 3, 0, 1, 7, "B"); rect(g, 11, 0, 1, 7, "B"); rect(g, 7, 8, 1, 7, "B"); rect(g, 15, 8, 1, 7, "B");
  [[5, 2], [6, 2], [13, 10], [1, 12], [2, 12]].forEach(([x, y]) => put(g, x, y, "y"));
  return g;
})();
S.stairs_up = grid([
  "vBBBBBBBBBBBBBBv", "BffffffffffffffB", "BffffffffffffffB", "BkkkkkkkkkkkkkkB",
  "BkkkkkkkkkkkkkkB", "BjjjjjjjjjjjjjjB", "BjjjjjjjjjjjjjjB", "BiiiiiiiiiiiiiiB",
  "BiiiiiiiiiiiiiiB", "BhhhhhhhhhhhhhhB", "BhhhhhhhhhhhhhhB", "BggggggggggggggB",
  "BggggggggggggggB", "BAAAAAAAAAAAAAAB", "BAAAAAAAAAAAAAAB", "vBBBBBBBBBBBBBBv"]);
S.cache = grid([
  "................", "................", "......AAAA......", ".....AkkkkA.....",
  "......AjjA......", "....AAAkkAAA....", "...AkkkkkkkkA...", "..AkkkkkkkkkjA..",
  "..AkkkkcckkkjA..", "..AkkkcbbckkjA..", "..AkkkkbbkkkjA..", "..AkkkkbbkkjjA..",
  "..AjkkkkkkjjjA..", "...AjjjjjjjjA...", "....AAAAAAAA....", "................"]);
S.coins = grid([
  "................", "................", "................", "................",
  "................", "................", "................", "......AAAA......",
  ".....ArrrrA.....", "...AAAqrrqAAA...", "..ArrrAAAArrrA..", "..AqrrqAAqrrqA..",
  "...AqqA..AqqA...", "....AA....AA....", "................", "................"]);
// The four gates. Each one fills its tile and is drawn over the floor.
S.gate_rubble = (() => {
  const g = blank();
  stone(g, 0, 0, 7, 6); stone(g, 6, 0, 10, 5); stone(g, 3, 4, 8, 6); stone(g, 10, 4, 6, 7);
  stone(g, 0, 6, 5, 6); stone(g, 0, 11, 8, 5); stone(g, 7, 10, 9, 6);
  return g;
})();
S.gate_dirt = grid([
  "..AAAAAAAAAAAA..", ".AiiiiiiiiiiiiA.", "AiijiiiiiiijiihA", "AiiiiiigiiiiiihA",
  "AiiiiigiiiiiiihA", "AihiiigiiiijiihA", "AiiiiiiggiiiiihA", "AiiijiiiigiiiihA",
  "AiiiiiiiigiihihA", "AiigiiiiiiiiiihA", "AiiigiijiiiiiihA", "AiiigiiiiiigiihA",
  "AihiiiiiiiigiihA", "AiiiiiiiiiiiihhA", "AhhhhhhhhhhhhhhA", ".AAAAAAAAAAAAAA."]);
S.gate_vine = grid([
  "..A....hA...A...", ".AhA..AhA..AhA..", ".AhA.AhA...AhA..", "..AhAhA...AhA.j.",
  "j..AhhA..AhA....", "...AhhAAAhA.....", "..AhAhhhhA..AA..", ".AhA.AhhA..AhhA.",
  ".AhA..AhA.AhAAhA", "..AhA.AhAAhA..A.", "...AhAAhhhA..j..", "...AhhAhAhA.....",
  "..AhAAhA.AhA....", ".AhA.AhA..AhA...", ".AhA.AhA...AhA..", "..A...A.....A..."]);
S.gate_basin = grid([
  "................", "....AAAAAAAA....", "..AAxxxxxxxxAA..", ".AxxwwwwwwwwwwA.",
  ".AxwAAAAAAAAwjA.", "AxwAAgggggggAwjA", "AxwAgggAggggAwjA", "AxwAggggAgggAwjA",
  "AxwAggggAgggAwjA", "AxwAgggAggggAwjA", "AxwAAgggggggAwjA", ".AwwAAAAAAAAwjA.",
  ".AwjwwwwwwwwjjA.", "..AAjjjjjjjjAA..", "....AAAAAAAA....", "................"]);
// The creature: odd, not scary.
S.creature = grid([
  "................", "......r.........", "......B...r.....", ".......B..B.....",
  ".....BBBBBB.....", "...BBEEEEEEBB...", "..BEEEEEEEEEEB..", ".BEuuuEEEEuuuEB.",
  ".BEuBuEEEEuBuEB.", ".BEuuuEEEEuuuEB.", ".BDEEEEEEEEEEDB.", ".BDDEEEttEEEDDB.",
  "..BDDDEEEEDDDB..", "...BBDDDDDDBB...", "....BABBBBAB....", "................"]);

// ---------- lay the sheet out ----------
const ORDER = [
  "grass", "grass_flowers", "soil", "soil_wet", "rubble", "weeds", "crate", "stairs_down",
  "crop_seed", "crop_sprout", "crop_grown", "crop_ripe", "mage_down", "mage_up", "mage_left", "mage_right",
  "house_nw", "house_n", "house_ne", "floor", "wall", "stairs_up", "cache", "coins",
  "house_sw", "house_s", "house_se", "gate_rubble", "gate_dirt", "gate_vine", "gate_basin", "creature"];
const NOTES = {
  grass: "the lot's ground", grass_flowers: "the same ground with flowers, for variety",
  soil: "ground after Break Ground", soil_wet: "soil after Draw",
  rubble: "see-through, drawn over grass", weeds: "see-through, drawn over grass",
  crate: "the trade crate; see-through, drawn over grass", stairs_down: "the stairwell on the lot",
  crop_seed: "see-through, drawn over soil", crop_sprout: "see-through, drawn over soil",
  crop_grown: "see-through, drawn over soil", crop_ripe: "see-through, drawn over soil",
  mage_down: "the mage facing the player", mage_up: "the mage facing away", mage_left: "", mage_right: "",
  house_nw: "the house is 3 tiles wide and 2 tall", house_n: "", house_ne: "", house_sw: "", house_s: "", house_se: "",
  floor: "the dungeon's ground", wall: "the dungeon's walls", stairs_up: "the stairs back up, in the dungeon",
  cache: "the seed cache; see-through, drawn over floor", coins: "see-through, drawn over floor",
  gate_rubble: "opened by Gust; see-through, drawn over floor", gate_dirt: "opened by Break Ground; see-through, drawn over floor",
  gate_vine: "opened by Sprout; see-through, drawn over floor", gate_basin: "opened by Draw; see-through, drawn over floor",
  creature: "see-through, drawn over floor",
};
const ROWS = Math.ceil(ORDER.length / COLS), W = COLS * TILE, H = ROWS * TILE;
const px = Buffer.alloc(W * H * 4);
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const sprites = {};
ORDER.forEach((name, n) => {
  const g = S[name]; if (!g) throw new Error("no sprite " + name);
  const col = n % COLS, row = Math.floor(n / COLS);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const ch = g[y >> 1][x >> 1]; if (ch === ".") continue;
    if (!PAL[ch]) throw new Error("no color " + ch + " in " + name);
    const [r, gg, b] = hex(PAL[ch]), o = ((row * TILE + y) * W + col * TILE + x) * 4;
    px[o] = r; px[o + 1] = gg; px[o + 2] = b; px[o + 3] = 255;
  }
  sprites[name] = { col, row, x: col * TILE, y: row * TILE, ...(NOTES[name] ? { note: NOTES[name] } : {}) };
});

// ---------- the thumb controls: bigger than a tile, so they get their own picture ----------
// Drawn on the same 2-pixel grain as the sprites. A disc of radius r (in grain pixels) with an outline.
function disc(size, r, paint) {
  const g = blank(size, size), c = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
    if (d <= r) g[y][x] = paint(d, dx, dy);
  }
  return g;
}
const CONTROLS = {
  // The stick's base: a dark dish with a lighter rim and four small marks.
  stick_base: (() => {
    const g = disc(48, 24, (d) => (d > 22.5 ? "a" : d > 20.5 ? "b" : "v"));
    for (const [x, y] of [[23, 5], [24, 5], [23, 42], [24, 42], [5, 23], [5, 24], [42, 23], [42, 24]]) put(g, x, y, "b");
    return g;
  })(),
  // The stick's knob: a cream button, lit from the top left.
  stick_knob: disc(20, 10, (d, dx, dy) => (d > 8.5 ? "A" : dx + dy > 7 ? "j" : dx + dy < -7 ? "l" : "k")),
  // The mark on the aimed tile: four corner brackets, dark outside and yellow inside. One tile big.
  aim: (() => {
    const g = blank(16, 16);
    for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [15, 0, -1, 1], [0, 15, 1, -1], [15, 15, -1, -1]]) {
      for (let k = 0; k < 6; k++) { put(g, cx + sx * k, cy, "B"); put(g, cx, cy + sy * k, "B"); }
      for (let k = 1; k < 6; k++) { put(g, cx + sx * k, cy + sy, "r"); put(g, cx + sx, cy + sy * k, "r"); }
      put(g, cx + sx * 6, cy + sy, "B"); put(g, cx + sx, cy + sy * 6, "B");
      for (let k = 2; k < 6; k++) { put(g, cx + sx * k, cy + sy * 2, "B"); put(g, cx + sx * 2, cy + sy * k, "B"); }
    }
    return g;
  })(),
};

// The spell buttons: a rounded square 56 pixels across with the spell's sign on it. Each has a second
// picture for when the spell can't be afforded: dark, with a slash across it, so it doesn't turn on color alone.
const SIGNS = {
  gust: ["............", "....uuu.....", "...u...u....", ".......u....", "uuuuuuu.....", "............", "......uuu...", ".....u...u..", ".........u..", ".uuuuuuuu...", "............", "............"],
  break_ground: ["............", "............", "..k......k..", ".kkk....kkk.", "kkkkk..kkkkk", "............", "....kkkk....", "...kkkkkk...", "..kkkkkkkk..", "............", "............", "............"],
  sprout: ["............", "..ff....ff..", ".ffff..ffff.", ".fffff.ffff.", "..ffffffff..", "...ffffff...", ".....ff.....", ".....ff.....", ".....ff.....", ".....ff.....", "....ffff....", "............"],
  draw: [".....oo.....", ".....oo.....", "....oooo....", "....oooo....", "...oooooo...", "..oooooooo..", "..oooooooo..", ".ouoooooooo.", ".ouoooooooo.", "..ouoooooo..", "...oooooo...", "....oooo...."],
};
const FACES = { gust: ["E", "D"], break_ground: ["i", "g"], sprout: ["c", "b"], draw: ["m", "v"] };
function button(sign, face, lip, off) {
  const N = 28, g = blank(N, N), round = 4;
  const inside = (x, y, inset) => { const lo = inset, hi = N - 1 - inset, r = round - inset; if (x < lo || x > hi || y < lo || y > hi) return false;
    const cx = x < lo + r ? lo + r : x > hi - r ? hi - r : x, cy = y < lo + r ? lo + r : y > hi - r ? hi - r : y; return Math.hypot(x - cx, y - cy) <= r + 0.35; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inside(x, y, 0)) g[y][x] = !inside(x, y, 1) ? "B" : y >= N - 4 ? lip : face;
  const rows = SIGNS[sign];
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === ".") return; for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]].slice(0, 1)) put(g, 2 + i * 2 + a, 1 + j * 2 + b, off ? "y" : ch); put(g, 3 + i * 2, 1 + j * 2, off ? "y" : ch); put(g, 2 + i * 2, 2 + j * 2, off ? "y" : ch); put(g, 3 + i * 2, 2 + j * 2, off ? "y" : ch); }));
  if (off) for (let k = 5; k <= 22; k++) { put(g, N - 1 - k, k - 1, "B"); put(g, N - 1 - k, k, "l"); put(g, N - 1 - k, k + 1, "B"); }
  return g;
}
for (const name of Object.keys(SIGNS)) {
  CONTROLS["spell_" + name] = button(name, FACES[name][0], FACES[name][1], false);
  CONTROLS["spell_" + name + "_off"] = button(name, "v", "B", true);
}
// The counts in the top strip: a small picture for what is counted, and the ten digits to write the number
// with. A picture is 16 pixels across. A digit is 10 wide and 14 tall, which is 14 point type on a phone.
const COUNTS = {
  icon_seed: ["........", "...AA...", "..AjjA..", ".AjkkjA.", ".AjkjjA.", ".AjjjjA.", "..AjjA..", "...AA..."],
  icon_crop: ["..c..c..", "..cc.c..", "...cc...", "..AppA..", ".ApqqpA.", ".ApqppA.", "..AppA..", "...AA..."],
  icon_coin: ["..AAAA..", ".ArrrrA.", "ArrlrrqA", "ArlrrrqA", "ArrrrqqA", "ArrrqqqA", ".AqqqqA.", "..AAAA.."],
};
for (const [name, rows] of Object.entries(COUNTS)) CONTROLS[name] = grid(rows, 8, 8);
const DIGITS = [
  [".lll.", "l...l", "l..ll", "l.l.l", "ll..l", "l...l", ".lll."], [".ll..", "..l..", "..l..", "..l..", "..l..", "..l..", ".lll."],
  [".lll.", "l...l", "....l", "...l.", "..l..", ".l...", "lllll"], [".lll.", "l...l", "....l", "..ll.", "....l", "l...l", ".lll."],
  ["...l.", "..ll.", ".l.l.", "l..l.", "lllll", "...l.", "...l."], ["lllll", "l....", "llll.", "....l", "....l", "l...l", ".lll."],
  ["..ll.", ".l...", "l....", "llll.", "l...l", "l...l", ".lll."], ["lllll", "....l", "...l.", "..l..", ".l...", ".l...", ".l..."],
  [".lll.", "l...l", "l...l", ".lll.", "l...l", "l...l", ".lll."], [".lll.", "l...l", "l...l", ".llll", "....l", "...l.", ".ll.."],
];
DIGITS.forEach((rows, n) => { CONTROLS["digit_" + n] = grid(rows, 5, 7); });

// Letters, on the same 5 by 7 grain as the digits, for the few words the game shows. The words are part of
// the pictures, so neither build needs a font.
const LETTERS = {
  A: [".lll.", "l...l", "l...l", "lllll", "l...l", "l...l", "l...l"], B: ["llll.", "l...l", "l...l", "llll.", "l...l", "l...l", "llll."],
  C: [".lll.", "l...l", "l....", "l....", "l....", "l...l", ".lll."], D: ["llll.", "l...l", "l...l", "l...l", "l...l", "l...l", "llll."],
  E: ["lllll", "l....", "l....", "llll.", "l....", "l....", "lllll"], F: ["lllll", "l....", "l....", "llll.", "l....", "l....", "l...."],
  G: [".lll.", "l...l", "l....", "l.lll", "l...l", "l...l", ".lll."], H: ["l...l", "l...l", "l...l", "lllll", "l...l", "l...l", "l...l"],
  I: [".lll.", "..l..", "..l..", "..l..", "..l..", "..l..", ".lll."], J: ["..lll", "...l.", "...l.", "...l.", "...l.", "l..l.", ".ll.."],
  K: ["l...l", "l..l.", "l.l..", "ll...", "l.l..", "l..l.", "l...l"], L: ["l....", "l....", "l....", "l....", "l....", "l....", "lllll"],
  M: ["l...l", "ll.ll", "l.l.l", "l.l.l", "l...l", "l...l", "l...l"], N: ["l...l", "ll..l", "l.l.l", "l..ll", "l...l", "l...l", "l...l"],
  O: [".lll.", "l...l", "l...l", "l...l", "l...l", "l...l", ".lll."], P: ["llll.", "l...l", "l...l", "llll.", "l....", "l....", "l...."],
  Q: [".lll.", "l...l", "l...l", "l...l", "l.l.l", "l..l.", ".ll.l"], R: ["llll.", "l...l", "l...l", "llll.", "l.l..", "l..l.", "l...l"],
  S: [".llll", "l....", "l....", ".lll.", "....l", "....l", "llll."], T: ["lllll", "..l..", "..l..", "..l..", "..l..", "..l..", "..l.."],
  U: ["l...l", "l...l", "l...l", "l...l", "l...l", "l...l", ".lll."], V: ["l...l", "l...l", "l...l", "l...l", "l...l", ".l.l.", "..l.."],
  W: ["l...l", "l...l", "l...l", "l.l.l", "l.l.l", "ll.ll", "l...l"], X: ["l...l", "l...l", ".l.l.", "..l..", ".l.l.", "l...l", "l...l"],
  Y: ["l...l", "l...l", ".l.l.", "..l..", "..l..", "..l..", "..l.."], Z: ["lllll", "....l", "...l.", "..l..", ".l...", "l....", "lllll"],
};
// Writes a word into a grid at a grain place, each letter 5 wide with 1 between. Gives the width used.
function word(g, x, y, text, ch = "l") { [...text].forEach((c, n) => { if (c === " ") return; LETTERS[c].forEach((row, j) => [...row].forEach((q, i) => { if (q !== ".") put(g, x + n * 6 + i, y + j, ch); })); }); return text.length * 6 - 1; }
// A plate: a filled box with a dark outline and a light edge inside it.
function plate(w, h, fill, edge = "l") { const g = blank(w, h, "B"); rect(g, 1, 1, w - 2, h - 2, edge); rect(g, 2, 2, w - 4, h - 4, fill); return g; }
// The two small buttons in the top strip, 36 pixels across: skills (three bars rising) and pause (two bars).
function smallButton(sign) { const N = 18, g = blank(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const cx = x < 3 ? 3 : x > N - 4 ? N - 4 : x, cy = y < 3 ? 3 : y > N - 4 ? N - 4 : y, d = Math.hypot(x - cx, y - cy); if (d <= 3.35) g[y][x] = d > 2.35 || x === 0 || y === 0 || x === N - 1 || y === N - 1 ? "B" : y >= N - 4 ? "i" : "j"; }
  sign(g); return g; }
CONTROLS.button_skills = smallButton((g) => { rect(g, 4, 10, 2, 3, "A"); rect(g, 8, 7, 2, 6, "A"); rect(g, 12, 4, 2, 9, "A"); });
CONTROLS.button_pause = smallButton((g) => { rect(g, 5, 4, 3, 9, "A"); rect(g, 10, 4, 3, 9, "A"); });
// The skills panel, 256 by 208 pixels: a title, and for each of the four schools its name, "LV" with room
// for the level's digits after it, and an empty bar. The build writes the digits and fills the bars.
const SCHOOLS = ["AIR", "EARTH", "GROWTH", "WATER"];
CONTROLS.panel_skills = (() => { const g = plate(128, 104, "v"); word(g, 46, 5, "SKILLS", "r");
  SCHOOLS.forEach((name, r) => { const top = 18 + r * 21; word(g, 6, top, name); word(g, 92, top, "LV", "y"); rect(g, 6, top + 9, 116, 6, "l"); rect(g, 7, top + 10, 114, 4, "B"); });
  return g; })();
// The pop when a school gains a level, 102 by 22 pixels.
CONTROLS.pop_level_up = (() => { const g = plate(51, 11, "r", "x"); word(g, 2, 2, "LEVEL UP", "B"); return g; })();
// The pause panel, 192 by 56 pixels: what the game shows while it is paused.
CONTROLS.panel_pause = (() => { const g = plate(96, 28, "v"); word(g, 30, 5, "PAUSED", "r"); word(g, 6, 16, "TOUCH TO GO ON"); return g; })();

const controls = {};
let CW = 0, CH = 0;
for (const [name, g] of Object.entries(CONTROLS)) { controls[name] = { x: CW, y: 0, w: g[0].length * 2, h: g.length * 2 }; CW += g[0].length * 2; CH = Math.max(CH, g.length * 2); }
const cpx = Buffer.alloc(CW * CH * 4);
for (const [name, g] of Object.entries(CONTROLS)) {
  const at = controls[name];
  for (let y = 0; y < at.h; y++) for (let x = 0; x < at.w; x++) {
    const ch = g[y >> 1][x >> 1]; if (ch === ".") continue;
    const [r, gg, b] = hex(PAL[ch]), o = ((at.y + y) * CW + at.x + x) * 4;
    cpx[o] = r; cpx[o + 1] = gg; cpx[o + 2] = b; cpx[o + 3] = 255;
  }
}

// ---------- write the PNGs ----------
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
}
function toPng(px, W, H) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const png = toPng(px, W, H);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "sprites.png"), png);
fs.writeFileSync(path.join(OUT, "sprites.json"), JSON.stringify({
  about: "One sprite sheet for both builds. Every sprite is one 32 by 32 pixel tile. x and y are the tile's top-left corner on sprites.png, in pixels. Draw it with no smoothing, so the pixels stay sharp.",
  image: "sprites.png", tile: TILE, columns: COLS, rows: ROWS, sprites,
}, null, 2) + "\n");
fs.writeFileSync(path.join(OUT, "controls.png"), toPng(cpx, CW, CH));
fs.writeFileSync(path.join(OUT, "controls.json"), JSON.stringify({
  about: "The controls' art, the same for both builds. Each piece has its own size: x and y are its top-left corner on controls.png, w and h its size, all in pixels. Draw it with no smoothing, at the same scale as the sprites.",
  image: "controls.png", pieces: controls,
}, null, 2) + "\n");
console.log("wrote", W + "x" + H, "sprites.png,", png.length, "bytes,", ORDER.length, "sprites; and", CW + "x" + CH, "controls.png");
