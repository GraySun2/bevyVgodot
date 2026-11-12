// The referee's check for step 6, "Skills", the same for both builds. Like the checks before it, it serves a
// build's web folder the way a plain web host would, opens it in headless Chromium, and plays it with real
// touch events (and, at PC size, the mouse and the keys). Everything it judges it reads from screenshots and
// from what the page sends to the speakers: the skills button, the panel with its four levels and four bars,
// the level-up pop, and that the game stands still while the panel is open.
//
//   node tools/check-step-06.cjs <web folder> <folder for screenshots> [one view's name]
//
// Steps 1 to 5 still standing is checked by running the older checks on the same build, with BUILD_STEP=6.
const path = require("path");
const { K, referee, layoutFor, BUTTONS, SKILLS } = require("./referee.cjs");

const web = path.resolve(process.argv[2] || "web"), out = path.resolve(process.argv[3] || "check-out"), only = process.argv[4] || "";
const [GUST, BREAK, SPROUT, DRAW] = ["gust", "break_ground", "sprout", "draw"].map((n) => BUTTONS.find((b) => b.name === n));
const BACK = 6.5, WEEDS = 45, BARW = SKILLS.bar.w, SK = [SKILLS.button.x + 18, SKILLS.button.y + 18], NOWHERE = [170, 12];
const needXp = (level) => Math.round(100 * Math.pow(1.12, level - 1)), fillFor = (xp, level) => Math.round((BARW * xp) / needXp(level));
const mid = (b) => [b.x + 28, b.y + 28];

