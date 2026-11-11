// The referee's check for step 9, "Something lives down here", the same for both builds. Like the checks
// before it, it serves a build's web folder the way a plain web host would, opens it in headless Chromium, and
// plays it with real touch events (and, at PC size, the mouse and the keys). Everything it judges it reads from
// screenshots and from what the page sends to the speakers: the four creatures and where they are, how they
// come for the mage and stop at a wall, what Gust and Draw do to one, a creature gone after three hits, what
// a touch costs the mage, and the creatures back on the next trip down.
//
//   node tools/check-step-09.cjs <web folder> <folder for screenshots> [one view's name]
//
// Nothing here waits for a moving creature to be in the right spot. A creature that has come as near as a
// wall lets it stands still in a known corner, and that is where it is hit. The one thing timed by the game is
// the touch: a gate is opened from two tiles away, and the creature behind it walks straight into the mage.
//
// Steps 1 to 7 still standing is checked by running the older checks on the same build, with BUILD_STEP=9.
// Step 8's own check is for a dungeon with nothing living in it, so it fits a step 8 build only; what it
// tried (a gate, the cache, the way up and down) is tried again here with the creatures there.
const path = require("path");
const { K, referee, layoutFor, BUTTONS, SKILLS, PAUSE } = require("./referee.cjs");

const web = path.resolve(process.argv[2] || "web"), out = path.resolve(process.argv[3] || "check-out"), only = process.argv[4] || "";
const [GUST, BREAK, SPROUT, DRAW] = ["gust", "break_ground", "sprout", "draw"].map((n) => BUTTONS.find((b) => b.name === n)), SPELLS = [GUST, BREAK, SPROUT, DRAW];
const BACK = 6.5, DARK = 29.3, BARW = SKILLS.bar.w, SK = [SKILLS.button.x + 18, SKILLS.button.y + 18], PZ = [PAUSE.button.x + 18, PAUSE.button.y + 18], NOWHERE = [170, 12];
const needXp = (level) => Math.round(100 * Math.pow(1.12, level - 1)), fillFor = (xp, level) => Math.round((BARW * xp) / needXp(level));
const mid = (tx, ty) => [tx * K.T + 16, ty * K.T + 16];

