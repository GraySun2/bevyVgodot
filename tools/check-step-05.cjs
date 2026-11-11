// The referee's check for step 5, "Water", the same for both builds. Like the checks before it, it serves a
// build's web folder the way a plain web host would, opens it in headless Chromium, and plays it with real
// touch events (and, at PC size, the mouse and the keys). Everything it judges it reads from screenshots and
// from what the page sends to the speakers. This step runs by the clock (a crop is ripe 40 seconds after it
// is watered, weeds come back every 45 seconds), so the check keeps the time itself and looks just before
// and just after each moment.
//
//   node tools/check-step-05.cjs <web folder> <folder for screenshots> [one view's name]
//
// Steps 1 to 4 still standing is checked by running the older checks on the same build:
//
//   BUILD_STEP=5 node tools/check-step-04.cjs <web folder> <folder for screenshots>
//   BUILD_STEP=5 node tools/check-step-03.cjs <web folder> <folder for screenshots>
const path = require("path");
const { K, referee, layoutFor, BUTTONS } = require("./referee.cjs");

const web = path.resolve(process.argv[2] || "web"), out = path.resolve(process.argv[3] || "check-out"), only = process.argv[4] || "";
const [GUST, BREAK, SPROUT, DRAW] = ["gust", "break_ground", "sprout", "draw"].map((n) => BUTTONS.find((b) => b.name === n));
const BACK = 6.5, BAR = 118, STAGES = [[0, "crop_seed"], [10, "crop_sprout"], [25, "crop_grown"], [40, "crop_ripe"]], WEEDS = 45;
const mid = (b) => [b.x + 28, b.y + 28], spell = (b) => ({ gust: "Gust", break_ground: "Break Ground", sprout: "Sprout", draw: "Draw" }[b.name]);