(async () => {
  const ref = await referee(web, out, 6, layoutFor(Number(process.env.BUILD_STEP || 6)));
  const { open, check, finish, lot, round, at, near, knobAt, aimedAt, lotThing, sounds } = ref;
  const bar = (l) => (l.mana ? l.mana.filledPixels : null), mana = (l) => (l.mana ? l.mana.mana : null);
  const tileMid = (tx, ty) => [tx * K.T + 16, K.TOP + ty * K.T + 16], tile = (l, xy) => l.tiles[xy[1]][xy[0]];
  const sig = (t) => t.ground + "/" + (t.thing && t.thing.startsWith("crop_") ? "crop" : t.thing);
  const bareGrass = (t) => (t.ground === "grass" || t.ground === "grass_flowers") && t.thing === null;
  const weedSpot = (l) => { let best = null; if (l.mage) for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 9; tx++) { if (!bareGrass(l.tiles[ty][tx])) continue; const d = Math.abs(tx - l.mage.tileX) + Math.abs(ty - l.mage.tileY); if (!best || d > best.d) best = { tx, ty, d }; } return best; };
  // The panel as "level:fill" for Air, Earth, Growth and Water, or "closed".
  const panel = (l) => (l.panel ? SKILLS.schools.map((n) => l.panel.schools[n].level + ":" + l.panel.schools[n].fill).join(" ") : "closed");
  const wantPanel = (xp) => SKILLS.schools.map((n) => { let level = 1, x = xp[n] || 0; while (x >= needXp(level)) { x -= needXp(level); level++; } return level + ":" + fillFor(x, level); }).join(" ");
  const untilTime = async (V, t) => { const ms = t - Date.now(); if (ms > 0) await V.wait(ms); };

  async function begin(V, quiet) {
    if (!quiet) check(V, "the cover shows first", V.coverSeen, V.secondsToCover + " s", "the cover with its words");
    V.coverLo = Date.now(); await V.tap(...NOWHERE, 250); V.coverHi = Date.now(); V.paused = { lo: 0, hi: 0 }; await V.wait(900); await V.pace();
    return V.look("start", true);
  }
  function startState(V, l, pct) {
    check(V, "the mage starts below the door, facing down", near(l, K.START.x, K.START.y, 1) && l.mage.facing === "down", at(l), "144, 80, facing down");
    const wrong = []; for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 9; tx++) { const t = l.tiles[ty][tx]; if (t.thing !== lotThing(tx, ty) || t.ground !== lot.ground_legend[lot.ground[ty][tx]]) wrong.push(tx + "," + ty); }
    check(V, "every tile shows the ground and the thing the shared lot says", wrong.length === 0, wrong, "all 108 tiles right");
    check(V, "the skills button is in the top strip", l.skillsButton && l.skillsButton.shows && l.skillsButton.wrongPixels <= (pct <= 1 ? 8 : 60), l.skillsButton, "button_skills at 204, 6");
    check(V, "the panel is closed and no pop shows", !l.panel && !l.pop, { panel: panel(l), pop: !!l.pop }, "neither");
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
  // Opening and closing the panel. The referee keeps count of how long it has been open, to the nearest it
  // can know: the game's clocks should have stood still for that long.
  async function openPanel(V, label, press) { V.openLo = Date.now(); await (press ? press() : V.tap(...SK)); V.openHi = Date.now(); await V.settle(); return V.look(label, true); }
  async function closed(V) { V.paused.lo += Math.max(0, V.closeLo - V.openHi) / 1000; V.paused.hi += (V.closeHi - V.openLo) / 1000; }
  async function closePanel(V, label, press) { V.closeLo = Date.now(); await (press ? press() : V.tap(...NOWHERE)); V.closeHi = Date.now(); await closed(V); await V.settle(); return V.look(label); }
  const quick = async (V, b, xy) => { if (xy) { await V.tapTile(xy[0], xy[1], 40); await V.wait(60); } await V.tapButton(b, 40); await V.wait(110); };

  // ---------------- The playing view: one picture pixel to one screen pixel ----------------
  async function play(V) {
    let l = await begin(V), s, t, a, b; startState(V, l, 1); const xp = {};

    // The panel at the start: four schools at level 1, four empty bars.
    l = await openPanel(V, "panel-at-the-start");
    check(V, "a touch on the skills button opens the panel", !!l.panel && l.panel.wrongPct <= 2, l.panel && { wrongPct: l.panel.wrongPct }, "panel_skills at 16, 112");
    check(V, "all four schools start at level 1 with empty bars", panel(l) === wantPanel(xp), panel(l), wantPanel(xp) + " (level:pixels for Air, Earth, Growth, Water)");
    check(V, "the picture with the panel on it matches the shared art", l.pictureWrongPct <= 1, l.pictureWrongPct + "% of pixels wrong", "1% or less");
    l = await closePanel(V, "panel-closed");
    check(V, "the next touch closes the panel", !l.panel, panel(l), "closed");

    // One cast of each spell that changes something: 10 XP to each school.
    await V.tapTile(2, 4); await V.settle(); await V.tapButton(GUST); await V.wait(300); xp.air = 10;
    await V.tapTile(4, 3); await V.settle(); await V.tapButton(BREAK); await V.wait(300); xp.earth = 10; await V.tapButton(SPROUT); await V.wait(300); xp.growth = 10;
    const wLo = Date.now(), P0 = { ...V.paused }; await V.tapButton(DRAW); const wHi = Date.now(); await V.wait(300); xp.water = 10; l = await V.look("one-cast-each");
    check(V, "one cast of each spell works as before", tile(l, [2, 4]).thing === null && tile(l, [4, 3]).ground === "soil_wet" && tile(l, [4, 3]).thing === "crop_seed" && !l.pop, { rubble: tile(l, [2, 4]), seed: tile(l, [4, 3]), pop: !!l.pop }, "the rubble gone, a watered seed at 4,3, no pop");
    l = await openPanel(V, "panel-ten-xp-each");
    check(V, "each cast that changed something gave its school 10 XP: Gust to Air, Break Ground to Earth, Sprout to Growth, Draw to Water", panel(l) === wantPanel(xp), panel(l), wantPanel(xp));
    // While the panel is open the game stands still. The mana is not full now, so the bar would show it.
    a = l; await V.wait(2000); b = await V.look("panel-still-open");
    check(V, "while the panel is open, the mana stands still", mana(a) < 95 && bar(b) === bar(a) && !!b.panel, { before: mana(a), twoSecondsLater: mana(b), panel: panel(b) }, "the same bar two seconds later");
    // A touch on the stick closes the panel and does nothing else.
    V.closeLo = Date.now(); await V.finger.down(1, K.STICK.x, K.STICK.y); V.closeHi = Date.now(); await closed(V); await V.finger.slide(1, K.STICK.x - 45, K.STICK.y); await V.wait(600); l = await V.look("stick-touch-closes"); await V.finger.lift(1); await V.settle();
    check(V, "a touch on the stick closes the panel and does nothing else: the mage does not walk", !l.panel && near(l, K.START.x, K.START.y, 1) && knobAt(l, 0, 0, 1), { panel: panel(l), mage: at(l), knob: l.knob }, "closed, the mage where it was, the knob at rest");
    // A touch on a spell button closes it and casts nothing. (A cast would be heard: every cast makes a sound.)
    a = await V.look(); await openPanel(V); t = await V.sound.now(); l = await closePanel(V, "button-touch-closes", () => V.tap(...mid(BREAK))); await V.wait(500); s = await V.sound.since(t);
    check(V, "a touch on a spell button closes the panel and casts nothing", !l.panel && !s.heard && lSig(l) === lSig(a) && bar(l) >= bar(a), { panel: panel(l), heard: s.heard ? s.name : "none" }, "closed, no sound, nothing changed");
    // A touch on a tile closes it and does not aim.
    a = await V.look(); await openPanel(V); l = await closePanel(V, "tile-touch-closes", () => V.tapTile(2, 2));
    check(V, "a touch on a tile closes the panel and does not aim", !l.panel && aimedAt(l) === aimedAt(a), { panel: panel(l), aimed: aimedAt(l), was: aimedAt(a) }, "closed, the mark where it was");

    // The watered seed's growing stood still for as long as the panel was open.
    const P1 = { lo: V.paused.lo - P0.lo, hi: V.paused.hi - P0.hi };
    await untilTime(V, wLo + (10 + P1.lo) * 1000 - 1300); a = await V.look("sprout-before"); await untilTime(V, wHi + (10 + P1.hi) * 1000 + 1200); b = await V.look("sprout-after");
    check(V, "while the panel was open, the crop's growing stood still: it sprouts 10 seconds of open play after it was watered", P1.lo >= 3 && a.at < wLo + (10 + P1.lo) * 1000 - 400 && tile(a, [4, 3]).thing === "crop_seed" && tile(b, [4, 3]).thing === "crop_sprout",
      { panelOpenFor: [round(P1.lo), round(P1.hi)], justBefore: tile(a, [4, 3]).thing, justAfter: tile(b, [4, 3]).thing }, "crop_seed, then crop_sprout");

    // Nine Gusts in all: Air at 90 of 100. From tile 3,8 there are 19 tiles of rubble and weeds in reach.
    l = await V.walkToTile(3, 8, 6); await need(V, 75); l = await V.look("before-the-gusts");
    const targets = []; if (l.mage) for (let ty = l.mage.tileY - 2; ty <= l.mage.tileY + 2; ty++) for (let tx = l.mage.tileX - 2; tx <= l.mage.tileX + 2; tx++) if (tx >= 0 && tx < 9 && ty >= 0 && ty < 12 && (l.tiles[ty][tx].thing === "rubble" || l.tiles[ty][tx].thing === "weeds")) targets.push([tx, ty]);
    for (let i = 0; i < 8; i++) { await quick(V, GUST, targets.shift()); xp.air += 10; }
    // Casts that change nothing give nothing: two Gusts at a tile already cleared.
    await V.wait(600); await quick(V, GUST, null); await V.wait(500); await quick(V, GUST, null); await V.wait(500);
    l = await openPanel(V, "panel-air-at-90");
    check(V, "nine Gusts that cleared a tile make 90 XP for Air, and two that cleared nothing add nothing", panel(l) === wantPanel(xp), panel(l), wantPanel(xp));
    l = await closePanel(V);

    // The weeds' clock stood still too: their first moment comes 45 seconds of open play after the cover went away.
    const P2 = { ...V.paused };
    await untilTime(V, V.coverLo + (WEEDS + P2.lo) * 1000 - 1300); a = await V.look("weeds-before"); const spot = weedSpot(a);
    await untilTime(V, V.coverHi + (WEEDS + P2.hi) * 1000 + 1200); b = await V.look("weeds-after"); const changed = [];
    for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 9; tx++) if (sig(a.tiles[ty][tx]) !== sig(b.tiles[ty][tx])) changed.push(tx + "," + ty + " " + sig(b.tiles[ty][tx]));
    check(V, "the weeds' clock stood still while the panel was open: they grow after 45 seconds of open play", spot && a.at < V.coverLo + (WEEDS + P2.lo) * 1000 - 400 && changed.length === 1 && changed[0].startsWith(spot.tx + "," + spot.ty + " ") && changed[0].endsWith("/weeds"),
      { panelOpenFor: [round(P2.lo), round(P2.hi)], wanted: spot && spot.tx + "," + spot.ty, changed }, "weeds on that one tile, and not before");

    // The tenth Gust: Air reaches level 2. The pop shows for a second and a half, and level_up.wav plays.
    await need(V, 30); await V.tapTile(...targets[0]); await V.settle(); a = await V.look("before-the-tenth"); t = await V.sound.now(); const cLo = Date.now(); await V.tapButton(GUST, 40); const cHi = Date.now(); xp.air += 10; targets.shift();
    await V.wait(250); const s1 = await V.snap("pop"); await untilTime(V, cLo + 1150); const s2 = await V.snap("pop-still"); await untilTime(V, cHi + 2000); const s3 = await V.snap("pop-gone"); s = await V.sound.since(t);
    const l1 = await V.read(s1), l2 = await V.read(s2), l3 = await V.read(s3);
    check(V, "the step's line, 1: the tenth Gust takes Air to level 2, and the level-up pop shows", !a.pop && !!l1.pop && l1.pop.wrongPct <= 3, { before: !!a.pop, after: l1.pop }, "pop_level_up at 93, 54");
    check(V, "the pop stays for 1.5 seconds and then goes", !!l2.pop && !l3.pop && s2.at < cLo + 1400, { atOneSecond: !!l2.pop, atTwoSeconds: !!l3.pop }, "there after 1.1 seconds, gone after 2");
    check(V, "level_up.wav plays, along with Gust's own sound", s.heard && s.seconds >= sounds.level_up.seconds - 0.1 && s.hzEnd > 800, s, "a sound as long as level_up.wav: " + JSON.stringify(sounds.level_up));
    check(V, "the picture with the pop on it matches the shared art", l1.pictureWrongPct <= 1, l1.pictureWrongPct + "% of pixels wrong", "1% or less");
    l = await openPanel(V, "panel-air-level-2");
    check(V, "the step's line, 2: the panel shows Air at level 2, with an empty bar", panel(l) === wantPanel(xp) && l.panel.schools.air.level === "2", panel(l), wantPanel(xp));
    l = await closePanel(V);
    // Three more: 30 of the 112 that level 3 needs.
    await need(V, 30); for (let i = 0; i < 3; i++) { await quick(V, GUST, targets.shift()); xp.air += 10; } await V.wait(300); l = await V.look("three-more");
    check(V, "a cast that gains no level shows no pop", !l.pop, !!l.pop, "no pop");
    l = await openPanel(V, "panel-air-30-of-112");
    check(V, "level 3 needs 112 XP: after three more Gusts the bar shows 30 of 112", panel(l) === wantPanel(xp) && l.panel.schools.air.fill === fillFor(30, 2), panel(l), wantPanel(xp) + " (" + fillFor(30, 2) + " pixels of 228)");
    check(V, "the bars are drawn in their color, to the pixel", SKILLS.schools.every((n) => l.panel.schools[n].wrongPixels <= 4) && l.pictureWrongPct <= 1, { wrong: SKILLS.schools.map((n) => l.panel.schools[n].wrongPixels), picture: l.pictureWrongPct }, "#ffd25a from the left, the rest as the piece has it");
    l = await closePanel(V);

    // Picking gives nothing. The crop watered at the start is ripe 40 seconds of open play after its watering.
    const P3 = { lo: V.paused.lo - P0.lo, hi: V.paused.hi - P0.hi }; await V.walkToTile(4, 2, 5); await untilTime(V, wHi + (40 + P3.hi) * 1000 + 1200); l = await V.look("ripe");
    t = await V.sound.now(); await V.tapTile(4, 3); await V.settle(); a = await V.look("picked"); await V.wait(400); s = await V.sound.since(t);
    b = await openPanel(V, "panel-after-picking");
    check(V, "picking gives no XP", tile(l, [4, 3]).thing === "crop_ripe" && tile(a, [4, 3]).thing === null && s.name === "pick" && panel(b) === wantPanel(xp), { was: tile(l, [4, 3]).thing, now: tile(a, [4, 3]).thing, heard: s.heard ? s.name : "none", panel: panel(b) }, "the crop picked, and the panel still " + wantPanel(xp));
    l = await closePanel(V, "the-end");
    check(V, "the picture still matches the shared art", l.pictureWrongPct <= 1, l.pictureWrongPct + "% of pixels wrong", "1% or less");
    await end(V);
  }
  // Whether two looks show the same tiles (a crop of any size counts as "a crop").
  function lSig(a) { return a.tiles.flat().map(sig).join(); }

  // ---------------- The other sizes: the button, and the panel opened by touch ----------------
  async function size(V, pct) {
    let l = await begin(V); startState(V, l, pct);
    l = await openPanel(V, "panel");
    check(V, "a touch on the skills button opens the panel, and it matches the shared art", !!l.panel && panel(l) === wantPanel({}) && l.pictureWrongPct <= pct, { panel: panel(l), picture: l.pictureWrongPct }, wantPanel({}) + ", " + pct + "% or less wrong");
    l = await closePanel(V, "closed");
    check(V, "the next touch closes it", !l.panel, panel(l), "closed");
    await end(V);
  }

  // ---------------- PC size: the K key and the mouse ----------------
  async function pc(V) {
    let l = await begin(V); startState(V, l, 3);
    await V.page.keyboard.press("1"); await V.wait(200);
    l = await openPanel(V, "key-k-opens", () => V.page.keyboard.press("k"));
    check(V, "the K key opens the panel", !!l.panel && panel(l) === wantPanel({}), panel(l), wantPanel({}));
    l = await closePanel(V, "key-k-closes", () => V.page.keyboard.press("k"));
    check(V, "and the K key closes it", !l.panel, panel(l), "closed");
    l = await openPanel(V, "mouse-opens");
    check(V, "a mouse press on the skills button opens the panel", !!l.panel, panel(l), "open");
    l = await closePanel(V, "mouse-closes");
    check(V, "and the next mouse press closes it", !l.panel, panel(l), "closed");
    await end(V);
  }

  // ---------------- A short film of the step, for the series ----------------
  async function film(V) {
    await begin(V, true); await V.wait(600); await V.tap(...SK); await V.wait(1500); await V.tap(...NOWHERE); await V.wait(500);
    await V.walkToTile(3, 8, 6); const l = await V.look(); const targets = []; if (l.mage) for (let ty = l.mage.tileY - 2; ty <= l.mage.tileY + 2; ty++) for (let tx = l.mage.tileX - 2; tx <= l.mage.tileX + 2; tx++) if (tx >= 0 && tx < 9 && ty >= 0 && ty < 12 && (l.tiles[ty][tx].thing === "rubble" || l.tiles[ty][tx].thing === "weeds")) targets.push([tx, ty]);
    for (let i = 0; i < 9; i++) { await V.tapTile(...targets[i], 50); await V.wait(200); await V.tapButton(GUST, 50); await V.wait(450); }
    await V.tap(...SK); await V.wait(1800); await V.tap(...NOWHERE); await V.wait(700);
    await V.tapTile(...targets[9], 50); await V.wait(300); await V.tapButton(GUST, 50); await V.wait(2200);
    await V.tap(...SK); await V.wait(2500); await V.tap(...NOWHERE); await V.wait(800); await V.close();
  }

  const views = [
    ["play", { name: "play", width: 288, height: 576, dpr: 1, touch: true }, (V) => play(V)],
    ["phone-sharp", { name: "phone-sharp", width: 390, height: 844, dpr: 3, touch: true }, (V) => size(V, 1)],
    ["phone", { name: "phone", width: 390, height: 844, dpr: 1, touch: true }, (V) => size(V, 1)],
    ["small-phone", { name: "small-phone", width: 360, height: 640, dpr: 1, touch: true }, (V) => size(V, 3)],
    ["phone-sideways", { name: "phone-sideways", width: 640, height: 360, dpr: 2, touch: true }, (V) => size(V, 3)],
    ["pc", { name: "pc", width: 1280, height: 720, dpr: 1, touch: false }, (V) => pc(V)],
    ["film", { name: "film", width: 576, height: 1152, dpr: 1, touch: true, film: "step-06.webm" }, (V) => film(V)],
  ];
  for (const [name, v, run] of views) { if (only && only !== name) continue; console.log("\n" + name + " (" + v.width + "x" + v.height + " @" + v.dpr + ")"); const V = await open(v); try { await run(V); } catch (e) { check(V, "the check ran to its end", false, String(e && e.stack ? e.stack : e).slice(0, 600), "no trouble in the check itself"); try { await V.close(); } catch (e2) { /* already closed */ } } }
  const report = await finish();
  process.exit(report.missed ? 1 : 0);
})();