(async () => {
  const ref = await referee(web, out, 9, layoutFor(Number(process.env.BUILD_STEP || 9)));
  const { open, check, finish, lot, dungeon, round, at, near, aimedAt, lotThing } = ref;
  if (!dungeon) { console.log("no dungeon.json in the shared folder"); process.exit(2); }
  // The two maps. The lot's stairwell, and below it the stairs up, the gates with the spell each opens to, the coins and the cache.
  const find = (map, rows, legend, name) => { const all = []; map[rows].forEach((r, ty) => [...r].forEach((ch, tx) => { if (map[legend][ch] === name) all.push([tx, ty]); })); return all; };
  const STAIRS = find(lot, "ground", "ground_legend", "stairs_down")[0], UP = find(dungeon, "ground", "ground_legend", "stairs_up")[0];
  const GATES = [["gate_rubble", GUST], ["gate_dirt", BREAK], ["gate_vine", SPROUT], ["gate_basin", DRAW]].map(([name, spell]) => { const xy = find(dungeon, "things", "things_legend", name)[0]; return { name, spell, xy, stand: [xy[0], xy[1] < 6 ? xy[1] + 1 : xy[1] - 1], inside: [xy[0], xy[1] < 6 ? xy[1] - 1 : xy[1] + 1], up: xy[1] < 6 }; });
  const [G_RUBBLE, G_DIRT, G_VINE, G_BASIN] = GATES, COINS = find(dungeon, "things", "things_legend", "coins"), CACHE = find(dungeon, "things", "things_legend", "cache")[0];
  const dThing = (tx, ty) => dungeon.things_legend[dungeon.things[ty][tx]], dGround = (tx, ty) => dungeon.ground_legend[dungeon.ground[ty][tx]];

  const bar = (l) => (l.mana ? l.mana.filledPixels : null), mana = (l) => (l.mana ? l.mana.mana : null);
  const tile = (l, xy) => l.tiles[xy[1]][xy[0]], cnt = (l, n) => (l.counts[n] ? l.counts[n].text : null);
  const counts = (l) => ({ seeds: cnt(l, "seeds"), crops: cnt(l, "crops"), coins: cnt(l, "coins") });
  const heard = (s) => (s.heard ? s.name : "none");
  const panel = (l) => (l.panel ? SKILLS.schools.map((n) => l.panel.schools[n].level + ":" + l.panel.schools[n].fill).join(" ") : "closed");
  const wantPanel = (xp) => SKILLS.schools.map((n) => { let level = 1, x = xp[n] || 0; while (x >= needXp(level)) { x -= needXp(level); level++; } return level + ":" + fillFor(x, level); }).join(" ");
  const untilTime = async (V, t) => { const ms = t - Date.now(); if (ms > 0) await V.wait(ms); };
  const hear = async (V, act, ms = 1000) => { const t = await V.sound.now(); await act(); await V.wait(ms); return V.sound.since(t); };
  // The tiles of the dungeon that are not as the shared map has them, leaving out the ones named.
  const notAsMap = (l, but = []) => { const wrong = []; for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 9; tx++) { if (but.some((xy) => xy[0] === tx && xy[1] === ty)) continue; const t = l.tiles[ty][tx]; if (t.thing !== dThing(tx, ty) || t.ground !== dGround(tx, ty)) wrong.push(tx + "," + ty + " " + t.ground + "/" + t.thing); } return wrong; };
  const lotSig = (l) => l.tiles.flat().map((t) => t.ground + "/" + (t.thing === "weeds" ? null : t.thing)).join();

  async function begin(V, quiet) {
    if (!quiet) check(V, "the cover shows first", V.coverSeen, V.secondsToCover + " s", "the cover with its words");
    await V.tap(...NOWHERE, 250); await V.wait(900); await V.pace();
    return V.look("start", true);
  }
  function startState(V, l, pct) {
    check(V, "the game starts on the lot, the mage below the door", l.place === "lot" && near(l, K.START.x, K.START.y, 1) && l.mage.facing === "down", { place: l.place, mage: at(l) }, "the lot, 144, 80, facing down");
    const wrong = []; for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 9; tx++) { const t = l.tiles[ty][tx]; if (t.thing !== lotThing(tx, ty) || t.ground !== lot.ground_legend[lot.ground[ty][tx]]) wrong.push(tx + "," + ty); }
    check(V, "every tile shows the ground and the thing the shared lot says", wrong.length === 0, wrong, "all 108 tiles right");
    check(V, "the picture matches the shared art", l.pictureWrongPct <= pct, l.pictureWrongPct + "% of pixels wrong", pct + "% or less");
  }
  async function end(V) {
    const page = await V.page.evaluate(() => ({ x: window.scrollX, y: window.scrollY, zoom: window.visualViewport ? window.visualViewport.scale : 1, picked: String(window.getSelection ? window.getSelection() : "").length }));
    check(V, "the page did not scroll, zoom or select anything", page.x === 0 && page.y === 0 && page.zoom === 1 && page.picked === 0, page, "still");
    check(V, "no errors on the page", V.errs.length === 0, V.errs.slice(0, 3), "none");
    await V.close();
  }
  const quick = async (V, b, xy, gap = 150) => { if (xy) { await V.tapTile(xy[0], xy[1], 40); await V.wait(80); } await V.tapButton(b, 40); await V.wait(gap); };
  // Onto a stairs tile from the tile beside it: stand on that tile, then a short push. The stick is let go
  // before the fade is over, so the mage arrives standing.
  const beside = (xy, dx, dy) => [xy[0] - dx, xy[1] - dy];
  async function step(V, from, dx, dy, ms = 300) { await V.walkToTile(from[0], from[1], 4); const lo = Date.now(); await V.push(dx, dy, ms); await V.wait(900); return { lo, hi: Date.now() }; }
  const goDown = (V) => step(V, beside(STAIRS, 1, 0), 1, 0), goUp = (V) => step(V, beside(UP, 0, -1), 0, -1);
  // Walks tile to tile through the dungeon. Each leg is a straight line over open floor.
  const route = async (V, ...tiles) => { let l = null; for (const xy of tiles) l = await V.walkToTile(xy[0], xy[1], 4); return l; };

  GATES.forEach((g) => { g.school = { gust: "air", break_ground: "earth", sprout: "growth", draw: "water" }[g.spell.name]; });
  if (!dungeon.creatures || dungeon.creatures.length !== 4) { console.log("dungeon.json in the shared folder lists no creatures"); process.exit(2); }
  // The creatures' starting places, and the two corners beside the stairs: a creature in one of the two top
  // rooms that comes for a mage on the stairs ends in the corner of its room nearest the stairs.
  const SPEED = 57.6, um = mid(...UP), sm = mid(...STAIRS), [TL, TR, BL, BR] = dungeon.creatures.map((c) => mid(c.x, c.y));
  const WALL_Y = G_RUBBLE.xy[1] * K.T - K.HALF, CORNER_L = [UP[0] * K.T - K.HALF, WALL_Y], CORNER_R = [(UP[0] + 1) * K.T + K.HALF, WALL_Y];
  const T_L = [Math.floor(CORNER_L[0] / K.T), Math.floor(CORNER_L[1] / K.T)], T_R = [Math.floor(CORNER_R[0] / K.T), Math.floor(CORNER_R[1] / K.T)];
  const who = (l, xy, tol) => l.creatures.find((c) => Math.abs(c.x - xy[0]) <= tol && Math.abs(c.y - xy[1]) <= tol) || null;
  const where = (l) => l.creatures.map((c) => c.x + "," + c.y).join(" ");
  // A creature thrown along the wall to x0 and walking back toward the mage on the stairs, sliding along the
  // wall: where its middle is t seconds after the throw. It walks at half speed until "slowFor" seconds are up.
  const slide = (x0, corner, t, slowFor) => { let x = x0; const dt = 0.004, dir = Math.sign(corner[0] - x0); for (let sec = 0; sec < t; sec += dt) { const v = SPEED * (sec < slowFor ? 0.5 : 1), dx = um[0] - x, dy = um[1] - corner[1]; x += (dx / Math.hypot(dx, dy)) * v * dt; if ((x - corner[0]) * dir >= 0) return corner[0]; } return x; };
  // The same for a screenshot: the touch that threw it may have taken up to 0.1 s to count, and the screenshot
  // took a while to take. Gives the nearest and the farthest the creature may be.
  const span = (sn, tThrow, x0, corner, slowEnds) => { const xs = []; for (const late of [0, 0.1]) for (const tt of [sn.t0, sn.t1]) for (const shift of [-0.08, 0.08]) xs.push(slide(x0, corner, Math.max(0, (tt - tThrow) / 1000 - late), slowEnds === null ? 0 : (slowEnds - tThrow) / 1000 - late + shift)); return [Math.min(...xs) - 3, Math.max(...xs) + 3]; };
  const within = (c, sp) => !!c && c.x >= sp[0] && c.x <= sp[1];
  const inRoomL = (l) => l.creatures.find((c) => c.x < UP[0] * K.T && c.y < G_RUBBLE.xy[1] * K.T) || null, inRoomR = (l) => l.creatures.find((c) => c.x > (UP[0] + 1) * K.T && c.y < G_RUBBLE.xy[1] * K.T) || null;
  const need = async (V, v) => { const l = await V.look(); if (mana(l) < v) await V.wait(((v - mana(l)) / BACK) * 1000 + 250); };

  // ---------------- The playing view: one picture pixel to one screen pixel ----------------
  async function play(V) {
    let l = await begin(V), s, a, b; startState(V, l, 1); const xp = { air: 0, earth: 0, growth: 0, water: 0 };
    check(V, "no creature is on the lot", l.creatures.length === 0, where(l), "none");

    // Down the stairs. Two and a half seconds later the two creatures in the top rooms have come as near as the walls let them.
    await goDown(V); await V.wait(1900); const A = await V.look("creatures", true);
    check(V, "four creatures are on the dungeon floor", A.place === "dungeon" && A.creatures.length === 4, where(A), "four");
    check(V, "a creature no more than 4 tiles from the mage walks toward it, slides along the wall, and stops in the corner nearest the mage", !!who(A, CORNER_L, 2) && !!who(A, CORNER_R, 2), where(A), "one at " + CORNER_L.join(",") + " and one at " + CORNER_R.join(","));
    check(V, "a creature more than 4 tiles away stands still on the middle of its starting tile", !!who(A, BL, 1) && !!who(A, BR, 1), where(A), "one at " + BL.join(",") + " and one at " + BR.join(","));
    check(V, "the picture with the creatures in it matches the shared art", A.pictureWrongPct <= 1, A.pictureWrongPct + "% of pixels wrong", "1% or less");
    check(V, "the mage stands on the stairs, and a creature does not come onto them", near(A, um[0], um[1], 1), at(A), um.join(", "));

    // The wrong spells on a creature: the soft "no".
    await V.tapTile(...T_L); await V.settle(); a = await V.look("aim-at-a-creature"); const got = [];
    for (const sp of [BREAK, SPROUT]) { s = await hear(V, () => V.tapButton(sp, 60), 800); got.push(heard(s)); } l = await V.look("wrong-spells-on-a-creature");
    check(V, "Break Ground and Sprout do nothing to a creature: the soft no, and nothing spent", aimedAt(a) === T_L.join() && got.every((h) => h === "no") && !!who(l, CORNER_L, 2) && l.creatures.length === 4 && bar(l) >= bar(a) && cnt(l, "seeds") === "8", { aimed: aimedAt(a), heard: got, creatures: where(l), mana: [mana(a), mana(l)], seeds: cnt(l, "seeds") }, "the mark on " + T_L.join() + ", no.wav twice, the creature still there");

    // Draw, then Gust, on the creature in the left corner. Screenshots first, read afterwards.
    await need(V, 60);
    let t = await V.sound.now(); const s0 = await V.snap(); const tD = Date.now(); await V.tapButton(DRAW, 40); await V.wait(Math.max(120, 3500 / Math.max(1, V.fps || 30))); const s1 = await V.snap("draw-on-a-creature"); await untilTime(V, tD + 560); const sD = await V.sound.since(t);
    await untilTime(V, tD + 600); t = await V.sound.now(); const tG = Date.now(); await V.tapButton(GUST, 40); await V.wait(Math.max(120, 3500 / Math.max(1, V.fps || 30))); const s2 = await V.snap("gust-on-a-creature");
    await untilTime(V, tG + 1100); const s3 = await V.snap("slowed"); const sG = await V.sound.since(t); await untilTime(V, tG + 3600); const s5 = await V.snap("back-in-the-corner");
    const [l0, l1, l2, l3, l5] = [await V.read(s0), await V.read(s1), await V.read(s2), await V.read(s3), await V.read(s5)]; xp.water += 10; xp.air += 10;
    const cost = (before, after, sb, sa, c) => { const most = Math.min(100, mana(before) + (BACK * (sa.t1 - sb.t0)) / 1000) - c + 1.5, least = mana(before) - c - 1.5; return { ok: mana(after) <= most && mana(after) >= least, got: { before: mana(before), after: mana(after), between: [round(least), round(most)] } }; };
    { const c = cost(l0, l1, s0, s1, 10);
      check(V, "Draw on a creature costs 10 mana and plays draw.wav", c.ok && heard(sD) === "draw", { ...c.got, heard: heard(sD) }, "10 less, draw.wav");
      check(V, "Draw does not move the creature", !!who(l1, CORNER_L, 2) && l1.creatures.length === 4, where(l1), "still at " + CORNER_L.join(",")); }
    const X0 = CORNER_L[0] - 64, thrown = inRoomL(l2), sp2 = span(s2, tG, X0, CORNER_L, tD + 2000);
    { const c = cost(l1, l2, s1, s2, 8);
      check(V, "Gust on a creature costs 8 mana and plays gust.wav", c.ok && heard(sG) === "gust", { ...c.got, heard: heard(sG) }, "8 less, gust.wav");
      check(V, "Gust throws the creature back 64 pixels, away from the mage, along the wall", within(thrown, [X0 - 2, sp2[1]]) && Math.abs(thrown.y - WALL_Y) <= 2, { creature: thrown, x: [X0 - 2, round(sp2[1])] }, "x about " + X0 + ", y " + WALL_Y); }
    { const c3 = inRoomL(l3), sp3 = span(s3, tG, X0, CORNER_L, tD + 2000), fast3 = span(s3, tG, X0, CORNER_L, null);
      check(V, "after Draw the creature walks at half its speed", within(c3, sp3) && sp3[1] < fast3[0], { creature: c3, slowed: sp3.map(round), notSlowed: fast3.map(round) }, "x between " + sp3.map(round).join(" and "));
      check(V, "and it comes back to the corner", !!who(l5, CORNER_L, 2), where(l5), "one at " + CORNER_L.join(",")); }
    // The third hit: no nerve left.
    s = await hear(V, () => V.tapButton(GUST, 60), 800); l = await V.look("driven-off"); xp.air += 10;
    check(V, "the third hit drives the creature off: it is gone from the floor", heard(s) === "gust" && l.creatures.length === 3 && !inRoomL(l), { heard: heard(s), creatures: where(l) }, "gust.wav, three creatures left, none in that room");

    // The creature in the right corner: Draw, and Gust just before the 2 seconds are up. It is thrown the other
    // way, walks slowly for a moment more, and then at its own speed.
    await V.tapTile(...T_R); await V.settle(); const tD2 = Date.now(); await V.tapButton(DRAW, 40); await untilTime(V, tD2 + 1800); const tG2 = Date.now(); await V.tapButton(GUST, 40); await V.wait(Math.max(120, 3500 / Math.max(1, V.fps || 30))); const r1 = await V.snap("gust-on-the-other-creature"); await untilTime(V, tG2 + 1200); const r2 = await V.snap("walking-back"); xp.water += 10; xp.air += 10;
    { const XR = CORNER_R[0] + 64, k1 = inRoomR(await V.read(r1)), k2 = inRoomR(await V.read(r2)), q1 = span(r1, tG2, XR, CORNER_R, tD2 + 2000), q2 = span(r2, tG2, XR, CORNER_R, tD2 + 2000), never = span(r2, tG2, XR, CORNER_R, tD2 + 60000);
      check(V, "a creature to the mage's right is thrown to the right", within(k1, [q1[0], XR + 2]), { creature: k1, x: [round(q1[0]), XR + 2] }, "x about " + XR);
      check(V, "2 seconds after Draw the creature walks at its own speed again: 57.6 pixels a second, 60% of the mage's", within(k2, q2) && q2[1] < never[0], { creature: k2, wouldBe: q2.map(round), ifStillSlowed: never.map(round) }, "x between " + q2.map(round).join(" and ")); }

    // The cache: its creature is driven off through the wall first, then the basin is opened.
    await route(V, [UP[0], UP[1] + 1], G_BASIN.stand); await V.wait(2500); await need(V, 45); const under = [G_BASIN.xy[0], G_BASIN.xy[1] + 1]; await V.tapTile(...under); await V.settle(); a = await V.look("a-creature-behind-the-basin");
    check(V, "the creature behind the basin has come up to its gate, and the gate stops it", a.creatures.some((c) => c.tileX === under[0] && c.tileY === under[1]) && tile(a, G_BASIN.xy).thing === "gate_basin" && aimedAt(a) === under.join(), { creatures: where(a), aimed: aimedAt(a) }, "a creature on " + under.join() + ", the mark on it");
    for (let i = 0; i < 3; i++) { await V.tapButton(GUST, 40); await V.wait(1400); } xp.air += 30; l = await V.look("driven-off-through-the-wall");
    check(V, "three Gusts through the wall drive it off", l.creatures.length === 2 && !l.creatures.some((c) => c.y > G_BASIN.xy[1] * K.T && c.x > (UP[0] + 1) * K.T), where(l), "two creatures left, none in the cache room");
    await V.tapTile(...G_BASIN.xy); await V.settle(); s = await hear(V, () => V.tapButton(DRAW, 60), 800); xp.water += 10; await route(V, G_BASIN.inside); s = await hear(V, () => V.walkToTile(CACHE[0], CACHE[1], 5)); l = await V.look("cache-taken");
    check(V, "the gates and the cache still work with the creatures there: the basin opens to Draw, and the cache gives 12 seeds", tile(l, G_BASIN.xy).thing === null && cnt(l, "seeds") === "20" && heard(s) === "pick", { gate: tile(l, G_BASIN.xy).thing, seeds: cnt(l, "seeds"), heard: heard(s) }, "the gate gone, 20 seeds, pick.wav");
    await V.tap(...SK); await V.settle(); l = await V.look("skills-below", true); await V.tap(...NOWHERE); await V.settle();
    check(V, "every hit on a creature gives its spell's school 10 XP", panel(l) === wantPanel(xp), panel(l), wantPanel(xp));

    // Up, and down again: all four are back. Paused at once, they stand where they are.
    await route(V, G_BASIN.inside, G_BASIN.stand); await goUp(V); l = await V.look("back-on-the-lot", true);
    check(V, "back on the lot: no creature comes up the stairs, and the seeds are kept", l.place === "lot" && near(l, sm[0], sm[1], 1) && l.creatures.length === 0 && cnt(l, "seeds") === "20", { place: l.place, mage: at(l), creatures: where(l), seeds: cnt(l, "seeds") }, "the lot, no creatures, 20 seeds");
    await V.walkToTile(...beside(STAIRS, 1, 0), 4); await V.push(1, 0, 300); await V.wait(750); await V.tap(...PZ); await V.wait(250); const p1 = await V.snap("down-again-and-paused"); await V.wait(1500); const p2 = await V.snap("still-paused");
    { const q1 = await V.read(p1), q2 = await V.read(p2), c1 = inRoomL(q1), c2 = inRoomL(q2);
      check(V, "every trip down, all four creatures are back", q1.place === "dungeon" && q1.creatures.length === 4, where(q1), "four");
      check(V, "while the game is paused the creatures stand still", !!q1.paused && !!c1 && !!c2 && c1.x < CORNER_L[0] - 4 && Math.abs(c1.x - c2.x) <= 1 && Math.abs(c1.y - c2.y) <= 1, { paused: !!q1.paused, first: c1, later: c2 }, "paused on its way to the corner, and in the same spot a second and a half later"); }
    await V.tap(...NOWHERE); await V.wait(2300); l = await V.look("going-again");
    check(V, "and they go on when the pause ends", !l.paused && !!who(l, CORNER_L, 2) && !!who(l, CORNER_R, 2), { paused: !!l.paused, creatures: where(l) }, "one in each corner by the stairs");

    // The touch. The mage opens the packed dirt from two tiles away, and the creature behind it walks straight down into the mage.
    await route(V, [UP[0], UP[1] + 1], [G_DIRT.xy[0], G_DIRT.xy[1] + 2]); await V.wait(2500); await need(V, 80); await V.tapTile(...G_DIRT.xy); await V.settle(); a = await V.look("two-tiles-from-the-dirt-gate");
    const tB = Date.now(); await V.tapButton(BREAK, 40); const shots = []; let tS = null;
    while (Date.now() - tB < 2900) { if (tS === null && Date.now() - tB > 600) tS = await V.sound.now(); shots.push(await V.snap()); }
    s = await V.sound.since(tS); const reads = []; for (const sn of shots) reads.push(await V.read(sn));
    const j = reads.findIndex((r) => near(r, um[0], um[1], 1));
    check(V, "the creature comes through the opened gate and touches the mage: the mage is put on the stairs, facing down", aimedAt(a) === G_DIRT.xy.join() && j > 0 && reads[j].mage.facing === "down" && reads[j].place === "dungeon", { aimed: aimedAt(a), screenshots: reads.length, onTheStairsFrom: j, mage: j >= 0 ? at(reads[j]) : at(reads[reads.length - 1]) }, um.join(", ") + ", facing down, still below");
    if (j > 0) { const before = reads[j - 1], after = reads[j], gap = (shots[j].t1 - shots[j - 1].t0) / 1000, least = mana(before) / 2 - 1.5, most = (mana(before) + BACK * gap) / 2 + BACK * gap + 1.5, sec = (shots[j].at - tB) / 1000, home = who(after, TR, 22);
      check(V, "the touch comes about a second and a quarter after the gate opens, as the creature's speed makes it", sec >= 0.8 && sec <= 1.9, round(sec) + " s", "between 0.8 and 1.9 seconds");
      check(V, "a touch takes half the mage's mana", mana(after) >= least && mana(after) <= most, { before: mana(before), after: mana(after), between: [round(least), round(most)] }, "half");
      check(V, "after a touch the creature is back on its starting tile", !!home, where(after), "one within a step of " + TR.join(","));
      check(V, "the touch plays the soft no", heard(s) === "no", { heard: heard(s) }, "no.wav"); }
    else for (const name of ["the touch comes about a second and a quarter after the gate opens, as the creature's speed makes it", "a touch takes half the mage's mana", "after a touch the creature is back on its starting tile", "the touch plays the soft no"]) check(V, name, false, "the mage was not put on the stairs", "a touch");
    await V.wait(1200); l = await V.look("after-the-touch");
    check(V, "being put on the stairs does not take the mage up", l.place === "dungeon" && near(l, um[0], um[1], 1), { place: l.place, mage: at(l) }, "still below, on the stairs");
    await end(V);
  }

  // ---------------- The other sizes: the creatures in the picture ----------------
  async function size(V, pct) {
    let l = await begin(V); startState(V, l, pct);
    await V.walkToTile(STAIRS[0] - 2, STAIRS[1], 6); await V.push(1, 0, 900); await V.wait(3000); l = await V.look("creatures", true);
    check(V, "four creatures are on the dungeon floor", l.place === "dungeon" && l.creatures.length === 4, where(l), "four");
    check(V, "the picture with the creatures in it matches the shared art", l.pictureWrongPct <= pct, l.pictureWrongPct + "% of pixels wrong", pct + "% or less");
    await end(V);
  }

  // ---------------- PC size: the keys and the mouse ----------------
  async function pc(V) {
    let l = await begin(V), s; startState(V, l, 3); const hold = async (key, ms) => { await V.page.keyboard.down(key); await V.wait(ms); await V.page.keyboard.up(key); await V.settle(); };
    await V.walkToTile(...beside(STAIRS, 1, 0), 4); await hold("ArrowRight", 300); await V.wait(2800); l = await V.look("creatures", true);
    check(V, "at PC size, four creatures are on the dungeon floor, two of them in the corners by the stairs", l.place === "dungeon" && l.creatures.length === 4 && !!who(l, CORNER_L, 2) && !!who(l, CORNER_R, 2), where(l), "four");
    await V.tapTile(...T_L); await V.wait(250); s = await hear(V, () => V.page.keyboard.press("4"), 800); l = await V.look("key-4-on-a-creature");
    check(V, "the mouse aims at a creature's tile and the 4 key casts Draw on it", heard(s) === "draw" && l.creatures.length === 4, { heard: heard(s), creatures: where(l) }, "draw.wav");
    s = await hear(V, () => V.page.keyboard.press("1"), 2800); s = await hear(V, () => V.page.keyboard.press("1"), 800); l = await V.look("keys-drive-it-off");
    check(V, "two presses of the 1 key drive it off", heard(s) === "gust" && l.creatures.length === 3 && !inRoomL(l), { heard: heard(s), creatures: where(l) }, "gust.wav, three creatures left");
    await end(V);
  }

  // ---------------- A short film of the step, for the series ----------------
  async function film(V) {
    await begin(V, true); await V.wait(500);
    await V.walkToTile(...beside(STAIRS, 1, 0), 4); await V.push(1, 0, 300); await V.wait(3200);
    await V.tapTile(...T_L); await V.wait(600); await V.tapButton(DRAW); await V.wait(1000); await V.tapButton(GUST); await V.wait(3200); await V.tapButton(GUST); await V.wait(1500);
    await route(V, [UP[0], UP[1] + 1], [G_DIRT.xy[0], G_DIRT.xy[1] + 2]); await V.wait(2200); await V.tapTile(...G_DIRT.xy); await V.wait(500); await V.tapButton(BREAK); await V.wait(4500); await V.close();
  }

  const views = [
    ["play", { name: "play", width: 288, height: 576, dpr: 1, touch: true }, (V) => play(V)],
    ["phone-sharp", { name: "phone-sharp", width: 390, height: 844, dpr: 3, touch: true }, (V) => size(V, 1)],
    ["phone", { name: "phone", width: 390, height: 844, dpr: 1, touch: true }, (V) => size(V, 1)],
    ["small-phone", { name: "small-phone", width: 360, height: 640, dpr: 1, touch: true }, (V) => size(V, 3)],
    ["phone-sideways", { name: "phone-sideways", width: 640, height: 360, dpr: 2, touch: true }, (V) => size(V, 3)],
    ["pc", { name: "pc", width: 1280, height: 720, dpr: 1, touch: false }, (V) => pc(V)],
    ["film", { name: "film", width: 576, height: 1152, dpr: 1, touch: true, film: "step-09.webm" }, (V) => film(V)],
  ];
  for (const [name, v, run] of views) { if (only && only !== name) continue; console.log("\n" + name + " (" + v.width + "x" + v.height + " @" + v.dpr + ")"); const V = await open(v); try { await run(V); } catch (e) { check(V, "the check ran to its end", false, String(e && e.stack ? e.stack : e).slice(0, 600), "no trouble in the check itself"); try { await V.close(); } catch (e2) { /* already closed */ } } }
  const report = await finish();
  process.exit(report.missed ? 1 : 0);
})();
