// The referee's check for step 4, "Soil and seeds", the same for both builds. Like step 3's check, it serves a
// build's web folder the way a plain web host would, opens it in headless Chromium, and plays it with real
// touch events (and, at PC size, the mouse and the keys). Everything it judges it reads from screenshots: the
// ground and the thing on each tile, the seed count's digits, the mana bar, which picture each button shows.
// Which sound a cast played it reads from what the page sends to the speakers, set against the shared sounds.
//
//   node tools/check-step-04.cjs <web folder> <folder for screenshots> [one view's name]
//
// Steps 1 to 3 still standing is checked by running step 3's check on the same build:
//
//   BUILD_STEP=4 node tools/check-step-03.cjs <web folder> <folder for screenshots>
const path = require("path");
const { K, referee, layoutFor, BUTTONS } = require("./referee.cjs");

const web = path.resolve(process.argv[2] || "web"), out = path.resolve(process.argv[3] || "check-out"), only = process.argv[4] || "";
const [GUST, BREAK, SPROUT] = ["gust", "break_ground", "sprout"].map((n) => BUTTONS.find((b) => b.name === n));
const BACK = 6.5, BAR = 118, SEEDS = 8;
const mid = (b) => [b.x + 28, b.y + 28];

(async () => {
  const ref = await referee(web, out, 4, layoutFor(Number(process.env.BUILD_STEP || 4)));
  const { open, check, finish, lot, round, at, near, knobAt, thing, aimedAt, lotThing, sounds } = ref;
  const bar = (l) => (l.mana ? l.mana.filledPixels : null), mana = (l) => (l.mana ? l.mana.mana : null);
  const lit = (l) => [BREAK, SPROUT, GUST].map((b) => l.buttons[b.name].shows).join(" "), seeds = (l) => (l.counts.seeds ? l.counts.seeds.text : null);
  const tileMid = (tx, ty) => [tx * K.T + 16, K.TOP + ty * K.T + 16];
  const tile = (l, xy) => l.tiles[xy[1]][xy[0]], isTile = (l, xy, ground, th) => tile(l, xy).ground === ground && tile(l, xy).thing === th;
  const grassOf = (xy) => lot.ground_legend[lot.ground[xy[1]][xy[0]]];
  const count = (l, f) => l.tiles.flat().filter(f).length, soils = (l) => count(l, (t) => t.ground === "soil"), planted = (l) => count(l, (t) => t.thing === "crop_seed"), cleared = (l) => count(l, (t) => t.thing === "rubble" || t.thing === "weeds");
  // From step 5 on, weeds come back every 45 seconds, far from the mage. So in a later step's build, one more
  // tile of weeds between two looks is not a cast's doing.
  const WEEDY = Number(process.env.BUILD_STEP || 4) >= 5;
  const same = (a, b) => soils(a) === soils(b) && planted(a) === planted(b) && (cleared(a) === cleared(b) || (WEEDY && cleared(b) === cleared(a) + 1)) && seeds(a) === seeds(b);
  const give = (V) => 2 + (BACK * 1.5) / Math.max(1, V.fps || 30);
  const heard = (s) => (s.heard ? s.name : "none");
  // Tiles within the reach of a touch from where the mage stands (2 across, 2 up or down), its own tile left out.
  const reach = (l, f) => { const list = []; if (l.mage) for (let ty = l.mage.tileY - 2; ty <= l.mage.tileY + 2; ty++) for (let tx = l.mage.tileX - 2; tx <= l.mage.tileX + 2; tx++) if (tx >= 0 && tx < 9 && ty >= 0 && ty < 12 && !(tx === l.mage.tileX && ty === l.mage.tileY) && f(l.tiles[ty][tx])) list.push([tx, ty]); return list; };
  const bareGrass = (t) => (t.ground === "grass" || t.ground === "grass_flowers") && t.thing === null, bareSoil = (t) => t.ground === "soil" && t.thing === null;

  async function begin(V, quiet) {
    if (!quiet) check(V, "the cover shows first", V.coverSeen, V.secondsToCover + " s", "the cover with its words");
    await V.tap(220, 24, 250); await V.wait(900); await V.pace();
    return V.look("start", true);
  }
  function startState(V, l, pct) {
    check(V, "the mage starts below the door, facing down", near(l, K.START.x, K.START.y, 1) && l.mage.facing === "down", at(l), "144, 80, facing down");
    const wrong = []; for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 9; tx++) { const t = l.tiles[ty][tx]; if (t.thing !== lotThing(tx, ty) || t.ground !== lot.ground_legend[lot.ground[ty][tx]]) wrong.push(tx + "," + ty); }
    check(V, "every tile shows the ground and the thing the shared lot says, with no soil yet", wrong.length === 0, wrong, "all 108 tiles right");
    check(V, "the three spell buttons show, lit: Break Ground, Sprout and Gust", lit(l) === "on on on", l.buttons, "spell_break_ground at 220, 444, spell_sprout at 156, 508, spell_gust at 156, 444");
    check(V, "the seed picture is in the top strip", l.counts.seeds && l.counts.seeds.iconWrongPixels <= (pct <= 1 ? 6 : 30), l.counts.seeds, "icon_seed at 8, 26");
    check(V, "the seed count says 8, as one digit", seeds(l) === String(SEEDS), l.counts.seeds, "the digit 8 at 28, 27");
    check(V, "the mana bar is full", bar(l) >= BAR - 1, l.mana, "118 pixels");
    check(V, "the picture matches the shared art", l.pictureWrongPct <= pct, l.pictureWrongPct + "% of pixels wrong", pct + "% or less");
    check(V, "the bars outside the picture are the dark color", l.barsRightColorPct === null || l.barsRightColorPct >= 99, l.barsRightColorPct, "99% or more");
  }
  async function end(V) {
    const page = await V.page.evaluate(() => ({ x: window.scrollX, y: window.scrollY, zoom: window.visualViewport ? window.visualViewport.scale : 1, picked: String(window.getSelection ? window.getSelection() : "").length }));
    check(V, "the page did not scroll, zoom or select anything", page.x === 0 && page.y === 0 && page.zoom === 1 && page.picked === 0, page, "still");
    check(V, "no errors on the page", V.errs.length === 0, V.errs.slice(0, 3), "none");
    await V.close();
  }
  // Waits, if it must, until the bar shows at least this much mana.
  async function need(V, v) { const l = await V.look(); if (mana(l) < v) await V.wait(((v - mana(l)) / BACK) * 1000 + 250); }
  // One cast: aim at a tile by touch (or leave the aim where it is), touch a spell's button once, and look.
  // Gives the look before, the look after, the sound, and what the bar should show if the cast was paid for
  // and if it was not.
  async function cast(V, b, xy, label, press) {
    if (xy) { await V.tapTile(xy[0], xy[1]); await V.settle(); }
    const aim = await V.look(label ? "aim-" + label : null), t = await V.sound.now(), tp = Date.now();
    await (press ? press() : V.tapButton(b)); await V.wait(Math.max(120, 1500 / Math.max(1, V.fps || 30)));
    const l = await V.look(label || null); await V.wait(750); const s = await V.sound.since(t), full = Math.min(100, mana(aim) + (BACK * (l.at - aim.at)) / 1000);
    // At full mana the reckoning has two ends: what came back before the cast is lost to the cap, what comes
    // back after it is not, and the cast fell somewhere between the touch and the look.
    return { aim, l, s, xy, paid: full - b.cost, paidHi: Math.min(100, mana(aim) + (BACK * (tp - aim.at)) / 1000) - b.cost + (BACK * (l.at - tp)) / 1000, free: full, b };
  }
  const paidFor = (V, g) => mana(g.l) >= g.paid - give(V) && mana(g.l) <= g.paidHi + give(V), notPaidFor = (V, g) => Math.abs(mana(g.l) - g.free) <= give(V);
  // A cast that works: the tile is as it should be, the mana dropped by the spell's cost, the count is right,
  // and the spell's own sound played.
  // The seed count is judged against the look before the cast: one fewer after a Sprout, the same otherwise.
  const worked = (V, g, ground, th) => (!g.xy || isTile(g.l, g.xy, ground, th)) && paidFor(V, g) && seeds(g.l) === String(Number(seeds(g.aim)) - (g.b === SPROUT ? 1 : 0)) && g.s.name === g.b.name;
  // A cast that changes nothing: every tile as before, the mana not paid, the count as before, and the no sound.
  const nothing = (V, g) => same(g.aim, g.l) && (!g.xy || (tile(g.l, g.xy).ground === tile(g.aim, g.xy).ground && tile(g.l, g.xy).thing === tile(g.aim, g.xy).thing)) && notPaidFor(V, g) && g.s.name === "no";
  const got = (g) => ({ aimed: aimedAt(g.aim), tile: g.xy ? tile(g.l, g.xy) : undefined, mana: mana(g.l), paidWouldBe: round(g.paid), freeWouldBe: round(g.free), seeds: seeds(g.l), heard: heard(g.s), soil: soils(g.l), planted: planted(g.l) });

  // ---------------- The playing view: one picture pixel to one screen pixel ----------------
  async function play(V) {
    let l = await begin(V), g, s, t, before; startState(V, l, 1);

    // Break Ground on the tile in front (4,3, bare grass), then again on the soil.
    g = await cast(V, BREAK, null, "break-ground");
    check(V, "Break Ground on bare grass: the tile turns to soil", isTile(g.l, [4, 3], "soil", null), g.l.tiles[3][4], "the sprite soil, nothing on it");
    check(V, "the mana drops by 14", paidFor(V, g), { mana: mana(g.l), pixels: bar(g.l) }, "about " + round(g.paid));
    check(V, "and break_ground.wav plays", g.s.name === "break_ground", g.s, "break_ground.wav: " + JSON.stringify(sounds.break_ground));
    check(V, "the seed count does not change for it", seeds(g.l) === "8", l.counts.seeds, "8");
    g = await cast(V, BREAK, null, "break-ground-on-soil");
    check(V, "Break Ground on a tile that is already soil changes nothing and plays the no sound", nothing(V, g) && isTile(g.l, [4, 3], "soil", null), got(g), "soil still, no mana paid, no.wav");

    // Sprout on the soil, then again on the seed. Then the other two spells on the seed.
    g = await cast(V, SPROUT, null, "sprout");
    check(V, "Sprout on soil: a seed is planted, drawn over the soil", isTile(g.l, [4, 3], "soil", "crop_seed"), g.l.tiles[3][4], "soil with crop_seed on it");
    check(V, "the seed count drops to 7", seeds(g.l) === "7", g.l.counts.seeds, "7");
    check(V, "the mana drops by 10", paidFor(V, g), { mana: mana(g.l), pixels: bar(g.l) }, "about " + round(g.paid));
    check(V, "and sprout.wav plays", g.s.name === "sprout", g.s, "sprout.wav: " + JSON.stringify(sounds.sprout));
    check(V, "the aim mark still shows on the tile, over the seed", g.l.tiles[3][4].aim && g.l.tiles[3][4].wrongPixels <= 8, g.l.tiles[3][4], "the mark over the seed");
    g = await cast(V, SPROUT, null, "sprout-on-a-seed");
    check(V, "Sprout on soil that already has a seed changes nothing and plays the no sound", nothing(V, g) && seeds(g.l) === "7", got(g), "one seed on the tile, 7 seeds, no mana paid, no.wav");
    g = await cast(V, BREAK, null, "break-ground-on-a-seed");
    check(V, "Break Ground on a planted seed changes nothing and plays the no sound", nothing(V, g), got(g), "the seed still there, no mana paid, no.wav");
    g = await cast(V, GUST, null, "gust-on-a-seed");
    check(V, "Gust on a planted seed changes nothing and plays the no sound", nothing(V, g) && isTile(g.l, [4, 3], "soil", "crop_seed"), got(g), "the seed still there, no mana paid, no.wav");

    // Sprout on grass, both new spells on rubble, Break Ground on weeds.
    g = await cast(V, SPROUT, [4, 4], "sprout-on-grass");
    check(V, "Sprout on grass changes nothing and plays the no sound", aimedAt(g.aim) === "4,4" && nothing(V, g), got(g), "grass still, 7 seeds, no mana paid, no.wav");
    g = await cast(V, SPROUT, [2, 4], "sprout-on-rubble");
    check(V, "Sprout on a tile with rubble on it changes nothing and plays the no sound", aimedAt(g.aim) === "2,4" && nothing(V, g) && thing(g.l, 2, 4) === "rubble", got(g), "the rubble still there, no.wav");
    g = await cast(V, BREAK, null, "break-ground-on-rubble");
    check(V, "Break Ground on a tile with rubble still on it changes nothing and plays the no sound", nothing(V, g) && isTile(g.l, [2, 4], "grass", "rubble"), got(g), "grass with the rubble on it, no.wav");
    g = await cast(V, BREAK, [6, 4], "break-ground-on-weeds");
    check(V, "and the same with weeds on the tile", aimedAt(g.aim) === "6,4" && nothing(V, g) && isTile(g.l, [6, 4], "grass", "weeds"), got(g), "grass with the weeds on it, no.wav");

    // The step's own line: a cleared tile becomes soil, then holds a seed, and the count drops by one.
    await need(V, 40);
    g = await cast(V, GUST, [2, 4], "done-gust");
    check(V, "the step's line, 1: Gust clears the rubble, as before", isTile(g.l, [2, 4], "grass", null) && paidFor(V, g) && g.s.name === "gust", got(g), "grass with nothing on it, 8 mana paid, gust.wav");
    g = await cast(V, BREAK, null, "done-break-ground");
    check(V, "the step's line, 2: the cleared tile becomes soil", worked(V, g, "soil", null) && isTile(g.l, [2, 4], "soil", null), { ...got(g), tile: g.l.tiles[4][2] }, "soil, 14 mana paid, break_ground.wav");
    g = await cast(V, SPROUT, null, "done-sprout");
    check(V, "the step's line, 3: then it holds a seed, and the count drops by one", worked(V, g, "soil", "crop_seed") && isTile(g.l, [2, 4], "soil", "crop_seed"), { ...got(g), tile: g.l.tiles[4][2] }, "crop_seed on the soil, 6 seeds, 10 mana paid, sprout.wav");

    // Grass with flowers turns to soil too, and Gust does nothing to bare soil.
    await need(V, 30);
    g = await cast(V, BREAK, [2, 2], "break-ground-on-flowers");
    check(V, "Break Ground on grass with flowers: the tile turns to soil", grassOf([2, 2]) === "grass_flowers" && aimedAt(g.aim) === "2,2" && isTile(g.l, [2, 2], "soil", null) && paidFor(V, g) && g.s.name === "break_ground", got(g), "soil, 14 mana paid, break_ground.wav");
    g = await cast(V, GUST, null, "gust-on-soil");
    check(V, "Gust on soil changes nothing and plays the no sound", nothing(V, g) && isTile(g.l, [2, 2], "soil", null), got(g), "soil still, no mana paid, no.wav");

    // The house and the crate.
    for (const [xy, what] of [[[4, 1], "the house"], [[6, 1], "the crate"]]) for (const b of [BREAK, SPROUT]) {
      g = await cast(V, b, xy, (b === BREAK ? "break-ground" : "sprout") + "-at-" + what.replace(/ /g, "-"));
      check(V, (b === BREAK ? "Break Ground" : "Sprout") + " at " + what + " changes nothing and plays the no sound", aimedAt(g.aim) === xy.join(",") && nothing(V, g), got(g), "unchanged, no mana paid, no.wav");
    }

    // Walking: soil and a planted seed do not stop the mage.
    await V.push(-1, 0, 720); l = await V.look("standing-on-soil");
    check(V, "soil does not stop the mage", l.mage && l.mage.tileX <= 2 && l.mage.tileY === 2, at(l), "on the soil at tile 2,2");
    await V.walkToTile(4, 2, 5); await V.walkToTile(4, 3, 5); l = await V.look("standing-on-a-seed"); await V.push(0, 1, 700); before = await V.look("walked-over-a-seed");
    check(V, "a planted seed does not stop the mage", l.mage && l.mage.tileX === 4 && l.mage.tileY === 3 && before.mage && before.mage.tileY >= 4, { onTheSeed: at(l), after: at(before) }, "onto tile 4,3 and on down");
    check(V, "and the seed is still there after the mage has walked over it", isTile(before, [4, 3], "soil", "crop_seed"), before.tiles[3][4], "crop_seed on soil");

    // The stairwell. From tile 6,9 the stairwell at 7,10 is in reach.
    await V.walkToTile(6, 9, 6);
    for (const b of [BREAK, SPROUT, GUST]) { g = await cast(V, b, [7, 10], b.name + "-at-the-stairwell");
      check(V, { break_ground: "Break Ground", sprout: "Sprout", gust: "Gust" }[b.name] + " at the stairwell changes nothing and plays the no sound", aimedAt(g.aim) === "7,10" && nothing(V, g) && isTile(g.l, [7, 10], "stairs_down", null), got(g), "the stairwell as it was, no mana paid, no.wav"); }

    // No aimed tile: at the lot's left edge, facing off it.
    await V.push(-1, 0, 2600); l = await V.look("at-the-left-edge"); const row = l.mage ? l.mage.tileY : 9;
    for (const b of [BREAK, SPROUT]) { g = await cast(V, b, null, b.name + "-with-no-aimed-tile");
      check(V, (b === BREAK ? "Break Ground" : "Sprout") + " with no aimed tile changes nothing and plays the no sound", aimedAt(g.aim) === "none" && g.aim.mage && g.aim.mage.x <= 17 && nothing(V, g), got(g), "no mark, nothing changed, no mana paid, no.wav"); }

    // Two thumbs. One holds the stick, pushing the mage into the edge. Another aims at the bare grass below
    // the mage, and touches Break Ground and then Sprout.
    const free = reach(l, bareGrass), T1 = free.find(([tx, ty]) => tx === 0 && ty === row + 1) || free[0] || [0, row + 1];
    await need(V, 40); await V.finger.down(1, K.STICK.x, K.STICK.y); await V.finger.slide(1, K.STICK.x - 45, K.STICK.y); await V.wait(350);
    await V.finger.down(2, ...tileMid(...T1)); await V.wait(70); await V.finger.lift(2); await V.settle(); before = await V.look("thumb-on-the-stick-aims");
    g = await cast(V, BREAK, null, "second-thumb-breaks-ground", async () => { await V.finger.down(3, ...mid(BREAK)); await V.wait(70); await V.finger.lift(3); }); g.xy = T1;
    check(V, "with a thumb on the stick, a touch on Break Ground casts it", bareGrass(tile(before, T1)) && aimedAt(before) === T1.join(",") && worked(V, g, "soil", null) && knobAt(g.l, -28, 0), { ...got(g), knob: g.l.knob }, "soil at " + T1.join(",") + ", the knob still out, break_ground.wav");
    g = await cast(V, SPROUT, null, "second-thumb-sprouts", async () => { await V.finger.down(3, ...mid(SPROUT)); await V.wait(70); await V.finger.lift(3); }); g.xy = T1;
    check(V, "and a touch on Sprout casts it", worked(V, g, "soil", "crop_seed") && knobAt(g.l, -28, 0), { ...got(g), knob: g.l.knob }, "a seed at " + T1.join(",") + ", 5 seeds, the knob still out, sprout.wav");
    await V.finger.lift(1); await V.settle(); const rest = await V.look();
    // Touches that start on a new button never work the stick.
    for (const b of [BREAK, SPROUT]) { t = await V.sound.now(); await V.finger.down(4, ...mid(b)); await V.finger.slide(4, K.STICK.x - 30, K.STICK.y); await V.wait(500); l = await V.look(b.name + "-touch-slid-to-the-stick"); await V.finger.lift(4); await V.wait(500);
      check(V, "a touch that starts on the " + (b === BREAK ? "Break Ground" : "Sprout") + " button and slides onto the stick does not work it", knobAt(l, 0, 0, 1) && rest.mage && near(l, rest.mage.x, rest.mage.y, 1), { knob: l.knob, mage: at(l), was: at(rest) }, "the knob at rest, the mage still"); }
    // Holding a button down casts once. The tile two to the right of the mage is bare grass.
    const T2 = reach(await V.look(), bareGrass).find(([tx, ty]) => tx === 2 && ty === row) || reach(await V.look(), bareGrass)[0] || [2, row];
    await need(V, 40); await V.tapTile(...T2); await V.settle(); before = await V.look("aim-for-the-long-press");
    g = await cast(V, BREAK, null, "break-ground-held", async () => { await V.finger.down(4, ...mid(BREAK)); await V.wait(1200); await V.finger.lift(4); }); g.xy = T2;
    check(V, "holding the Break Ground button down casts once, not again and again", bareGrass(tile(before, T2)) && isTile(g.l, T2, "soil", null) && g.s.name === "break_ground" && g.s.seconds < sounds.break_ground.seconds + 0.15, { ...got(g), sound: g.s }, "soil, and break_ground.wav once");
    g = await cast(V, SPROUT, null, "sprout-held", async () => { await V.finger.down(4, ...mid(SPROUT)); await V.wait(1200); await V.finger.lift(4); }); g.xy = T2;
    check(V, "holding the Sprout button down casts once", isTile(g.l, T2, "soil", "crop_seed") && seeds(g.l) === String(Number(seeds(g.aim)) - 1) && g.s.name === "sprout" && g.s.seconds < sounds.sprout.seconds + 0.15, { ...got(g), sound: g.s }, "one seed, one fewer in the count, and sprout.wav once");
    // The stick's own thumb, slid over the two new buttons, casts nothing.
    before = await V.look(); t = await V.sound.now(); await V.finger.down(1, K.STICK.x, K.STICK.y); await V.finger.slide(1, ...mid(BREAK)); await V.wait(450); await V.finger.slide(1, ...mid(SPROUT)); await V.wait(450); await V.finger.lift(1); await V.settle(); l = await V.look("stick-thumb-over-the-new-buttons"); s = await V.sound.since(t);
    check(V, "the stick's thumb, slid over the two new buttons, casts nothing", !s.heard && same(before, l) && bar(l) >= bar(before), { heard: heard(s), soil: soils(l) - soils(before), planted: planted(l) - planted(before), seeds: seeds(l) }, "no sound, nothing changed");

    // ---- Low mana. Back at the start tile, with bare grass all around. ----
    await V.walkToTile(4, 2, 5); l = await V.look("back-at-the-start");
    const grass = reach(l, bareGrass), soil = reach(l, bareSoil); let left = Number(seeds(l)), m = { v: mana(l), at: l.at };
    // From one reading of the bar, the mana is reckoned by the clock: 6.5 a second up, a spell's cost down.
    const est = () => Math.min(100, m.v + (BACK * (Date.now() - m.at)) / 1000), until = async (v) => { const ms = ((v - est()) / BACK) * 1000; if (ms > 0) await V.wait(ms); };
    const sync = async (label) => { const k = await V.look(label); const reckoned = Math.min(100, m.v + (BACK * (k.at - m.at)) / 1000); m = { v: mana(k), at: k.at }; k.reckoned = reckoned; return k; };
    const quick = async (b, xy) => { await V.tapTile(xy[0], xy[1], 30); await V.wait(40); await V.tapButton(b, 30); m = { v: est() - b.cost, at: Date.now() }; await V.wait(40); };
    const sowed = [];
    // Brings the mana under a mark with a spell that works: Break Ground on a tile of bare grass, as soon as
    // there are 14 mana for it. (With the grass used up, Sprout on bare soil, as soon as there are 10.)
    const bringUnder = async (v) => { for (let i = 0; i < 8 && est() > v; i++) {
        if (grass.length > 1) { await until(14.3); const xy = grass.shift(); await quick(BREAK, xy); soil.push(xy); }
        else if (soil.length > 1 && left > 1) { await until(10.3); const xy = soil.shift(); await quick(SPROUT, xy); sowed.push(xy); left--; } else break; } };
    check(V, "back at the start there is bare grass in reach to work with", grass.length >= 9 && soil.length >= 1 && left === 4, { grass: grass.length, soil: soil.length, seeds: left }, "9 or more tiles of bare grass, the soil at 2,2, 4 seeds");
    await until(99); l = await sync(); const dug = [];
    while (grass.length > 5 && est() >= 14.5) { const xy = grass.shift(); await quick(BREAK, xy); dug.push(xy); soil.push(xy); }
    l = await sync("mana-run-down");
    check(V, dug.length + " Break Grounds, one after another, each turn their tile to soil", dug.length >= 5 && dug.every((xy) => isTile(l, xy, "soil", null)), { casts: dug.length, notSoil: dug.filter((xy) => !isTile(l, xy, "soil", null)) }, "all soil");
    check(V, "and the bar shows what 14 a cast and 6.5 a second make of it", Math.abs(mana(l) - l.reckoned) <= 3, { mana: mana(l), pixels: bar(l) }, "about " + round(l.reckoned));

    // Under 14 mana: Break Ground's button is dim while the other two are lit, and a cast does nothing at all.
    // The cast comes at about 10.8 mana, reckoned by the clock, and screenshots follow it one after another
    // with no time lost on reading them. They are read afterwards, and the bar in each says how much mana
    // there was when it was taken.
    const refused = async (b, castAt, lo, hi, label) => { let res = null;
      for (let tries = 0; tries < 4 && !res; tries++) {
        await bringUnder(castAt - 1.2); const xy = b === BREAK ? grass[0] : soil[0]; if (!xy) break;
        await V.tapTile(xy[0], xy[1], 30); await until(castAt); const tB = await V.sound.now(), cAt = Date.now(); await V.tapButton(b, 30);
        const snaps = []; for (let i = 0; i < 7; i++) { await V.wait(25); snaps.push(await V.snap(i === 0 ? label : null)); }
        await V.wait(Math.max(0, 340 - (Date.now() - cAt)));
        const log = await V.sound.readings(tB - 80), peak = (from, to) => log.filter((e) => e[0] >= from && e[0] < to).reduce((mx, e) => Math.max(mx, e[1]), 0), tail = peak(tB - 80, tB), after = peak(tB + 20, tB + 330);
        // Reading stops at the first screenshot past the window: mana comes back while the referee reads.
        const looks = []; for (const sn of snaps) { const k = await V.read(sn); looks.push(k); if (mana(k) > hi) break; } const first = looks[0], last = looks[looks.length - 1], inWindow = looks.find((k) => mana(k) >= lo && mana(k) <= hi); m = { v: mana(last), at: last.at };
        if (process.env.CHECK_NOTES) console.log("  note:", b.name, "refused try", tries, "at", xy.join(","), "bar in the screenshots", looks.map((k) => mana(k)).join(" "), "buttons", looks.map((k) => lit(k)).join(" | "));
        // The try counts only if the cast surely came with too little mana, and a screenshot fell in the window.
        if (mana(first) > b.cost - 0.6 || !inWindow) { if (b === BREAK && !bareGrass(tile(last, xy))) grass.shift(); if (b === SPROUT && !bareSoil(tile(last, xy))) { soil.shift(); left = Number(seeds(last)); } continue; }
        res = { xy, buttons: lit(inWindow), manaThen: mana(inWindow), unchanged: (b === BREAK ? bareGrass : bareSoil)(tile(last, xy)) && seeds(last) === String(left), rising: mana(last) >= mana(first), tile: tile(last, xy), seeds: seeds(last), tail: round(tail), loudestAfter: round(after), newSound: after > Math.max(0.03, tail * 1.5 + 0.02) }; }
      if (!res) console.log("  note: the referee could not get a " + b.name + " cast in at the right moment. That is the referee's timing, not the build. Run this view again on a quiet machine.");
      return res; };
    let low = await refused(BREAK, 10.8, 10.6, 13.4, "break-ground-dim");
    check(V, "with less than 14 mana, the Break Ground button shows its dim picture and the other two stay lit", low && low.buttons === "off on on", low && { buttons: low.buttons, mana: low.manaThen }, "spell_break_ground_off, spell_sprout, spell_gust");
    check(V, "a Break Ground cast with less than 14 mana changes nothing", low && low.unchanged && low.rising, low && { tile: low.tile, manaStillRising: low.rising }, "the grass as it was, no mana taken");
    check(V, "and makes no sound", low && !low.newSound, low && { loudestJustBefore: low.tail, loudestAfter: low.loudestAfter }, "no new sound");
    // Under 10: Sprout's button is dim too, Gust's is still lit. Under 8, all three are dim.
    await bringUnder(6.5); const sn = await V.snap("all-dim"), dim = await V.read(sn);
    check(V, "with less than 8 mana, all three buttons are dim", mana(dim) < 7.5 && lit(dim) === "off off off", { buttons: lit(dim), mana: mana(dim) }, "all three dim");
    low = await refused(SPROUT, 7, 8.5, 9.6, "sprout-dim");
    check(V, "with 8 or 9 mana, the Sprout button shows its dim picture, Break Ground's too, and Gust's is lit", low && low.buttons === "off off on", low && { buttons: low.buttons, mana: low.manaThen }, "spell_break_ground_off, spell_sprout_off, spell_gust");
    check(V, "a Sprout cast with less than 10 mana changes nothing", low && low.unchanged && low.rising, low && { tile: low.tile, seeds: low.seeds, manaStillRising: low.rising }, "the soil bare, the seeds as they were, no mana taken");
    check(V, "and makes no sound", low && !low.newSound, low && { loudestJustBefore: low.tail, loudestAfter: low.loudestAfter }, "no new sound");
    await until(16.5); l = await sync(); for (let i = 0; i < 40 && mana(l) < 15.5; i++) l = await sync(); l = await sync("buttons-lit-again");
    check(V, "when the mana is back, all three buttons are lit again", mana(l) >= 15 && lit(l) === "on on on", { mana: mana(l), buttons: lit(l) }, "all three lit");

    // The last seeds. Then, with none left, Sprout changes nothing, and the count shows the digit 0.
    check(V, "the count has followed every seed so far", seeds(l) === String(left) && sowed.every((xy) => isTile(l, xy, "soil", "crop_seed")), { count: seeds(l), wanted: left, notSeeded: sowed.filter((xy) => !isTile(l, xy, "soil", "crop_seed")) }, left + " seeds");
    while (left > 0 && soil.length > 1) { await until(10.8); const xy = soil.shift(); await quick(SPROUT, xy); sowed.push(xy); left--; }
    await V.settle(); l = await sync("no-seeds-left");
    check(V, "every seed planted is on its tile", left === 0 && sowed.every((xy) => isTile(l, xy, "soil", "crop_seed")) && planted(l) === SEEDS, { planted: planted(l), notSeeded: sowed.filter((xy) => !isTile(l, xy, "soil", "crop_seed")) }, "8 seeds on the lot");
    check(V, "with none left, the count is the one digit 0", seeds(l) === "0", l.counts.seeds, "0");
    await until(13); g = await cast(V, SPROUT, soil[0], "sprout-with-no-seeds");
    check(V, "Sprout with no seeds left changes nothing and plays the no sound", soil[0] && bareSoil(tile(g.aim, soil[0])) && mana(g.aim) >= 10.5 && nothing(V, g) && seeds(g.l) === "0", got(g), "bare soil still, 0 seeds, no mana paid, no.wav");
    check(V, "and the Sprout button stays lit: only mana dims it", g.l.buttons.sprout.shows === "on" && mana(g.l) >= 10.5, { button: g.l.buttons.sprout.shows, mana: mana(g.l) }, "spell_sprout");
    l = await V.look("the-end", true);
    check(V, "the picture still matches the shared art, with the soil, the seeds and the count on it", l.pictureWrongPct <= 1, l.pictureWrongPct + "% of pixels wrong", "1% or less");
    await end(V);
  }

  // ---------------- The other sizes: the picture, and one tile taken from grass to a seed ----------------
  async function size(V, pct) {
    const l = await begin(V); startState(V, l, pct);
    let g = await cast(V, BREAK, [4, 4], "break-ground");
    check(V, "a touch on a tile aims there, and a touch on Break Ground turns it to soil", aimedAt(g.aim) === "4,4" && isTile(g.l, [4, 4], "soil", null) && paidFor(V, g), got(g), "soil at 4,4, 14 mana paid");
    g = await cast(V, SPROUT, null, "sprout");
    check(V, "a touch on Sprout plants a seed, and the count says 7", isTile(g.l, [4, 4], "soil", "crop_seed") && seeds(g.l) === "7" && g.s.heard, got(g), "a seed at 4,4, 7 seeds, a sound");
    check(V, "the picture still matches the shared art", g.l.pictureWrongPct <= pct, g.l.pictureWrongPct + "% of pixels wrong", pct + "% or less");
    await end(V);
  }

  // ---------------- PC size: the 2 and 3 keys and the mouse ----------------
  async function pc(V) {
    const l = await begin(V); startState(V, l, 3);
    let g = await cast(V, BREAK, null, "key-2", () => V.page.keyboard.press("2")); g.xy = [4, 3];
    check(V, "the 2 key casts Break Ground on the aimed tile", worked(V, g, "soil", null), got(g), "soil at 4,3, 14 mana paid, break_ground.wav");
    g = await cast(V, SPROUT, null, "key-3", () => V.page.keyboard.press("3")); g.xy = [4, 3];
    check(V, "the 3 key casts Sprout", worked(V, g, "soil", "crop_seed"), got(g), "a seed at 4,3, 7 seeds, 10 mana paid, sprout.wav");
    g = await cast(V, BREAK, [4, 4], "mouse-break-ground");
    check(V, "a mouse press on the Break Ground button casts it", aimedAt(g.aim) === "4,4" && worked(V, g, "soil", null), got(g), "soil at 4,4, break_ground.wav");
    g = await cast(V, SPROUT, null, "mouse-sprout");
    check(V, "a mouse press on the Sprout button casts it", worked(V, g, "soil", "crop_seed") && isTile(g.l, [4, 4], "soil", "crop_seed"), got(g), "a seed at 4,4, 6 seeds, sprout.wav");
    g = await cast(V, GUST, [2, 4], "key-1", () => V.page.keyboard.press("1"));
    check(V, "the 1 key still casts Gust", isTile(g.l, [2, 4], "grass", null) && g.s.name === "gust", got(g), "the rubble gone, gust.wav");
    await end(V);
  }

  // ---------------- A short film of the step, for the series ----------------
  async function film(V) {
    await begin(V, true); await V.wait(700);
    await V.tapButton(BREAK); await V.wait(900); await V.tapButton(SPROUT); await V.wait(1100);
    await V.tapTile(2, 4); await V.wait(500); await V.tapButton(GUST); await V.wait(800); await V.tapButton(BREAK); await V.wait(800); await V.tapButton(SPROUT); await V.wait(1100);
    for (const [tx, ty] of [[3, 3], [5, 3], [3, 4], [5, 4]]) { await V.tapTile(tx, ty); await V.wait(350); await V.tapButton(BREAK); await V.wait(700); await V.tapButton(SPROUT); await V.wait(1300); }
    await V.tapButton(GUST); await V.wait(800);
    await V.push(0, 1, 1300); await V.wait(300); await V.push(-1, 0, 500); await V.wait(300); await V.push(0, -1, 900); await V.wait(1500);
    await V.close();
  }

  const views = [
    ["play", { name: "play", width: 288, height: 576, dpr: 1, touch: true }, (V) => play(V)],
    ["phone-sharp", { name: "phone-sharp", width: 390, height: 844, dpr: 3, touch: true }, (V) => size(V, 1)],
    ["phone", { name: "phone", width: 390, height: 844, dpr: 1, touch: true }, (V) => size(V, 1)],
    ["small-phone", { name: "small-phone", width: 360, height: 640, dpr: 1, touch: true }, (V) => size(V, 3)],
    ["phone-sideways", { name: "phone-sideways", width: 640, height: 360, dpr: 2, touch: true }, (V) => size(V, 3)],
    ["pc", { name: "pc", width: 1280, height: 720, dpr: 1, touch: false }, (V) => pc(V)],
    ["film", { name: "film", width: 576, height: 1152, dpr: 1, touch: true, film: "step-04.webm" }, (V) => film(V)],
  ];
  for (const [name, v, run] of views) { if (only && only !== name) continue; console.log("\n" + name + " (" + v.width + "x" + v.height + " @" + v.dpr + ")"); const V = await open(v); try { await run(V); } catch (e) { check(V, "the check ran to its end", false, String(e && e.stack ? e.stack : e).slice(0, 600), "no trouble in the check itself"); try { await V.close(); } catch (e2) { /* already closed */ } } }
  const report = await finish();
  process.exit(report.missed ? 1 : 0);
})();
