// The referee's check for step 3, "The first spell", the same for both builds. It serves a build's web folder
// the way a plain web host would, opens it in headless Chromium, and plays it with real touch events (and, at
// PC size, the mouse and the keys). Everything it judges it reads from screenshots: where the mage is, what
// is on each tile, where the aim mark is, how full the mana bar is, which picture the Gust button shows. Sound
// it reads from what the page sends to the speakers.
//
//   node tools/check-step-03.cjs <web folder> <folder for screenshots> [one view's name]
//
// It changes nothing in a build and looks at nothing but the page. It needs Node and Playwright with Chromium.
//
// The test browser draws with software and is slow at a phone's real sharpness, so the playing is checked in
// a view where one picture pixel is one screen pixel, and the other views check that the picture, a touch on
// a tile and a touch on the button land in the right places at each size. Whether a person can hear the
// sound on a phone, only a phone can say.
const path = require("path");
const { K, referee, layoutFor } = require("./referee.cjs");

const web = path.resolve(process.argv[2] || "web"), out = path.resolve(process.argv[3] || "check-out"), only = process.argv[4] || "";
const GUST = { name: "gust", x: 156, y: 444, on: "spell_gust", off: "spell_gust_off" };
const COST = 8, BACK = 6.5, BAR = 118, BX = GUST.x + 28, BY = GUST.y + 28;
const pixels = (mana) => Math.round((BAR * mana) / 100);