(async () => {
  const ref = await referee(web, out, 5, layoutFor(Number(process.env.BUILD_STEP || 5)));
  const { open, check, finish, lot, round, at, near, knobAt, aimedAt, lotThing, sounds } = ref;
  const bar = (l) => (l.mana ? l.mana.filledPixels : null), mana = (l) => (l.mana ? l.mana.mana : null);
  const lit = (l) => [BREAK, SPROUT, DRAW, GUST].map((b) => l.buttons[b.name].shows).join(" "), seeds = (l) => (l.counts.seeds ? l.counts.seeds.text : null), crops = (l) => (l.counts.crops ? l.counts.crops.text : null);
  const tileMid = (tx, ty) => [tx * K.T + 16, K.TOP + ty * K.T + 16];
  const tile = (l, xy) => l.tiles[xy[1]][xy[0]], isTile = (l, xy, ground, th) => tile(l, xy).ground === ground && tile(l, xy).thing === th;
  // A tile's ground and what is on it, with a crop of any size counted as "a crop": crops grow while the
  // check is busy with something else, and that is no change of the kind a cast makes.
  const sig = (t) => t.ground + "/" + (t.thing && t.thing.startsWith("crop_") ? "crop" : t.thing), sigs = (l) => l.tiles.flat().map(sig).join(" ");
  const same = (a, b) => sigs(a) === sigs(b) && seeds(a) === seeds(b) && crops(a) === crops(b);
  const give = (V) => 2 + (BACK * 1.5) / Math.max(1, V.fps || 30);
  const heard = (s) => (s.heard ? s.name : "none");
  const bareGrass = (t) => (t.ground === "grass" || t.ground === "grass_flowers") && t.thing === null, bareSoil = (t) => t.ground === "soil" && t.thing === null;
  const reach = (l, f) => { const list = []; if (l.mage) for (let ty = l.mage.tileY - 2; ty <= l.mage.tileY + 2; ty++) for (let tx = l.mage.tileX - 2; tx <= l.mage.tileX + 2; tx++) if (tx >= 0 && tx < 9 && ty >= 0 && ty < 12 && !(tx === l.mage.tileX && ty === l.mage.tileY) && f(l.tiles[ty][tx])) list.push([tx, ty]); return list; };
  // Where the ask says the next weeds grow: the bare grass tile farthest from the mage's tile, counting tiles
  // across plus tiles up or down; of several as far, the highest up, and of those the most to the left.
  const weedSpot = (l) => { let best = null; if (l.mage) for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 9; tx++) { if (!bareGrass(l.tiles[ty][tx])) continue; const d = Math.abs(tx - l.mage.tileX) + Math.abs(ty - l.mage.tileY); if (!best || d > best.d) best = { tx, ty, d }; } return best; };
  // The game's clock starts when the cover goes away, somewhere within the tap that takes it away.
  const T = (V) => (Date.now() - V.coverLo) / 1000, untilT = async (V, s) => { const ms = (s - T(V)) * 1000; if (ms > 0) await V.wait(ms); }, untilTime = async (V, t) => { const ms = t - Date.now(); if (ms > 0) await V.wait(ms); };
  // Which sprites a crop may show in a look, given when it was watered (between two clock times).
  const stagesFor = (w, l) => { const lo = (l.at - w.hi) / 1000 - 0.4, hi = (l.at - w.lo) / 1000 + 0.4, name = (s) => STAGES.filter(([from]) => s >= from).pop()[1]; return [...new Set([name(Math.max(0, lo)), name(Math.max(0, hi))])]; };

  async function begin(V, quiet) {
    if (!quiet) check(V, "the cover shows first", V.coverSeen, V.secondsToCover + " s", "the cover with its words");
    V.coverLo = Date.now(); await V.tap(220, 24, 250); V.coverHi = Date.now(); await V.wait(900); await V.pace();
    return V.look("start", true);
  }
  function startState(V, l, pct) {
    check(V, "the mage starts below the door, facing down", near(l, K.START.x, K.START.y, 1) && l.mage.facing === "down", at(l), "144, 80, facing down");
    const wrong = []; for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 9; tx++) { const t = l.tiles[ty][tx]; if (t.thing !== lotThing(tx, ty) || t.ground !== lot.ground_legend[lot.ground[ty][tx]]) wrong.push(tx + "," + ty); }
    check(V, "every tile shows the ground and the thing the shared lot says", wrong.length === 0, wrong, "all 108 tiles right");
    check(V, "the four spell buttons show, lit: Break Ground, Sprout, Draw and Gust", lit(l) === "on on on on", l.buttons, "spell_draw at 220, 508, beside the other three");
    check(V, "the crop picture is in the top strip, and the crop count says 0", l.counts.crops && l.counts.crops.iconWrongPixels <= (pct <= 1 ? 6 : 30) && crops(l) === "0", l.counts.crops, "icon_crop at 72, 26, the digit 0 at 92, 27");
    check(V, "the seed count still says 8", seeds(l) === "8", l.counts.seeds, "8");
    check(V, "the picture matches the shared art", l.pictureWrongPct <= pct, l.pictureWrongPct + "% of pixels wrong", pct + "% or less");
    check(V, "the bars outside the picture are the dark color", l.barsRightColorPct === null || l.barsRightColorPct >= 99, l.barsRightColorPct, "99% or more");
  }
  async function end(V) {
    const page = await V.page.evaluate(() => ({ x: window.scrollX, y: window.scrollY, zoom: window.visualViewport ? window.visualViewport.scale : 1, picked: String(window.getSelection ? window.getSelection() : "").length }));
    check(V, "the page did not scroll, zoom or select anything", page.x === 0 && page.y === 0 && page.zoom === 1 && page.picked === 0, page, "still");
    check(V, "no errors on the page", V.errs.length === 0, V.errs.slice(0, 3), "none");
    await V.close();
  }
  async function need(V, v) { const l = await V.look(); if (mana(l) < v) await V.wait(((v - mana(l)) / BACK) * 1000 + 250); }
  // One cast: aim at a tile by touch (or leave the aim where it is), touch a spell's button once, and look.
  // It keeps clear of the moments the weeds grow, so a "nothing changed" is not spoiled by them.
  async function cast(V, b, xy, label, press) {
    const ph = T(V) % WEEDS; if (ph > WEEDS - 3.2) await V.wait((WEEDS - ph + 1.6) * 1000);
    if (xy) { await V.tapTile(xy[0], xy[1]); await V.settle(); }
    const aim = await V.look(label ? "aim-" + label : null), t = await V.sound.now(), tp = Date.now();
    await (press ? press() : V.tapButton(b)); const tq = Date.now(); await V.wait(Math.max(120, 1500 / Math.max(1, V.fps || 30)));
    const l = await V.look(label || null); await V.wait(750); const s = await V.sound.since(t), full = Math.min(100, mana(aim) + (BACK * (l.at - aim.at)) / 1000);
    return { aim, l, s, xy, paid: full - b.cost, paidHi: Math.min(100, mana(aim) + (BACK * (tp - aim.at)) / 1000) - b.cost + (BACK * (l.at - tp)) / 1000, free: full, b, when: { lo: tp, hi: tq } };
  }
  const paidFor = (V, g) => mana(g.l) >= g.paid - give(V) && mana(g.l) <= g.paidHi + give(V), notPaidFor = (V, g) => Math.abs(mana(g.l) - g.free) <= give(V);
  const nothing = (V, g) => same(g.aim, g.l) && notPaidFor(V, g) && g.s.name === "no";
  const got = (g) => ({ aimed: aimedAt(g.aim), tile: g.xy ? tile(g.l, g.xy) : undefined, mana: mana(g.l), paidWouldBe: round(g.paid), freeWouldBe: round(g.free), seeds: seeds(g.l), crops: crops(g.l), heard: heard(g.s) });
  // Planting, with no checks of its own (step 4's check has them): Break Ground, then Sprout.
  async function plant(V, xy) { await need(V, 26); await V.tapTile(xy[0], xy[1]); await V.settle(); await V.tapButton(BREAK); await V.wait(250); await V.tapButton(SPROUT); await V.wait(250); }
  // A touch on a tile, with the look before, the look after, and the sound.
  async function touch(V, xy, label) { const before = await V.look(), t = await V.sound.now(); await V.tapTile(xy[0], xy[1]); await V.settle(); const l = await V.look(label); await V.wait(500); return { before, l, s: await V.sound.since(t), xy }; }
  // The weeds' moment, number n: a look just before it and a look just after. Between the two, weeds must
  // have grown on the tile the ask names and on no other, and nothing else may have changed.
  async function weedsGrow(V, n, label) {
    await untilT(V, n * WEEDS - 1.2); const before = await V.look(label + "-before"), spot = weedSpot(before);
    await untilTime(V, V.coverHi + n * WEEDS * 1000 + 1100); const l = await V.look(label + "-after"), changed = [];
    for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 9; tx++) if (sig(before.tiles[ty][tx]) !== sig(l.tiles[ty][tx])) changed.push(tx + "," + ty + " " + sig(l.tiles[ty][tx]));
    const early = before.at > V.coverLo + n * WEEDS * 1000 - 400;
    return { ok: !early && spot && changed.length === 1 && changed[0] === spot.tx + "," + spot.ty + " " + before.tiles[spot.ty][spot.tx].ground + "/weeds", got: { mage: at(before), wanted: spot && spot.tx + "," + spot.ty, changed, lookedTooLate: early || undefined }, spot };
  }

  // ---------------- The playing view: one picture pixel to one screen pixel ----------------
  async function play(V) {
    let l = await begin(V), g, s, t, before, r; startState(V, l, 1);
    const A = [4, 3], C = [3, 3], B = [4, 4], D = [5, 3];

    // Two seeds first. Then Draw on the first, 12 seconds after the cover went away, so that its growing and
    // the weeds' first moment at 45 seconds keep out of each other's way.
    await plant(V, A); await plant(V, C); l = await V.look("two-seeds");
    check(V, "two seeds are planted the way step 4 left it, and both wait on dry soil", isTile(l, A, "soil", "crop_seed") && isTile(l, C, "soil", "crop_seed") && seeds(l) === "6", { a: tile(l, A), c: tile(l, C), seeds: seeds(l) }, "crop_seed on soil at 4,3 and 3,3, 6 seeds");
    await need(V, 30); await untilT(V, 12);
    g = await cast(V, DRAW, A, "draw"); const wA = g.when;
    check(V, "Draw on a planted seed: the ground under it turns to wet soil", isTile(g.l, A, "soil_wet", "crop_seed"), tile(g.l, A), "soil_wet with crop_seed on it");
    check(V, "the mana drops by 10", paidFor(V, g), { mana: mana(g.l), pixels: bar(g.l) }, "about " + round(g.paid));
    check(V, "and draw.wav plays", g.s.name === "draw", g.s, "draw.wav: " + JSON.stringify(sounds.draw));
    check(V, "the seed and crop counts do not change for it", seeds(g.l) === "6" && crops(g.l) === "0", { seeds: seeds(g.l), crops: crops(g.l) }, "6 seeds, 0 crops");
    g = await cast(V, DRAW, null, "draw-again");
    check(V, "Draw on a crop that is already watered changes nothing and plays the no sound", nothing(V, g) && isTile(g.l, A, "soil_wet", "crop_seed"), got(g), "wet soil still, no mana paid, no.wav");
    g = await cast(V, DRAW, C, "draw-second"); const wC = g.when;
    check(V, "a second seed is watered a few seconds after the first", isTile(g.l, C, "soil_wet", "crop_seed") && paidFor(V, g) && g.s.name === "draw", got(g), "wet soil at 3,3, 10 mana paid, draw.wav");

    // Growing by the clock. A look just before each moment and one just after.
    const grows = async (secs, was, is, label) => { await untilTime(V, wA.lo + secs * 1000 - 1200); const b4 = await V.look(label + "-before"); await untilTime(V, wA.hi + secs * 1000 + 1000); const af = await V.look(label + "-after");
      const ok = b4.at < wA.lo + secs * 1000 - 400 && isTile(b4, A, "soil_wet", was) && isTile(af, A, "soil_wet", is);
      check(V, "the watered crop shows " + was + " until " + secs + " seconds, and " + is + " from then", ok, { justBefore: tile(b4, A).thing, secondsBefore: round((wA.lo + secs * 1000 - b4.at) / 1000), justAfter: tile(af, A).thing, secondsAfter: round((af.at - wA.hi - secs * 1000) / 1000) }, was + ", then " + is);
      return af; };
    const others = [];
    l = await grows(10, "crop_seed", "crop_sprout", "sprout"); others.push({ first: tile(l, A).thing, second: tile(l, C).thing, may: stagesFor(wC, l) });
    await plant(V, B);
    g = await cast(V, GUST, A, "gust-on-a-sprout");
    check(V, "Gust on a growing crop changes nothing and plays the no sound", nothing(V, g) && tile(g.l, A).thing === "crop_sprout", got(g), "the sprout still there, no mana paid, no.wav");
    l = await grows(25, "crop_sprout", "crop_grown", "grown"); others.push({ first: tile(l, A).thing, second: tile(l, C).thing, may: stagesFor(wC, l) });
    g = await cast(V, BREAK, A, "break-ground-on-a-crop");
    check(V, "Break Ground on a growing crop changes nothing and plays the no sound", nothing(V, g) && tile(g.l, A).thing === "crop_grown", got(g), "the crop still there, no mana paid, no.wav");

    // The weeds' first moment, 45 seconds after the cover went away.
    r = await weedsGrow(V, 1, "weeds-1");
    check(V, "45 seconds after the cover went away, weeds grow on the bare grass tile farthest from the mage, and on no other", r.ok, r.got, "weeds on that one tile");
    r = await touch(V, A, "touch-on-a-crop-not-ripe");
    check(V, "a touch on a crop that is not ripe only aims", aimedAt(r.l) === A.join(",") && tile(r.l, A).thing === "crop_grown" && crops(r.l) === "0" && !r.s.heard, { aimed: aimedAt(r.l), tile: tile(r.l, A), crops: crops(r.l), heard: heard(r.s) }, "the mark on it, the crop still there, 0 crops, no sound");
    l = await grows(40, "crop_grown", "crop_ripe", "ripe"); others.push({ first: tile(l, A).thing, second: tile(l, C).thing, may: stagesFor(wC, l) });
    check(V, "the step's line, 1: a watered seed is ripe 40 seconds later", isTile(l, A, "soil_wet", "crop_ripe"), tile(l, A), "crop_ripe on wet soil");
    // The aim is still on the crop from the touch before. (A new touch would pick it now.)
    g = await cast(V, SPROUT, null, "sprout-on-a-ripe-crop"); g.xy = A;
    check(V, "Sprout on a ripe crop changes nothing and plays the no sound", aimedAt(g.aim) === A.join(",") && nothing(V, g) && tile(g.l, A).thing === "crop_ripe", got(g), "the ripe crop still there, no.wav");
    g = await cast(V, DRAW, null, "draw-on-a-ripe-crop"); g.xy = A;
    check(V, "Draw on a ripe crop changes nothing and plays the no sound", aimedAt(g.aim) === A.join(",") && nothing(V, g) && tile(g.l, A).thing === "crop_ripe", got(g), "the ripe crop still there, no.wav");
    await untilTime(V, wC.hi + 41000); l = await V.look("second-crop-ripe");
    check(V, "each crop keeps its own time: the second one is a stage behind each time, and ripe 40 seconds after its own watering", others.every((o) => o.second !== o.first && o.may.includes(o.second)) && isTile(l, C, "soil_wet", "crop_ripe") && isTile(l, A, "soil_wet", "crop_ripe"), { whenTheFirstChanged: others, now: tile(l, C).thing }, "seed, sprout, grown, and now ripe");
    check(V, "a seed that has not been watered waits", isTile(l, B, "soil", "crop_seed"), tile(l, B), "crop_seed on dry soil at 4,4");

    // Draw where there is nothing to water.
    await need(V, 30); await V.tapTile(...D); await V.settle(); await V.tapButton(BREAK); await V.wait(300);
    for (const [xy, what, label] of [[D, "soil with no seed", "bare-soil"], [[5, 4], "grass", "grass"], [[2, 4], "a tile with rubble on it", "rubble"], [[4, 1], "the house", "house"], [[6, 1], "the crate", "crate"]]) {
      g = await cast(V, DRAW, xy, "draw-on-" + label);
      check(V, "Draw on " + what + " changes nothing and plays the no sound", aimedAt(g.aim) === xy.join(",") && nothing(V, g) && (xy !== D || isTile(g.l, D, "soil", null)), got(g), "unchanged, no mana paid, no.wav"); }

    // Walking over crops and wet soil. Then a touch on a ripe crop from 3 tiles away.
    await V.walkToTile(4, 2, 5); await V.walkToTile(4, 3, 5); l = await V.look("standing-on-a-ripe-crop");
    check(V, "wet soil and a ripe crop do not stop the mage", l.mage && l.mage.tileX === 4 && l.mage.tileY === 3, at(l), "on tile 4,3");
    await V.walkToTile(4, 6, 6);
    r = await touch(V, A, "touch-on-a-ripe-crop-too-far");
    check(V, "a touch on a ripe crop 3 tiles away does nothing", r.l.mage && r.l.mage.tileY === 6 && tile(r.l, A).thing === "crop_ripe" && crops(r.l) === "0" && !r.s.heard && aimedAt(r.l) !== A.join(","), { mage: at(r.l), tile: tile(r.l, A), crops: crops(r.l), heard: heard(r.s), aimed: aimedAt(r.l) }, "the crop still there, 0 crops, no sound, no mark on it");
    // The stairwell, and no aimed tile.
    await V.walkToTile(6, 9, 6); g = await cast(V, DRAW, [7, 10], "draw-at-the-stairwell");
    check(V, "Draw at the stairwell changes nothing and plays the no sound", aimedAt(g.aim) === "7,10" && nothing(V, g), got(g), "unchanged, no mana paid, no.wav");
    await V.push(-1, 0, 2600); g = await cast(V, DRAW, null, "draw-with-no-aimed-tile");
    check(V, "Draw with no aimed tile changes nothing and plays the no sound", aimedAt(g.aim) === "none" && nothing(V, g), got(g), "no mark, nothing changed, no.wav");

    // Back at the start: picking.
    await V.walkToTile(4, 2, 5); await need(V, 20);
    r = await touch(V, A, "pick");
    check(V, "the step's line, 2: a touch on the ripe crop picks it, and leaves bare ground", isTile(r.before, A, "soil_wet", "crop_ripe") && isTile(r.l, A, "grass", null), { was: tile(r.before, A), now: tile(r.l, A) }, "the sprite grass, nothing on it");
    check(V, "the crop count goes to 1", crops(r.l) === "1", r.l.counts.crops, "1");
    check(V, "and pick.wav plays", r.s.name === "pick", r.s, "pick.wav: " + JSON.stringify(sounds.pick));
    check(V, "picking costs no mana and gives no seed back, and the touch aims at the tile", bar(r.l) >= bar(r.before) && seeds(r.l) === seeds(r.before) && aimedAt(r.l) === A.join(","), { before: bar(r.before), after: bar(r.l), seeds: seeds(r.l), aimed: aimedAt(r.l) }, "no drop, the seeds as they were, the mark on 4,3");
    // The stick's thumb, slid onto the other ripe crop, does not pick. Nor does a touch that starts on a button.
    await V.finger.down(1, K.STICK.x, K.STICK.y); await V.finger.slide(1, ...tileMid(...C)); await V.wait(500); l = await V.look("stick-thumb-over-a-ripe-crop"); await V.finger.lift(1); await V.settle();
    check(V, "the stick's thumb, slid onto a ripe crop, does not pick it", tile(l, C).thing === "crop_ripe" && crops(l) === "1", { tile: tile(l, C), crops: crops(l) }, "the crop still there, 1 crop");
    await V.walkToTile(4, 2, 5); await V.finger.down(4, ...mid(GUST)); await V.finger.slide(4, ...tileMid(...C)); await V.wait(400); l = await V.look("button-touch-over-a-ripe-crop"); await V.finger.lift(4); await V.settle(); await V.wait(500);
    check(V, "a touch that starts on a button and slides onto a ripe crop does not pick it", tile(l, C).thing === "crop_ripe" && crops(l) === "1", { tile: tile(l, C), crops: crops(l) }, "the crop still there, 1 crop");
    r = await touch(V, C, "pick-second");
    check(V, "the second ripe crop is picked the same way", isTile(r.l, C, "grass", null) && crops(r.l) === "2" && r.s.name === "pick", { tile: tile(r.l, C), crops: crops(r.l), heard: heard(r.s) }, "grass, 2 crops, pick.wav");

    // The weeds' next moment, with the mage standing at the start tile. Soil is never bare grass.
    const n = Math.ceil((T(V) + 2.5) / WEEDS); r = await weedsGrow(V, n, "weeds-" + n);
    check(V, "the step's line, 3: a weed comes back, " + n * WEEDS + " seconds after the cover went away, on the bare grass tile farthest from the mage", r.ok, r.got, "weeds on that one tile");

    // Low mana. Break Ground on bare grass runs it down.
    l = await V.look("before-the-run-down"); const grass = reach(l, bareGrass); let m = { v: mana(l), at: l.at };
    const est = () => Math.min(100, m.v + (BACK * (Date.now() - m.at)) / 1000), until = async (v) => { const ms = ((v - est()) / BACK) * 1000; if (ms > 0) await V.wait(ms); };
    const quick = async (b, xy) => { await V.tapTile(xy[0], xy[1], 30); await V.wait(40); await V.tapButton(b, 30); m = { v: est() - b.cost, at: Date.now() }; await V.wait(40); };
    const bringUnder = async (v) => { for (let i = 0; i < 10 && est() > v && grass.length; i++) { await until(14.3); await quick(BREAK, grass.shift()); } };
    while (grass.length > 4 && est() >= 14.5) await quick(BREAK, grass.shift());
    let low = null;
    for (let tries = 0; tries < 4 && !low; tries++) {
      // Draw at the dry seed with about 7 mana, reckoned by the clock, then screenshots one after another,
      // read afterwards. One of them should fall where Gust's button is lit again and Draw's is not.
      await bringUnder(5.8); const sn0 = await V.snap(tries ? null : "all-dim"); await V.tapTile(B[0], B[1], 30); await until(7); const tB = await V.sound.now(), cAt = Date.now(); await V.tapButton(DRAW, 30);
      const snaps = []; for (let i = 0; i < 7; i++) { await V.wait(25); snaps.push(await V.snap(i === 0 ? "draw-dim" : null)); } await V.wait(Math.max(0, 340 - (Date.now() - cAt)));
      const log = await V.sound.readings(tB - 80), peak = (from, to) => log.filter((e) => e[0] >= from && e[0] < to).reduce((mx, e) => Math.max(mx, e[1]), 0), tail = peak(tB - 80, tB), after = peak(tB + 20, tB + 330);
      const dim = await V.read(sn0), looks = []; for (const sn of snaps) looks.push(await V.read(sn)); const first = looks[0], last = looks[looks.length - 1], inWindow = looks.find((k) => mana(k) >= 8.5 && mana(k) <= 9.6); m = { v: mana(last), at: last.at };
      if (process.env.CHECK_NOTES) console.log("  note: draw refused try", tries, "all-dim look at", mana(dim), lit(dim), "then the bar in the screenshots", looks.map((k) => mana(k)).join(" "), "buttons", looks.map((k) => lit(k)).join(" | "));
      if (mana(dim) >= 7.5 || mana(first) > 9.4 || !inWindow) continue;
      low = { allDim: lit(dim), manaAllDim: mana(dim), buttons: lit(inWindow), manaThen: mana(inWindow), unchanged: isTile(last, B, "soil", "crop_seed"), rising: mana(last) >= mana(first), tile: tile(last, B), tail: round(tail), loudestAfter: round(after), newSound: after > Math.max(0.03, tail * 1.5 + 0.02) }; }
    if (!low) console.log("  note: the referee could not get a Draw cast in at the right moment. That is the referee's timing, not the build. Run this view again on a quiet machine.");
    check(V, "with less than 8 mana, all four buttons are dim", low && low.allDim === "off off off off", low && { buttons: low.allDim, mana: low.manaAllDim }, "all four dim");
    check(V, "with 8 or 9 mana, the Draw button shows its dim picture and Gust's is lit", low && low.buttons === "off off off on", low && { buttons: low.buttons, mana: low.manaThen }, "spell_draw_off, spell_gust");
    check(V, "a Draw cast with less than 10 mana changes nothing", low && low.unchanged && low.rising, low && { tile: low.tile, manaStillRising: low.rising }, "the seed still on dry soil, no mana taken");
    check(V, "and makes no sound", low && !low.newSound, low && { loudestJustBefore: low.tail, loudestAfter: low.loudestAfter }, "no new sound");
    l = await V.look(); for (let i = 0; i < 40 && mana(l) < 15.5; i++) l = await V.look(); l = await V.look("buttons-lit-again");
    check(V, "when the mana is back, all four buttons are lit again", mana(l) >= 15 && lit(l) === "on on on on", { mana: mana(l), buttons: lit(l) }, "all four lit");

    // Two thumbs: one pushes the mage up against the house, another aims at the dry seed and touches Draw.
    await need(V, 30); await V.finger.down(1, K.STICK.x, K.STICK.y); await V.finger.slide(1, K.STICK.x, K.STICK.y - 45); await V.wait(400);
    await V.finger.down(2, ...tileMid(...B)); await V.wait(70); await V.finger.lift(2); await V.settle();
    g = await cast(V, DRAW, null, "second-thumb-draws", async () => { await V.finger.down(3, ...mid(DRAW)); await V.wait(70); await V.finger.lift(3); });
    check(V, "with a thumb on the stick, a touch on Draw casts it", aimedAt(g.aim) === B.join(",") && isTile(g.l, B, "soil_wet", "crop_seed") && paidFor(V, g) && g.s.name === "draw" && knobAt(g.l, 0, -28), { ...got(g), tile: tile(g.l, B), knob: g.l.knob }, "wet soil at 4,4, the knob still out, draw.wav");
    await V.finger.lift(1); await V.settle(); const rest = await V.look();
    await V.finger.down(4, ...mid(DRAW)); await V.finger.slide(4, K.STICK.x - 30, K.STICK.y); await V.wait(500); l = await V.look("draw-touch-slid-to-the-stick"); await V.finger.lift(4); await V.wait(600);
    check(V, "a touch that starts on the Draw button and slides onto the stick does not work it", knobAt(l, 0, 0, 1) && rest.mage && near(l, rest.mage.x, rest.mage.y, 1), { knob: l.knob, mage: at(l), was: at(rest) }, "the knob at rest, the mage still");
    // Holding the button down casts once. A fresh seed on the soil at 5,3 for it.
    await need(V, 30); await V.tapTile(...D); await V.settle(); await V.tapButton(SPROUT); await V.wait(900);
    g = await cast(V, DRAW, null, "draw-held", async () => { await V.finger.down(4, ...mid(DRAW)); await V.wait(1200); await V.finger.lift(4); });
    check(V, "holding the Draw button down casts once, not again and again", isTile(g.aim, D, "soil", "crop_seed") && isTile(g.l, D, "soil_wet", "crop_seed") && g.s.name === "draw" && g.s.seconds < sounds.draw.seconds + 0.15, { ...got(g), tile: tile(g.l, D), sound: g.s }, "wet soil at 5,3, and draw.wav once");
    l = await V.look("the-end", true);
    check(V, "the counts at the end: 4 seeds and 2 crops", seeds(l) === "4" && crops(l) === "2", { seeds: seeds(l), crops: crops(l) }, "4 and 2");
    check(V, "the picture still matches the shared art", l.pictureWrongPct <= 1, l.pictureWrongPct + "% of pixels wrong", "1% or less");
    await end(V);
  }

  // ---------------- The other sizes: the picture, and one seed watered ----------------
  async function size(V, pct) {
    const l = await begin(V); startState(V, l, pct);
    await plant(V, [4, 4]); const g = await cast(V, DRAW, null, "draw");
    check(V, "a touch on Draw waters the seed", isTile(g.l, [4, 4], "soil_wet", "crop_seed") && paidFor(V, g) && g.s.heard, got(g), "wet soil at 4,4, 10 mana paid, a sound");
    check(V, "the picture still matches the shared art", g.l.pictureWrongPct <= pct, g.l.pictureWrongPct + "% of pixels wrong", pct + "% or less");
    await end(V);
  }

  // ---------------- PC size: the 4 key, and the mouse picks ----------------
  async function pc(V) {
    let l = await begin(V); startState(V, l, 3);
    await V.page.keyboard.press("2"); await V.wait(300); await V.page.keyboard.press("3"); await V.wait(600);
    const g = await cast(V, DRAW, null, "key-4", () => V.page.keyboard.press("4")); g.xy = [4, 3];
    check(V, "the 4 key casts Draw on the aimed tile", isTile(g.l, [4, 3], "soil_wet", "crop_seed") && paidFor(V, g) && g.s.name === "draw", got(g), "wet soil at 4,3, 10 mana paid, draw.wav");
    await untilTime(V, g.when.hi + 41200); l = await V.look("ripe");
    const r = await touch(V, [4, 3], "mouse-picks");
    check(V, "a mouse press on a ripe crop picks it", tile(l, [4, 3]).thing === "crop_ripe" && isTile(r.l, [4, 3], "grass", null) && crops(r.l) === "1" && r.s.name === "pick", { was: tile(l, [4, 3]), now: tile(r.l, [4, 3]), crops: crops(r.l), heard: heard(r.s) }, "grass, 1 crop, pick.wav");
    await end(V);
  }

  // ---------------- A short film of the step, for the series ----------------
  async function film(V) {
    await begin(V, true); await V.wait(600);
    for (const [tx, ty] of [[4, 3], [3, 3], [5, 3]]) { await V.tapTile(tx, ty); await V.wait(300); await V.tapButton(BREAK); await V.wait(500); await V.tapButton(SPROUT); await V.wait(500); await V.tapButton(DRAW); await V.wait(1500); }
    const watered = Date.now(); await V.tapTile(2, 4); await V.wait(400); await V.tapButton(GUST); await V.wait(900); await V.push(1, 0.3, 900); await V.wait(500); await V.push(-1, 0.2, 900);
    await V.wait(Math.max(0, 41500 - (Date.now() - watered))); await V.walkToTile(4, 2, 6);
    for (const [tx, ty] of [[4, 3], [3, 3], [5, 3]]) { await V.tapTile(tx, ty); await V.wait(700); }
    await V.wait(2500); await V.close();
  }

  const views = [
    ["play", { name: "play", width: 288, height: 576, dpr: 1, touch: true }, (V) => play(V)],
    ["phone-sharp", { name: "phone-sharp", width: 390, height: 844, dpr: 3, touch: true }, (V) => size(V, 1)],
    ["phone", { name: "phone", width: 390, height: 844, dpr: 1, touch: true }, (V) => size(V, 1)],
    ["small-phone", { name: "small-phone", width: 360, height: 640, dpr: 1, touch: true }, (V) => size(V, 3)],
    ["phone-sideways", { name: "phone-sideways", width: 640, height: 360, dpr: 2, touch: true }, (V) => size(V, 3)],
    ["pc", { name: "pc", width: 1280, height: 720, dpr: 1, touch: false }, (V) => pc(V)],
    ["film", { name: "film", width: 576, height: 1152, dpr: 1, touch: true, film: "step-05.webm" }, (V) => film(V)],
  ];
  for (const [name, v, run] of views) { if (only && only !== name) continue; console.log("\n" + name + " (" + v.width + "x" + v.height + " @" + v.dpr + ")"); const V = await open(v); try { await run(V); } catch (e) { check(V, "the check ran to its end", false, String(e && e.stack ? e.stack : e).slice(0, 600), "no trouble in the check itself"); try { await V.close(); } catch (e2) { /* already closed */ } } }
  const report = await finish();
  process.exit(report.missed ? 1 : 0);
})();