(async () => {
  // A later step's build can be put through this check too, to see that step 3 still stands: BUILD_STEP says
  // which step the build is at, so the check knows what else is on the screen.
  const ref = await referee(web, out, 3, layoutFor(Number(process.env.BUILD_STEP || 3)));
  const { open, check, finish, lot, round, at, near, knobAt, thing, aimedAt, lotThing } = ref;
  const bar = (l) => (l.mana ? l.mana.filledPixels : null), mana = (l) => (l.mana ? l.mana.mana : null), shows = (l) => l.buttons.gust.shows;
  const mid = (tx, ty) => [tx * K.T + 16, K.TOP + ty * K.T + 16];
  // The tile in front of the mage, as "x,y", or "none" when that is off the lot. The mage's tile is the one
  // under its middle, and a screenshot places the middle to the nearest pixel. So when the middle is within a
  // pixel and a half of a tile's edge, the tile on either side may be the build's own answer.
  const fronts = (l) => { if (!l.mage) return []; const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[l.mage.facing], set = new Set();
    for (const ex of [-1.5, 0, 1.5]) for (const ey of [-1.5, 0, 1.5]) { const x = Math.floor((l.mage.x + ex) / K.T) + d[0], y = Math.floor((l.mage.y + ey) / K.T) + d[1]; set.add(x < 0 || x > 8 || y < 0 || y > 11 ? "none" : x + "," + y); } return [...set]; };
  const front = (l) => fronts(l).join(" or "), inFront = (l) => fronts(l).includes(aimedAt(l));
  const hear = async (V, act, ms = 800) => { const t = await V.sound.now(); await act(); await V.wait(ms); return V.sound.since(t); };
  // Which of the two sounds one was, going by the build's own two: the one heard when Gust cleared a tile and
  // the one heard when a cast changed nothing.
  const kind = (V, s) => (!s.heard ? "none" : !V.gust || !V.no ? "a sound" : Math.abs(s.seconds - V.gust.seconds) < Math.abs(s.seconds - V.no.seconds) ? "the Gust sound" : "the no sound");
  // How much mana the bar should show after some casts and some time, give or take what one frame and one pixel hide.
  const give = (V) => 2 + (BACK * 1.5) / Math.max(1, V.fps || 30);
  // At full mana the reckoning has two ends: what came back before the cast is lost to the cap, what comes
  // back after it is not, and the cast fell somewhere between the touch and the look. "hi" is the upper end.
  const aboutMana = (V, l, want, hi = want) => mana(l) !== null && mana(l) >= want - give(V) && mana(l) <= hi + give(V);
  const things = (l) => l.tiles.flat().filter((t) => t.thing === "rubble" || t.thing === "weeds").length;
  // From step 5 on, weeds come back every 45 seconds, far from the mage. So in a later step's build, one more
  // tile of weeds between two looks is not a cast's doing.
  const WEEDY = Number(process.env.BUILD_STEP || 3) >= 5, noneCleared = (before, after) => after === before || (WEEDY && after === before + 1);

  // The cover, the silence before the tap, the tap, and the first look.
  async function begin(V, quiet) {
    if (!quiet) check(V, "the cover shows first", V.coverSeen, V.secondsToCover + " s", "the cover with its words");
    const t = await V.sound.now(); await V.wait(800); const before = await V.sound.since(t);
    if (!quiet) check(V, "no sound before the tap that takes the cover away", !before.heard, before, "silence");
    await V.tap(220, 24, 250); await V.wait(900); await V.pace();
    return V.look("start", true);
  }
  function startState(V, l, pct) {
    check(V, "the mage starts below the door, facing down", near(l, K.START.x, K.START.y, 1) && l.mage.facing === "down", at(l), "144, 80, facing down");
    const wrong = []; for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 9; tx++) { const t = l.tiles[ty][tx]; if (t.thing !== lotThing(tx, ty) || t.ground !== lot.ground_legend[lot.ground[ty][tx]]) wrong.push(tx + "," + ty); }
    check(V, "every tile shows the ground and the thing the shared lot says", wrong.length === 0, wrong, "all 108 tiles right");
    check(V, "the aim mark is on the tile in front of the mage, and nowhere else", aimedAt(l) === "4,3", aimedAt(l), "4,3");
    check(V, "the mana bar is full, with its border", l.mana && bar(l) >= (pct <= 1 && V.v.dpr === 1 && V.v.width === 288 ? BAR : BAR - 1) && l.mana.borderRightPct >= 95 && l.mana.wrongPixelsInside <= 10, l.mana, "118 pixels of 118, the border #fff4d8");
    check(V, "the Gust button shows, lit", shows(l) === "on", l.buttons.gust, "spell_gust at 156, 444");
    check(V, "the stick is there with its knob at rest", knobAt(l, 0, 0, 1), l.knob, "the knob in the middle");
    check(V, "the picture matches the shared art", l.pictureWrongPct <= pct, l.pictureWrongPct + "% of pixels wrong", pct + "% or less");
    check(V, "the bars outside the picture are the dark color", l.barsRightColorPct === null || l.barsRightColorPct >= 99, l.barsRightColorPct, "99% or more");
  }
  async function end(V) {
    const page = await V.page.evaluate(() => ({ x: window.scrollX, y: window.scrollY, zoom: window.visualViewport ? window.visualViewport.scale : 1, picked: String(window.getSelection ? window.getSelection() : "").length }));
    check(V, "the page did not scroll, zoom or select anything", page.x === 0 && page.y === 0 && page.zoom === 1 && page.picked === 0, page, "still");
    check(V, "no errors on the page", V.errs.length === 0, V.errs.slice(0, 3), "none");
    await V.close();
  }
  // Aim at a tile by touch and cast Gust at it, once. Gives the look taken right after, and the sound.
  async function gustAt(V, tx, ty, label) {
    await V.tapTile(tx, ty); await V.settle(); const aim = await V.look(label ? "aim-" + label : null);
    const t = await V.sound.now(), m0 = mana(aim), t0 = aim.at, tp = Date.now(); await V.tapButton(GUST); await V.wait(Math.max(120, 1500 / Math.max(1, V.fps || 30)));
    const l = await V.look(label ? "gust-" + label : null); await V.wait(750); const s = await V.sound.since(t);
    return { aim, l, s, want: Math.min(100, m0 + (BACK * (l.at - t0)) / 1000) - COST, wantHi: Math.min(100, m0 + (BACK * (tp - t0)) / 1000) - COST + (BACK * (l.at - tp)) / 1000, wantNoCast: Math.min(100, m0 + (BACK * (l.at - t0)) / 1000) };
  }

  // ---------------- The playing view: one picture pixel to one screen pixel ----------------
  async function play(V) {
    let l = await begin(V), s, g; startState(V, l, 1);

    // A cast with nothing to clear. The tile in front, 4,3, is bare grass.
    s = await hear(V, () => V.tapButton(GUST)); l = await V.look("cast-on-nothing"); V.no = s;
    check(V, "a cast at a tile with nothing to clear makes a sound", s.heard, s, "no.wav");
    check(V, "and costs no mana", bar(l) === BAR, bar(l), "118 pixels still");

    // Aiming by touch, at the far corner of the reach, and Gust on rubble.
    g = await gustAt(V, 2, 4, "rubble"); V.gust = g.s;
    check(V, "a touch on a tile 2 across and 2 down moves the aim mark there at once", aimedAt(g.aim) === "2,4", aimedAt(g.aim), "2,4");
    check(V, "the mage does not move or turn for it", near(g.aim, 144, 80, 1) && g.aim.mage.facing === "down", at(g.aim), "144, 80, facing down");
    check(V, "Gust on rubble: the rubble is gone and the ground under it shows", thing(g.l, 2, 4) === null && g.l.tiles[4][2].ground === "grass", g.l.tiles[4][2], "grass with nothing on it");
    check(V, "the mana drops by 8, and the bar shows it", aboutMana(V, g.l, g.want, g.wantHi), { mana: mana(g.l), pixels: bar(g.l) }, "about " + round(g.want) + " (" + pixels(g.want) + " pixels)");
    check(V, "Gust makes its sound", g.s.heard, g.s, "gust.wav");
    check(V, "the two sounds differ: Gust's is the longer and the louder", g.s.seconds > V.no.seconds + 0.08 && g.s.loudest > V.no.loudest * 1.2, { gust: g.s, no: V.no }, "gust.wav runs 0.45 s, no.wav 0.22 s and quieter");
    check(V, "the aim mark stays on the touched tile after the cast", aimedAt(g.l) === "2,4", aimedAt(g.l), "2,4");
    check(V, "the Gust button stays lit with mana to spare", shows(g.l) === "on", shows(g.l), "on");

    // A second cast on the tile just cleared.
    let before = await V.look(); s = await hear(V, () => V.tapButton(GUST)); l = await V.look("cast-on-cleared");
    check(V, "a second cast on the cleared tile costs nothing", bar(l) >= bar(before), { before: bar(before), after: bar(l) }, "no drop");
    check(V, "and plays the no sound", kind(V, s) === "the no sound", { heard: kind(V, s), sound: s }, "no.wav");

    // The mana comes back, and stops at 100.
    await V.wait(2500); l = await V.look("mana-back");
    check(V, "the mana comes back to full by itself", bar(l) === BAR, bar(l), "118 pixels");
    l = await V.look(); await V.tapTile(7, 2); await V.settle(); l = await V.look("far-touch-across");
    check(V, "a touch on a tile 3 across does nothing", aimedAt(l) === "2,4", aimedAt(l), "the mark still on 2,4");
    await V.tapTile(4, 5); await V.settle(); l = await V.look("far-touch-down");
    check(V, "a touch on a tile 3 down does nothing", aimedAt(l) === "2,4", aimedAt(l), "the mark still on 2,4");
    await V.wait(1500);
    g = await gustAt(V, 6, 4, "weeds");
    check(V, "Gust on weeds: the weeds are gone", aimedAt(g.aim) === "6,4" && thing(g.l, 6, 4) === null, { aimed: aimedAt(g.aim), tile: g.l.tiles[4][6] }, "aimed at 6,4, then nothing on it");
    check(V, "100 is as high as mana goes: after a rest at full, one cast leaves 92", aboutMana(V, g.l, g.want, g.wantHi), { mana: mana(g.l), pixels: bar(g.l) }, "about " + round(g.want));
    check(V, "weeds make the Gust sound too", kind(V, g.s) === "the Gust sound", { heard: kind(V, g.s), sound: g.s }, "gust.wav");

    // The mage's own tile, the house and the crate.
    await V.tapTile(4, 2); await V.settle(); l = await V.look("aim-own-tile");
    check(V, "the mage's own tile can be aimed at", aimedAt(l) === "4,2", aimedAt(l), "4,2");
    check(V, "the mark is drawn under the mage, not over it", l.mage && l.mage.wrongPixels <= 8, l.mage && l.mage.wrongPixels, "the mage's own pixels all showing");
    for (const [tx, ty, what, ground, th] of [[4, 1, "the house", "house_s", null], [6, 1, "the crate", "grass", "crate"]]) {
      await V.tapTile(tx, ty); await V.settle(); before = await V.look("aim-" + what.replace(/ /g, "-"));
      s = await hear(V, () => V.tapButton(GUST)); l = await V.look();
      check(V, "a cast at " + what + ": the mark goes there, nothing changes, it costs nothing, and the no sound plays", aimedAt(before) === tx + "," + ty && l.tiles[ty][tx].ground === ground && thing(l, tx, ty) === th && bar(l) >= bar(before) && kind(V, s) === "the no sound",
        { aimed: aimedAt(before), tile: l.tiles[ty][tx], before: bar(before), after: bar(l), heard: kind(V, s) }, "aimed, unchanged, no drop, no.wav");
    }

    // Turning, and leaving the tile, put the aim back in front.
    await V.push(-1, 0, 60); l = await V.look("turned-left");
    check(V, "when the mage turns, the aim goes back to the tile in front", l.mage && l.mage.facing === "left" && inFront(l), { mage: at(l), aimed: aimedAt(l), front: front(l) }, "facing left, the mark in front");
    const from = l.mage ? l.mage.tileX : 4; await V.tapTile(from + 1, 3); await V.settle(); before = await V.look("aim-before-walking-off");
    await V.push(-1, 0, 500); l = await V.look("walked-off-the-tile");
    check(V, "when the mage's tile changes, the aim goes back to the tile in front", aimedAt(before) === from + 1 + ",3" && l.mage && l.mage.tileX < from && l.mage.facing === "left" && inFront(l), { before: aimedAt(before), mage: at(l), aimed: aimedAt(l), front: front(l) }, "the mark in front again");
    const ways = []; for (const [dx, dy, name] of [[0, -1, "up"], [1, 0, "right"], [0, 1, "down"], [-1, 0, "left"]]) { await V.push(dx, dy, 60); l = await V.look("facing-" + name); ways.push({ way: name, facing: l.mage && l.mage.facing, aimed: aimedAt(l), front: front(l), ok: inFront(l) && aimedAt(l) !== "none" }); }
    check(V, "the aim mark sits on the next tile the way the mage faces, all four ways", ways.every((w) => w.facing === w.way && w.ok), ways, "the mark in front each time");

    // Facing off the lot.
    await V.push(-1, 0, 1500); before = await V.look("at-the-left-edge");
    check(V, "facing off the lot, no tile is aimed and the mark does not show", before.mage && before.mage.x <= 17 && before.mage.facing === "left" && aimedAt(before) === "none", { mage: at(before), aimed: aimedAt(before) }, "at the edge, facing left, no mark");
    const had = things(before); s = await hear(V, () => V.tapButton(GUST)); l = await V.look();
    check(V, "a cast with no aimed tile costs nothing, clears nothing, and plays the no sound", bar(l) >= bar(before) && noneCleared(had, things(l)) && kind(V, s) === "the no sound", { before: bar(before), after: bar(l), cleared: had - things(l), heard: kind(V, s) }, "no drop, nothing cleared, no.wav");

    // Two thumbs. The first holds the stick, pushing the mage into the lot's edge so it stays put.
    const row = before.mage ? before.mage.tileY : 2;
    await V.finger.down(1, K.STICK.x, K.STICK.y); await V.finger.slide(1, K.STICK.x - 45, K.STICK.y); await V.wait(350); l = await V.look("thumb-on-the-stick");
    check(V, "a thumb holds the stick: the knob is out and the mage is against the edge", knobAt(l, -28, 0) && l.mage && l.mage.x <= 17, { knob: l.knob, mage: at(l) }, "the knob 28 left, the mage at the edge");
    await V.finger.down(2, ...mid(1, row + 1)); await V.wait(70); await V.finger.lift(2); await V.settle(); l = await V.look("second-thumb-aims");
    check(V, "with the thumb on the stick, a second touch aims", aimedAt(l) === "1," + (row + 1) && knobAt(l, -28, 0), { aimed: aimedAt(l), knob: l.knob }, "the mark on 1," + (row + 1) + ", the knob still out");
    const was = thing(l, 1, row + 1); s = await hear(V, async () => { await V.finger.down(3, BX, BY); await V.wait(70); await V.finger.lift(3); }); l = await V.look("second-thumb-casts");
    check(V, "and a touch on the button casts, the stick still held", was !== null && thing(l, 1, row + 1) === null && knobAt(l, -28, 0) && kind(V, s) === "the Gust sound", { was, now: thing(l, 1, row + 1), knob: l.knob, heard: kind(V, s) }, "the " + was + " gone, the knob still out, gust.wav");
    // The stick's own touch slides onto a tile within reach, then over the button. It walks the mage up into
    // the corner first, so the mage stays put while the thumb is over the tile.
    await V.finger.slide(1, K.STICK.x, K.STICK.y - 45); await V.wait(1400); await V.finger.slide(1, ...mid(1, 1)); await V.wait(500); l = await V.look("stick-thumb-over-a-tile");
    check(V, "the stick's thumb, slid onto a tile within reach, does not aim", l.mage && near(l, 16, 16, 1) && aimedAt(l) === "none", { mage: at(l), aimed: aimedAt(l) }, "the mage in the corner, no mark on 1,1");
    before = l; let t = await V.sound.now(); await V.finger.slide(1, BX, BY); await V.wait(500); l = await V.look("stick-thumb-over-the-button"); s = await V.sound.since(t);
    check(V, "slid over the Gust button, it does not cast", !s.heard && bar(l) >= bar(before) && noneCleared(things(before), things(l)), { heard: kind(V, s), before: bar(before), after: bar(l), cleared: things(before) - things(l) }, "no sound, no drop, nothing cleared");
    await V.finger.lift(1); await V.settle(); const rest = await V.look();
    // Touches that start on the button or on the lot never work the stick.
    await V.finger.down(4, BX, BY); await V.finger.slide(4, K.STICK.x - 30, K.STICK.y); await V.wait(500); l = await V.look("button-touch-slid-to-the-stick"); await V.finger.lift(4);
    check(V, "a touch that starts on the button and slides onto the stick does not work it", knobAt(l, 0, 0, 1) && rest.mage && near(l, rest.mage.x, rest.mage.y, 1), { knob: l.knob, mage: at(l), was: at(rest) }, "the knob at rest, the mage still");
    await V.finger.down(4, ...mid(4, 8)); await V.finger.slide(4, K.STICK.x + 30, K.STICK.y); await V.wait(500); l = await V.look("tile-touch-slid-to-the-stick"); await V.finger.lift(4);
    check(V, "a touch that starts on the lot and slides onto the stick does not work it", knobAt(l, 0, 0, 1) && rest.mage && near(l, rest.mage.x, rest.mage.y, 1), { knob: l.knob, mage: at(l), was: at(rest) }, "the knob at rest, the mage still");
    // The stick works while a finger rests on the button, and holding the button casts only once.
    await V.wait(600); t = await V.sound.now(); await V.finger.down(4, BX, BY); await V.wait(150);
    await V.finger.down(1, K.STICK.x, K.STICK.y); await V.finger.slide(1, K.STICK.x, K.STICK.y + 45); await V.wait(700); await V.finger.lift(1); await V.settle(); l = await V.look("walking-with-a-finger-on-the-button");
    check(V, "with a finger resting on the button, the stick still walks the mage", rest.mage && l.mage && l.mage.y - rest.mage.y > 35, { was: at(rest), now: at(l) }, "the mage well below where it was");
    await V.wait(700); await V.finger.lift(4); await V.wait(300); s = await V.sound.since(t);
    check(V, "holding the button down casts once, not again and again", s.heard && s.seconds < Math.max(V.gust.seconds, V.no.seconds) + 0.15, s, "one sound");

    // Walking and casting together: the mage walks up the right edge from tile 8,4 while the other thumb
    // casts twice. The four tiles above it, 8,3 up to 8,0, all hold rubble or weeds, so each cast has
    // something in front of it whichever tile the mage has reached.
    await V.walkTo(266, 144, 5); await V.push(1, 0, 400); before = await V.look("before-the-walk");
    await V.wait(Math.max(0, ((100 - mana(before)) / BACK) * 1000 + 300));
    await V.finger.down(1, K.STICK.x, K.STICK.y); await V.finger.slide(1, K.STICK.x, K.STICK.y - 45); const w0 = Date.now();
    await V.wait(Math.max(0, 250 - (Date.now() - w0))); await V.finger.down(5, BX, BY); await V.wait(40); await V.finger.lift(5);
    await V.wait(Math.max(0, 750 - (Date.now() - w0))); await V.finger.down(5, BX, BY); await V.wait(40); await V.finger.lift(5);
    await V.wait(Math.max(0, 1100 - (Date.now() - w0))); await V.finger.lift(1); const walked = (Date.now() - w0) / 1000; await V.settle(); l = await V.look("walked-and-cast");
    const stood = [0, 1, 2, 3].filter((ty) => thing(before, 8, ty) !== null), gone = stood.filter((ty) => thing(l, 8, ty) === null);
    check(V, "walking and casting at once: the mage keeps walking", before.mage && l.mage && before.mage.y - l.mage.y >= Math.min(120, K.SPEED * walked * 0.8), { was: at(before), now: at(l), seconds: round(walked) }, "about " + Math.round(Math.min(128, K.SPEED * walked)) + " pixels up");
    check(V, "and each of the two casts clears the tile then in front of it", before.mage && before.mage.tileX === 8 && before.mage.tileY === 4 && stood.length === 4 && gone.length === 2, { startedOn: before.mage && before.mage.tileX + "," + before.mage.tileY, cleared: gone.map((ty) => "8," + ty) }, "two of the four tiles above it cleared");

    // Running the mana down. From tile 3,8 there are 19 tiles of rubble and weeds within reach.
    l = await V.walkTo(112, 272, 6); await V.wait(Math.max(0, ((100 - mana(l)) / BACK) * 1000 + 400)); l = await V.look("before-the-run-down");
    const targets = []; if (l.mage) for (let ty = l.mage.tileY - 2; ty <= l.mage.tileY + 2; ty++) for (let tx = l.mage.tileX - 2; tx <= l.mage.tileX + 2; tx++) if (tx >= 0 && tx < 9 && ty >= 0 && ty < 12 && l.tiles[ty][tx].thing && l.tiles[ty][tx].thing !== "crate") targets.push([tx, ty]);
    // One cast with two thumbs, one on the tile and then one on the button, and the next 260 milliseconds
    // after it started: the same pace on a page that draws fast and one that draws slowly.
    const acks = [], quick = async ([tx, ty]) => { const t0 = Date.now(), r = await V.twoThumbs(tx * K.T + 16, K.TOP + ty * K.T + 16, GUST.x + 28, GUST.y + 28); acks.push(r.acks); await new Promise((ok) => setTimeout(ok, Math.max(0, 260 - (Date.now() - t0)))); return r.second; };
    // From the first cast on, the mana is reckoned by the clock alone: full at the start, 8 down for each
    // cast, 6.5 a second up. No screenshot is read while the casting goes on, so a slow machine does not get
    // in the way. Two tiles are kept back for what comes next.
    const used = []; let n = 0, base = null, lastCast = 0, d0 = 0; const owed = () => (base ? Math.min(100, base.v + (BACK * (Date.now() - base.at)) / 1000) : 100);
    const spent = (tapped, xy) => { if (!d0) d0 = tapped; base = { v: (base ? owed() : 100) - COST, at: base ? Date.now() : tapped }; lastCast = tapped; n++; used.push(xy); };
    while (targets.length > 2 && owed() >= 10.5) { const xy = targets.shift(); spent(await quick(xy), xy); }
    await Promise.all(acks);
    // Under 8 mana: the button shows its dim picture, and a cast does nothing and makes no sound. If the mana
    // is still 8 or more, one more cast at about 8.8 leaves almost nothing. Then, with no time lost on
    // reading: a screenshot of the dim button, a short wait for most of Gust's sound to pass, and a cast at
    // the next tile. The screenshots are read afterwards. A sound would show as the loudness rising again
    // after the button is touched. (Gust's own tail may still be fading.)
    // The try counts only if the first screenshot, and the time from it to the cast, show that the mana was
    // surely under 8 at the cast. If not, it is the referee's timing that was off: the mana is read again
    // from the last screenshot and the next tiles are tried.
    let low = null, first = null;
    for (let tries = 0; tries < 4 && targets.length >= 1 && !low; tries++) {
      // The cast under 8 comes about 0.6 seconds from now. If the mana would be too near 8 by then, one cast first.
      if (owed() + BACK * 0.6 >= 7) { if (targets.length < 2) break; const X = targets.shift(); await V.tapTile(X[0], X[1], 30); await V.wait(Math.max(0, ((8.8 - owed()) / BACK) * 1000 - 40)); const tapped = Date.now(); await V.tapButton(GUST, 30); spent(tapped, X); }
      const nNow = n, usedNow = [...used];
      await V.wait(Math.max(50, 2500 / Math.max(1, V.fps || 30))); const sA = await V.snap("button-dim"); await V.wait(Math.max(0, 380 - (Date.now() - lastCast)));
      const Y = targets[0]; await V.tapTile(Y[0], Y[1], 30); await V.wait(40); const tB = await V.sound.now(); await V.finger.down(7, GUST.x + 28, GUST.y + 28); const yAt = Date.now() + 2000 / Math.max(1, V.fps || 30); await V.wait(30); await V.finger.lift(7); await V.wait(Math.max(80, 2500 / Math.max(1, V.fps || 30))); const sB = await V.snap("cast-under-8"); await V.wait(Math.max(0, 320 - (Date.now() - yAt)));
      const heard = await V.sound.readings(tB - 80), peak = (from, to) => heard.filter((e) => e[0] >= from && e[0] < to).reduce((m, e) => Math.max(m, e[1]), 0), tail = peak(tB - 80, tB), after = peak(tB + 20, tB + 320);
      const la = await V.read(sA), lb = await V.read(sB), most = mana(la) + 0.85 + (BACK * (yAt - sA.t0)) / 1000, allCleared = usedNow.every(([tx, ty]) => thing(la, tx, ty) === null); l = lb;
      if (!first) first = { la, n: nNow, used: usedNow, left: 100 - COST * nNow + (BACK * (la.at - d0)) / 1000 };
      if (process.env.CHECK_NOTES) console.log("  note: try", tries, "after", nNow, "casts the bar shows", mana(la), "button", shows(la), "then", Y.join(","), "with at most", round(most), "tile", thing(lb, ...Y), "ms from the screenshot to the cast", Math.round(yAt - sA.t0));
      if (!allCleared || most >= 8) { if (thing(lb, ...Y) === null) { targets.shift(); used.push(Y); n++; } base = { v: mana(lb), at: lb.at }; continue; }
      low = { dim: shows(la), manaWhenDim: mana(la), stillThere: thing(lb, ...Y) !== null, tail: round(tail), loudestAfter: round(after), newSound: after > Math.max(0.03, tail * 1.5 + 0.02), manaAfter: mana(lb), Y };
    }
    check(V, (first ? first.n : n) + " casts, one after another, each clear their tile", first && first.n >= 12 && first.used.every(([tx, ty]) => thing(first.la, tx, ty) === null), first && { casts: first.n, stillThere: first.used.filter(([tx, ty]) => thing(first.la, tx, ty) !== null) }, "all cleared");
    check(V, "and the bar shows what 8 a cast and 6.5 a second make of it", first && Math.abs(mana(first.la) - first.left) <= 3, first && { mana: mana(first.la), pixels: bar(first.la) }, first && "about " + round(first.left));
    if (!low) console.log("  note: the referee could not get a cast in while the mana was surely under 8. That is the referee's timing, not the build. Run this view again on a quiet machine.");
    check(V, "under 8 mana the button shows its dim picture", low && low.dim === "off", low && { button: low.dim, mana: low.manaWhenDim }, "spell_gust_off");
    check(V, "a cast with less than 8 mana changes nothing", low && low.stillThere, low && { stillThere: low.stillThere, mana: low.manaAfter }, "the rubble or weeds still there");
    check(V, "and makes no sound", low && low.stillThere && !low.newSound, low && { loudestJustBefore: low.tail, loudestAfter: low.loudestAfter }, "no new sound");
    for (let i = 0; i < 60 && mana(l) < 9.5; i++) l = await V.look(); l = await V.look("button-lit-again");
    check(V, "when 8 mana is back, the button is lit again", mana(l) >= 9.5 && shows(l) === "on", { mana: mana(l), button: shows(l) }, "spell_gust");
    if (low) { g = await gustAt(V, low.Y[0], low.Y[1], "after-the-wait"); check(V, "and Gust works again on the tile it could not clear", thing(g.l, ...low.Y) === null, g.l.tiles[low.Y[1]][low.Y[0]], "cleared"); }

    // How fast the mana comes back, at the test browser's own pace and then with the page slowed down.
    const span = (m) => Math.max(1200, Math.min(3000, ((92 - m) / BACK) * 1000 - 300));
    let r1 = await V.look(); await V.wait(span(mana(r1))); let r2 = await V.look("mana-coming-back"); let rate = (mana(r2) - mana(r1)) / ((r2.at - r1.at) / 1000);
    check(V, "the mana comes back at 6.5 a second", mana(r2) < 99 && rate >= 5.8 && rate <= 7.2, { from: mana(r1), to: mana(r2), seconds: round((r2.at - r1.at) / 1000), aSecond: round(rate) }, "6.5 a second");
    const fast = V.fps; await V.slow(3); await V.wait(600); await V.pace(); const slowFps = V.fps;
    r1 = await V.look(); await V.wait(span(mana(r1))); r2 = await V.look("mana-coming-back-slowed"); rate = (mana(r2) - mana(r1)) / ((r2.at - r1.at) / 1000); await V.slow(1); await V.wait(400); await V.pace();
    check(V, "and at the same rate with the page slowed down, like a slow phone", mana(r2) < 99 && rate >= 5.3 && rate <= 7.7, { from: mana(r1), to: mana(r2), seconds: round((r2.at - r1.at) / 1000), aSecond: round(rate), framesASecond: slowFps, unslowed: fast }, "6.5 a second");

    // Steps 1 and 2 still stand: the knob, the speed, the four corners, the house.
    await V.finger.down(1, K.STICK.x, K.STICK.y); await V.finger.slide(1, K.STICK.x + 45, K.STICK.y + 45); await V.wait(250); l = await V.look("knob-out"); await V.finger.lift(1); await V.settle(); const back = await V.look();
    check(V, "the knob still follows the thumb, stops 28 pixels out, and goes back", knobAt(l, 19.8, 19.8, 1.5) && knobAt(back, 0, 0, 1), { out: l.knob, back: back.knob }, "19.8, 19.8, then 0, 0");
    // From step 8 the stairwell takes the mage down, so the walk for the speed goes along a row well above it.
    await V.push(0, -1, 1200);
    await V.push(-1, 0, 1800); await V.finger.down(1, K.STICK.x, K.STICK.y); await V.finger.slide(1, K.STICK.x + 45, K.STICK.y); await V.wait(300); r1 = await V.look(); await V.wait(1000); r2 = await V.look(); await V.finger.lift(1); await V.settle();
    const speed = r1.mage && r2.mage ? (r2.mage.x - r1.mage.x) / ((r2.at - r1.at) / 1000) : 0;
    check(V, "the mage still walks at 96 pixels a second", speed >= 86 && speed <= 106, round(speed), "96");
    const corners = []; for (const [dx, dy, ms, x, y, name] of [[-1, -1, 5500, 16, 16, "top left"], [-1, 1, 6000, 16, 368, "bottom left"], [1, 1, 4500, 272, 368, "bottom right"], [1, -1, 6000, 272, 16, "top right"]]) { await V.push(dx, dy, ms); l = await V.look("corner-" + name.replace(" ", "-")); corners.push({ corner: name, mage: at(l), ok: near(l, x, y, 1) }); }
    check(V, "all four corners can still be reached, and no further", corners.every((c) => c.ok), corners, "16 or 272 across, 16 or 368 down");
    await V.push(-1, 0, 1500); l = await V.look("against-the-crate");
    check(V, "the crate still stops the mage", near(l, K.CRATE.x1 + K.HALF, 16, 1) || near(l, K.HOUSE.x1 + K.HALF, 16, 1), at(l), "flush against it");
    await end(V);
  }

  // ---------------- The other sizes: the picture, one touch on a tile, one cast ----------------
  async function size(V, pct) {
    const l = await begin(V); startState(V, l, pct);
    const g = await gustAt(V, 2, 4, "rubble");
    check(V, "a touch on a tile aims there", aimedAt(g.aim) === "2,4", aimedAt(g.aim), "2,4");
    check(V, "a touch on the button casts Gust: the rubble is gone", thing(g.l, 2, 4) === null, g.l.tiles[4][2], "cleared");
    check(V, "the mana bar drops by 8", aboutMana(V, g.l, g.want, g.wantHi), { mana: mana(g.l), pixels: bar(g.l) }, "about " + round(g.want));
    check(V, "and there is a sound", g.s.heard, g.s, "gust.wav");
    check(V, "the picture still matches the shared art after the cast", g.l.pictureWrongPct <= pct, g.l.pictureWrongPct + "% of pixels wrong", pct + "% or less");
    await end(V);
  }

  // ---------------- PC size: the 1 key and the mouse ----------------
  async function pc(V) {
    let l = await begin(V), s; startState(V, l, 3);
    s = await hear(V, () => V.page.keyboard.press("1")); l = await V.look("key-1-on-nothing"); V.no = s;
    check(V, "the 1 key casts: with nothing to clear, a sound and no cost", s.heard && bar(l) >= BAR - 1, { sound: s, pixels: bar(l) }, "no.wav, the bar full");
    await V.tapTile(2, 4); await V.settle(); const aim = await V.look("mouse-aims");
    check(V, "a mouse press on a tile aims there", aimedAt(aim) === "2,4", aimedAt(aim), "2,4");
    let t = await V.sound.now(); const pressed = Date.now(); await V.page.keyboard.press("1"); await V.wait(150); l = await V.look("key-1-gust"); await V.wait(750); s = await V.sound.since(t); V.gust = s;
    const want = 100 - COST + (BACK * (l.at - pressed)) / 1000;
    check(V, "the 1 key casts Gust on the aimed tile", thing(l, 2, 4) === null && aboutMana(V, l, want) && s.heard && s.seconds > V.no.seconds + 0.08, { tile: l.tiles[4][2], mana: mana(l), sound: s }, "the rubble gone, about " + round(want) + " mana, gust.wav");
    const g = await gustAt(V, 6, 4, "weeds-by-mouse");
    check(V, "a mouse press on the button casts Gust", aimedAt(g.aim) === "6,4" && thing(g.l, 6, 4) === null && kind(V, g.s) === "the Gust sound", { aimed: aimedAt(g.aim), tile: g.l.tiles[4][6], heard: kind(V, g.s) }, "the weeds gone, gust.wav");
    await V.tapTile(8, 2); await V.settle(); l = await V.look("far-mouse-press");
    check(V, "a mouse press on a far tile does nothing", aimedAt(l) === "6,4", aimedAt(l), "the mark still on 6,4");
    await V.page.keyboard.down("KeyA"); await V.wait(350); l = await V.look("walking-with-a-key"); await V.page.keyboard.up("KeyA"); await V.settle();
    check(V, "the keys still walk the mage, and the aim follows", l.mage && l.mage.x < 138 && l.mage.facing === "left" && inFront(l), { mage: at(l), aimed: aimedAt(l), front: front(l) }, "moved left, the mark in front");
    const rest = await V.look(); await V.mouse.down(...mid(4, 8)); await V.mouse.slide(K.STICK.x + 30, K.STICK.y); await V.wait(500); l = await V.look("mouse-from-the-lot-to-the-stick"); await V.mouse.lift();
    check(V, "a mouse press that starts on the lot does not work the stick", knobAt(l, 0, 0, 1) && rest.mage && near(l, rest.mage.x, rest.mage.y, 1), { knob: l.knob, mage: at(l) }, "the knob at rest, the mage still");
    await V.push(1, 0, 500); l = await V.look("mouse-on-the-stick");
    check(V, "the mouse still works the stick", rest.mage && l.mage && l.mage.x - rest.mage.x > 25, { was: at(rest), now: at(l) }, "the mage moved right");
    await end(V);
  }

  // ---------------- A short film of the step, for the series ----------------
  async function film(V) {
    await begin(V, true); await V.wait(600);
    await V.tapButton(GUST); await V.wait(900);
    for (const [tx, ty] of [[2, 4], [6, 4], [2, 0]]) { await V.tapTile(tx, ty); await V.wait(450); await V.tapButton(GUST); await V.wait(900); }
    await V.push(-1, 0, 1000); await V.wait(300); await V.tapButton(GUST); await V.wait(700);
    for (const [tx, ty] of [[1, 3], [1, 1], [0, 3], [0, 1], [1, 0]]) { await V.tapTile(tx, ty); await V.wait(250); await V.tapButton(GUST); await V.wait(500); }
    await V.push(0.2, 1, 2600); await V.wait(300);
    const l = await V.look(); const near2 = []; if (l.mage) for (let ty = l.mage.tileY - 2; ty <= l.mage.tileY + 2; ty++) for (let tx = l.mage.tileX - 2; tx <= l.mage.tileX + 2; tx++) if (tx >= 0 && tx < 9 && ty >= 0 && ty < 12 && l.tiles[ty][tx].thing && l.tiles[ty][tx].thing !== "crate") near2.push([tx, ty]);
    for (const [tx, ty] of near2.slice(0, 12)) { await V.tapTile(tx, ty, 40); await V.wait(110); await V.tapButton(GUST, 40); await V.wait(110); }
    await V.wait(800); await V.tapButton(GUST); await V.wait(3200);
    await V.close();
  }

  const views = [
    ["play", { name: "play", width: 288, height: 576, dpr: 1, touch: true }, (V) => play(V)],
    ["phone-sharp", { name: "phone-sharp", width: 390, height: 844, dpr: 3, touch: true }, (V) => size(V, 1)],
    ["phone", { name: "phone", width: 390, height: 844, dpr: 1, touch: true }, (V) => size(V, 1)],
    ["small-phone", { name: "small-phone", width: 360, height: 640, dpr: 1, touch: true }, (V) => size(V, 3)],
    ["phone-sideways", { name: "phone-sideways", width: 640, height: 360, dpr: 2, touch: true }, (V) => size(V, 3)],
    ["pc", { name: "pc", width: 1280, height: 720, dpr: 1, touch: false }, (V) => pc(V)],
    ["film", { name: "film", width: 576, height: 1152, dpr: 1, touch: true, film: "step-03.webm" }, (V) => film(V)],
  ];
  for (const [name, v, run] of views) { if (only && only !== name) continue; console.log("\n" + name + " (" + v.width + "x" + v.height + " @" + v.dpr + ")"); const V = await open(v); try { await run(V); } catch (e) { check(V, "the check ran to its end", false, String(e && e.stack ? e.stack : e).slice(0, 600), "no trouble in the check itself"); try { await V.close(); } catch (e2) { /* already closed */ } } }
  const report = await finish();
  process.exit(report.missed ? 1 : 0);
})();
