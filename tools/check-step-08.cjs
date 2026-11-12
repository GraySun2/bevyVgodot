// The referee's check for step 8, "Down the stairs", the same for both builds. Like the checks before it, it
// serves a build's web folder the way a plain web host would, opens it in headless Chromium, and plays it with
// real touch events (and, at PC size, the mouse and the keys). Everything it judges it reads from screenshots
// and from what the page sends to the speakers: which place shows, the walls and the four gates, which spell
// opens which gate, the coins and the seed cache, the way back up, the lot standing still meanwhile, and the
// dungeon being as new on the next trip down.
//
//   node tools/check-step-08.cjs <web folder> <folder for screenshots> [one view's name]
//
// Steps 1 to 7 still standing is checked by running the older checks on the same build, with BUILD_STEP=8.
const path = require("path");
const { K, referee, layoutFor, BUTTONS, SKILLS, PAUSE } = require("./referee.cjs");

const web = path.resolve(process.argv[2] || "web"), out = path.resolve(process.argv[3] || "check-out"), only = process.argv[4] || "";
const [GUST, BREAK, SPROUT, DRAW] = ["gust", "break_ground", "sprout", "draw"].map((n) => BUTTONS.find((b) => b.name === n)), SPELLS = [GUST, BREAK, SPROUT, DRAW];
const BACK = 6.5, DARK = 29.3, BARW = SKILLS.bar.w, SK = [SKILLS.button.x + 18, SKILLS.button.y + 18], PZ = [PAUSE.button.x + 18, PAUSE.button.y + 18], NOWHERE = [170, 12];
const needXp = (level) => Math.round(100 * Math.pow(1.12, level - 1)), fillFor = (xp, level) => Math.round((BARW * xp) / needXp(level));
const mid = (tx, ty) => [tx * K.T + 16, ty * K.T + 16];

(async () => {
  const ref = await referee(web, out, 8, layoutFor(Number(process.env.BUILD_STEP || 8)));
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

  // One gate: the gate stops the mage, the three other spells get the soft "no", its own spell opens it.
  async function gate(V, g, xp, how) {
    let l, s, a;
    await V.walkToTile(g.stand[0], g.stand[1], 4);
    if (how === "push") { await V.push(0, g.up ? -1 : 1, 500); l = await V.look("at-the-" + g.name.slice(5) + "-gate");
      const stop = g.up ? (g.xy[1] + 1) * K.T + K.HALF : g.xy[1] * K.T - K.HALF;
      check(V, "the " + g.name + " stops the mage", l.place === "dungeon" && l.mage && Math.abs(l.mage.y - stop) <= 1.5, at(l), "stopped at y " + stop);
      check(V, "the aim mark shows on the gate in front of the mage", aimedAt(l) === g.xy.join(), aimedAt(l), g.xy.join());
    } else { await V.tapTile(...g.xy); await V.settle(); l = await V.look("at-the-" + g.name.slice(5) + "-gate");
      check(V, "a touch on the " + g.name + " from the next tile aims at it", aimedAt(l) === g.xy.join(), aimedAt(l), g.xy.join()); }
    const others = SPELLS.filter((b) => b !== g.spell), got = [];
    for (const b of others) { s = await hear(V, () => V.tapButton(b, 60), 800); got.push(heard(s)); }
    a = await V.look("the-" + g.name.slice(5) + "-gate-still-shut");
    check(V, "the three other spells do not open the " + g.name + ": each plays the soft no and costs nothing", got.every((h) => h === "no") && tile(a, g.xy).thing === g.name && bar(a) >= bar(l) && cnt(a, "seeds") === cnt(l, "seeds"),
      { tried: others.map((b) => b.name), heard: got, gate: tile(a, g.xy).thing, mana: [mana(l), mana(a)], seeds: cnt(a, "seeds") }, "no.wav three times, the gate still there, no mana or seed spent");
    const t = await V.sound.now(), s0 = await V.snap(); await V.tapButton(g.spell, 60); await V.wait(Math.max(120, 3500 / Math.max(1, V.fps || 30))); const s1 = await V.snap(); await V.wait(800); s = await V.sound.since(t);
    const l0 = await V.read(s0), l1 = await V.read(s1); l = await V.look("the-" + g.name.slice(5) + "-gate-open"); xp[g.school] = (xp[g.school] || 0) + 10;
    check(V, g.spell.name + " opens the " + g.name + ": the gate is gone and the floor shows", tile(l, g.xy).thing === null && tile(l, g.xy).ground === "floor", tile(l, g.xy), "floor with nothing on it");
    check(V, "opening it plays " + g.spell.name + ".wav", heard(s) === g.spell.name, { heard: heard(s), seconds: s.seconds }, g.spell.name + ".wav");
    // Mana spent from a full bar starts coming back at once, so the most it can read is reckoned after the cost, then held to 100.
    { const most = Math.min(100, mana(l0) - g.spell.cost + (BACK * (s1.t1 - s0.t0)) / 1000) + 1.5, least = mana(l0) - g.spell.cost - 1.5;
      check(V, "opening it costs " + g.spell.cost + " mana", mana(l1) <= most && mana(l1) >= least, { before: mana(l0), after: mana(l1), between: [round(least), round(most)] }, g.spell.cost + " less"); }
    l.justAfter = l1; return l;
  }
  GATES.forEach((g) => { g.school = { gust: "air", break_ground: "earth", sprout: "growth", draw: "water" }[g.spell.name]; });

  // ---------------- The playing view: one picture pixel to one screen pixel ----------------
  async function play(V) {
    let l = await begin(V), s, a, b; startState(V, l, 1); const xp = { air: 0, earth: 0, growth: 0, water: 0 };

    // A seed planted and watered on the lot before the trip down. Its growing has to wait for the mage.
    await quick(V, BREAK, [4, 3], 300); await quick(V, SPROUT, null, 300); const wLo = Date.now(); await V.tapButton(DRAW, 40); const wHi = Date.now(); xp.earth += 10; xp.growth += 10; xp.water += 10; await V.wait(300);
    const before = await V.walkToTile(...beside(STAIRS, 1, 0), 4); const L0 = await V.look("on-the-lot-by-the-stairwell");
    check(V, "the farm from the steps before still works: a seed planted and watered, 7 seeds left", tile(L0, [4, 3]).ground === "soil_wet" && String(tile(L0, [4, 3]).thing).startsWith("crop_") && cnt(L0, "seeds") === "7", { tile: tile(L0, [4, 3]), seeds: cnt(L0, "seeds") }, "a watered seed at 4,3, 7 seeds");

    // Down the stairs, watched: screenshots all through the half second of the fade.
    const downLo = Date.now(), snaps = []; await V.finger.down(1, K.STICK.x, K.STICK.y); await V.finger.slide(1, K.STICK.x + 45, K.STICK.y); const t0 = Date.now();
    while (Date.now() - t0 < 420) snaps.push(await V.snap()); await V.finger.lift(1); while (Date.now() - t0 < 1500) snaps.push(await V.snap());
    const downHi = Date.now(); await V.wait(400); const D0 = await V.look("down-the-stairs", true);
    check(V, "walking onto the stairwell takes the mage down: the dungeon floor shows where the lot was", D0.place === "dungeon", { place: D0.place, mage: at(D0) }, "the dungeon");
    check(V, "every tile of the dungeon is as the shared map has it", notAsMap(D0).length === 0, notAsMap(D0).slice(0, 8), "all 108 tiles right");
    check(V, "the picture of the dungeon matches the shared art", D0.pictureWrongPct <= 1, D0.pictureWrongPct + "% of pixels wrong", "1% or less");
    check(V, "the strips are as they were: the counts, the mana bar, the buttons", cnt(D0, "seeds") === "7" && cnt(D0, "coins") === "0" && D0.skillsButton.shows && D0.pauseButton.shows && SPELLS.every((sp) => D0.buttons[sp.name].shows === "on"), { ...counts(D0), buttons: D0.buttons }, "7 seeds, 0 coins, every button there");
    // The ask says the place darkens evenly, and not whether that is even in light or in color numbers. An engine that mixes
    // as light is lighter in color numbers half way through, so the darkest screenshot is judged in light, which takes both.
    { const lin = (v) => Math.pow((v / 255 + 0.055) / 1.055, 2.4), lights = []; for (const sn of snaps) lights.push((await V.read(sn)).light);
      const low = Math.min(...lights), bound = lin(DARK) + 0.6 * (lin(Math.min(L0.light, D0.light)) - lin(DARK));
      check(V, "the place fades to the dark color and back on the way down", lin(low) <= bound, { lightOnTheLot: L0.light, lightBelow: D0.light, darkestSeen: low, darkestSeenInLight: round(lin(low) * 1000) / 1000, screenshots: lights.length }, "a screenshot darker in light than " + round(bound * 1000) / 1000 + " during the fade"); }
    await V.wait(1200); l = await V.look("still-below");
    check(V, "arriving on the stairs does not send the mage back up", l.place === "dungeon", { place: l.place }, "still the dungeon");

    // A wall, then the rubble gate, and the room behind it.
    await V.walkToTile(1, 5, 4); await V.push(-1, 0, 500); l = await V.look("at-a-wall");
    check(V, "a wall stops the mage", l.mage && Math.abs(l.mage.x - (K.T + K.HALF)) <= 1.5, at(l), "stopped at x " + (K.T + K.HALF));
    await gate(V, G_RUBBLE, xp, "push");
    await V.push(0, -1, 700); l = await V.look("through-the-open-gate");
    check(V, "with the gate open, the mage walks through", l.mage && l.mage.y < G_RUBBLE.xy[1] * K.T, at(l), "past y " + G_RUBBLE.xy[1] * K.T);
    // The coins in the room: taken by walking onto them.
    const C = COINS.find((xy) => xy[1] < G_RUBBLE.xy[1] && xy[0] < 4); await V.walkToTile(C[0] + 1, C[1] + 1, 4); a = await V.look("in-the-first-room");
    s = await hear(V, () => V.walkToTile(C[0], C[1], 5)); l = await V.look("coins-taken");
    check(V, "walking onto the coins takes them: 5 more coins, and the pile is gone", cnt(a, "coins") === "0" && cnt(l, "coins") === "5" && tile(a, C).thing === "coins" && tile(l, C).thing === null, { before: cnt(a, "coins"), after: cnt(l, "coins"), tile: tile(l, C) }, "0, then 5 coins, the tile bare");
    check(V, "taking the coins plays sell.wav", heard(s) === "sell", { heard: heard(s) }, "sell.wav");
    await V.walkToTile(3, C[1], 4); await V.push(1, 0, 500); l = await V.look("at-the-wall-between-rooms");
    check(V, "the wall between two rooms stops the mage", l.mage && Math.abs(l.mage.x - (4 * K.T - K.HALF)) <= 1.5, at(l), "stopped at x " + (4 * K.T - K.HALF));
    await route(V, G_RUBBLE.inside, G_RUBBLE.stand);

    // The other three gates, each aimed at by touch.
    a = await gate(V, G_DIRT, xp, "touch");
    // The mana comes back below as it does above: from just after that cast to a second later.
    { const first = a.justAfter, want = (BACK * (a.at - first.at)) / 1000;
      // Where the reckoning reaches the top of the bar, the bar is full and stays at 100.
      check(V, "below, the mana comes back at 6.5 a second as always", a.at - first.at > 600 && Math.abs(mana(a) - Math.min(100, mana(first) + want)) <= 2.5, { first: mana(first), later: mana(a), wouldBe: round(mana(first) + want) }, "about " + round(want) + " more"); }
    a = await gate(V, G_VINE, xp, "touch");
    check(V, "opening the dead vine with Sprout uses no seed", cnt(a, "seeds") === "7", { seeds: cnt(a, "seeds") }, "7 seeds still");
    a = await gate(V, G_BASIN, xp, "touch");
    // A cast that has nothing to open.
    await V.tapTile(G_BASIN.stand[0] - 1, G_BASIN.stand[1] - 1); await V.settle(); a = await V.look("aim-at-bare-floor"); s = await hear(V, () => V.tapButton(BREAK, 60), 800); l = await V.look("break-ground-on-the-floor");
    check(V, "Break Ground on the bare floor changes nothing, costs nothing and plays the soft no", heard(s) === "no" && tile(l, [G_BASIN.stand[0] - 1, G_BASIN.stand[1] - 1]).ground === "floor" && bar(l) >= bar(a) && l.pictureWrongPct <= 1, { heard: heard(s), tile: tile(l, [G_BASIN.stand[0] - 1, G_BASIN.stand[1] - 1]), mana: [mana(a), mana(l)], picture: l.pictureWrongPct }, "no.wav, the floor as it was");
    await V.tapTile(8, G_BASIN.stand[1]); await V.settle(); a = await V.look("aim-at-a-wall"); s = await hear(V, () => V.tapButton(GUST, 60), 800); l = await V.look("gust-on-a-wall");
    check(V, "Gust on a wall changes nothing, costs nothing and plays the soft no", aimedAt(a) === "8," + G_BASIN.stand[1] && heard(s) === "no" && bar(l) >= bar(a) && notAsMap(l, [...GATES.map((g) => g.xy), C]).length === 0, { aimed: aimedAt(a), heard: heard(s), mana: [mana(a), mana(l)], wrong: notAsMap(l, [...GATES.map((g) => g.xy), C]).slice(0, 4) }, "no.wav, nothing changed");

    // The seed cache, in the room behind the basin.
    await V.walkToTile(...G_BASIN.inside, 4); a = await V.look("in-the-cache-room"); s = await hear(V, () => V.tapTile(...CACHE), 800); l = await V.look("touch-on-the-cache");
    check(V, "a touch on the cache only aims at it", aimedAt(l) === CACHE.join() && cnt(l, "seeds") === "7" && tile(l, CACHE).thing === "cache" && !s.heard, { aimed: aimedAt(l), seeds: cnt(l, "seeds"), tile: tile(l, CACHE).thing, heard: heard(s) }, "the mark on it, 7 seeds, the cache there, no sound");
    s = await hear(V, () => V.walkToTile(CACHE[0], CACHE[1], 5)); l = await V.look("cache-taken");
    check(V, "walking onto the cache takes it: 12 more seeds, and the cache is gone", cnt(l, "seeds") === "19" && tile(l, CACHE).thing === null, { seeds: cnt(l, "seeds"), tile: tile(l, CACHE) }, "19 seeds, the tile bare");
    check(V, "the seed count is written with two digit pieces in their places", l.counts.seeds && l.counts.seeds.wrongPixels <= 8 && l.pictureWrongPct <= 1, { seeds: l.counts.seeds, picture: l.pictureWrongPct }, "1 at 28, 27 and 9 at 40, 27");
    check(V, "taking the cache plays pick.wav", heard(s) === "pick", { heard: heard(s) }, "pick.wav");
    // Every gate gave its school 10 XP, and the casts that opened nothing gave none.
    await V.tap(...SK); await V.settle(); l = await V.look("skills-below", true); await V.tap(...NOWHERE); await V.settle();
    check(V, "opening a gate gives its spell's school 10 XP, and the casts that opened nothing give none", panel(l) === wantPanel(xp), panel(l), wantPanel(xp));
    check(V, "the skills panel shows over the dungeon, and the picture matches the shared art", l.place === "dungeon" && l.pictureWrongPct <= 1, { place: l.place, picture: l.pictureWrongPct }, "the dungeon, 1% or less wrong");

    // Back up the stairs. The lot stood still the whole time below.
    await route(V, G_BASIN.inside, G_BASIN.stand); const up = await goUp(V); const U0 = await V.look("back-on-the-lot", true); const sm = mid(...STAIRS);
    check(V, "walking onto the stairs up takes the mage back to the lot, on the stairwell tile, facing down", U0.place === "lot" && near(U0, sm[0], sm[1], 1) && U0.mage.facing === "down", { place: U0.place, mage: at(U0) }, "the lot, " + sm.join(", ") + ", facing down");
    check(V, "the cache's 12 seeds and the coins are still the mage's back on the lot", cnt(U0, "seeds") === "19" && cnt(U0, "coins") === "5", counts(U0), "19 seeds, 5 coins");
    check(V, "back on the lot, the picture matches the shared art", U0.pictureWrongPct <= 1, U0.pictureWrongPct + "% of pixels wrong", "1% or less");
    { // The lot's own time: from the watering to the stairs down, and on from the stairs up. Below does not count.
      const P = { lo: Math.max(0, up.lo - downHi) / 1000, hi: (up.hi - downLo) / 1000 };
      check(V, "the trip below was long enough to tell: the crop would be grown by now if the lot had not stood still", (U0.at - wHi) / 1000 > 27 && tile(U0, [4, 3]).thing !== "crop_grown" && tile(U0, [4, 3]).thing !== "crop_ripe", { secondsSinceWatering: round((U0.at - wHi) / 1000), below: [round(P.lo), round(P.hi)], crop: tile(U0, [4, 3]).thing }, "more than 27 seconds, and the crop not yet grown");
      await untilTime(V, wLo + (25 + P.lo) * 1000 - 1300); a = await V.look("grown-before"); await untilTime(V, wHi + (25 + P.hi) * 1000 + 1200); b = await V.look("grown-after");
      check(V, "the lot stood still while the mage was below: the crop is grown 25 seconds of the lot's own time after it was watered", a.at < wLo + (25 + P.lo) * 1000 - 400 && tile(a, [4, 3]).thing === "crop_sprout" && tile(b, [4, 3]).thing === "crop_grown", { below: [round(P.lo), round(P.hi)], justBefore: tile(a, [4, 3]).thing, justAfter: tile(b, [4, 3]).thing }, "crop_sprout, then crop_grown"); }
    l = await V.look("still-on-the-lot");
    check(V, "arriving on the stairwell does not send the mage back down", l.place === "lot" && near(l, sm[0], sm[1], 1), { place: l.place, mage: at(l) }, "still on the lot, on the stairwell tile");
    const LOT1 = lotSig(l);

    // Down again: the dungeon is as new.
    await goDown(V); l = await V.look("down-again", true); const um = mid(...UP);
    check(V, "stepping off the stairwell and back on goes down again, onto the stairs up, facing down", l.place === "dungeon" && near(l, um[0], um[1], 1) && l.mage.facing === "down", { place: l.place, mage: at(l) }, "the dungeon, " + um.join(", ") + ", facing down");
    check(V, "every trip down starts fresh: all four gates shut, the coins and the cache back", notAsMap(l).length === 0, notAsMap(l).slice(0, 8), "all 108 tiles as the shared map has them");
    check(V, "what the mage carries is kept on the way down", cnt(l, "seeds") === "19" && cnt(l, "coins") === "5", counts(l), "19 seeds, 5 coins");
    // The page closed while the mage is below.
    await V.reopen(); check(V, "opened again, the cover shows first", V.coverSeen, V.secondsToCover + " s", "the cover with its words");
    await V.tap(...NOWHERE, 250); await V.wait(900); await V.pace(); l = await V.look("opened-again", true);
    check(V, "closed while below and opened again: the mage is on the lot, on its starting tile", l.place === "lot" && near(l, K.START.x, K.START.y, 1) && l.mage.facing === "down", { place: l.place, mage: at(l) }, "the lot, 144, 80, facing down");
    check(V, "opened again, the seeds and coins from below are kept, and the lot is the same farm", cnt(l, "seeds") === "19" && cnt(l, "coins") === "5" && lotSig(l) === LOT1, { ...counts(l), sameFarm: lotSig(l) === LOT1 }, "19 seeds, 5 coins, every tile as it was");
    await end(V);
  }

  // ---------------- The other sizes: the dungeon's picture, and a pause below ----------------
  async function size(V, pct) {
    let l = await begin(V); startState(V, l, pct);
    await V.walkToTile(STAIRS[0] - 2, STAIRS[1], 6); await V.push(1, 0, 900); await V.wait(1300); l = await V.look("down-the-stairs", true);
    check(V, "walking onto the stairwell shows the dungeon", l.place === "dungeon", { place: l.place, mage: at(l) }, "the dungeon");
    check(V, "every tile of the dungeon is as the shared map has it", notAsMap(l).length === 0, notAsMap(l).slice(0, 8), "all 108 tiles right");
    check(V, "the picture of the dungeon matches the shared art", l.pictureWrongPct <= pct, l.pictureWrongPct + "% of pixels wrong", pct + "% or less");
    check(V, "the bars outside the picture are the dark color", l.barsRightColorPct === null || l.barsRightColorPct >= 99, l.barsRightColorPct, "99% or more");
    await V.tap(...PZ); await V.settle(); l = await V.look("paused-below", true);
    check(V, "the pause button pauses below too, and the picture matches the shared art", !!l.paused && l.place === "dungeon" && l.pictureWrongPct <= pct, { paused: !!l.paused, place: l.place, picture: l.pictureWrongPct }, "paused, the dungeon, " + pct + "% or less wrong");
    await V.tap(...NOWHERE); await V.settle(); l = await V.look("going");
    check(V, "the next touch ends the pause", !l.paused && l.place === "dungeon", { paused: !!l.paused, place: l.place }, "not paused, still below");
    await end(V);
  }

  // ---------------- PC size: the keys and the mouse ----------------
  async function pc(V) {
    let l = await begin(V), s; startState(V, l, 3); const hold = async (key, ms) => { await V.page.keyboard.down(key); await V.wait(ms); await V.page.keyboard.up(key); await V.settle(); };
    await V.walkToTile(...beside(STAIRS, 1, 0), 4); await hold("ArrowRight", 300); await V.wait(900); l = await V.look("keys-down-the-stairs", true); const um = mid(...UP);
    check(V, "at PC size the keys walk the mage down the stairs", l.place === "dungeon" && near(l, um[0], um[1], 1), { place: l.place, mage: at(l) }, "the dungeon, " + um.join(", "));
    check(V, "the picture of the dungeon matches the shared art", l.pictureWrongPct <= 3, l.pictureWrongPct + "% of pixels wrong", "3% or less");
    await V.walkToTile(...G_RUBBLE.stand, 4); await hold("w", 500); l = await V.look("keys-at-the-gate");
    check(V, "the keys walk the mage up against the rubble gate", aimedAt(l) === G_RUBBLE.xy.join() && tile(l, G_RUBBLE.xy).thing === "gate_rubble", { aimed: aimedAt(l), mage: at(l) }, "the mark on " + G_RUBBLE.xy.join());
    s = await hear(V, () => V.page.keyboard.press("2"), 800); l = await V.look("key-2-on-the-rubble");
    check(V, "the 2 key does not open the rubble gate", heard(s) === "no" && tile(l, G_RUBBLE.xy).thing === "gate_rubble", { heard: heard(s), gate: tile(l, G_RUBBLE.xy).thing }, "no.wav, the gate still there");
    s = await hear(V, () => V.page.keyboard.press("1"), 800); l = await V.look("key-1-on-the-rubble");
    check(V, "the 1 key opens it", heard(s) === "gust" && tile(l, G_RUBBLE.xy).thing === null, { heard: heard(s), gate: tile(l, G_RUBBLE.xy).thing }, "gust.wav, the gate gone");
    await V.walkToTile(...G_DIRT.stand, 4); await V.tapTile(...G_DIRT.xy); await V.wait(200); s = await hear(V, () => V.tapButton(BREAK), 800); l = await V.look("mouse-on-the-dirt");
    check(V, "the mouse aims at the packed dirt and casts Break Ground on it", heard(s) === "break_ground" && tile(l, G_DIRT.xy).thing === null, { heard: heard(s), gate: tile(l, G_DIRT.xy).thing }, "break_ground.wav, the gate gone");
    await V.walkToTile(...beside(UP, 0, -1), 4); await hold("ArrowUp", 300); await V.wait(900); l = await V.look("keys-up-the-stairs");
    check(V, "the keys walk the mage back up", l.place === "lot", { place: l.place, mage: at(l) }, "the lot");
    await end(V);
  }

  // ---------------- A short film of the step, for the series ----------------
  async function film(V) {
    await begin(V, true); await V.wait(500); const xp = {};
    await V.walkToTile(...beside(STAIRS, 1, 0), 4); await V.push(1, 0, 300); await V.wait(1800);
    await V.walkToTile(...G_RUBBLE.stand, 4); await V.push(0, -1, 400); await V.wait(500); await V.tapButton(SPROUT); await V.wait(900); await V.tapButton(GUST); await V.wait(900);
    const C = COINS.find((xy) => xy[1] < G_RUBBLE.xy[1] && xy[0] < 4); await route(V, G_RUBBLE.inside, C); await V.wait(700); await route(V, G_RUBBLE.inside, G_RUBBLE.stand, G_BASIN.stand);
    await V.tapTile(...G_BASIN.xy); await V.wait(500); await V.tapButton(DRAW); await V.wait(900); await route(V, G_BASIN.inside, CACHE); await V.wait(900);
    await route(V, G_BASIN.inside, G_BASIN.stand, beside(UP, 0, -1)); await V.push(0, -1, 300); await V.wait(2500); await V.close();
  }

  const views = [
    ["play", { name: "play", width: 288, height: 576, dpr: 1, touch: true }, (V) => play(V)],
    ["phone-sharp", { name: "phone-sharp", width: 390, height: 844, dpr: 3, touch: true }, (V) => size(V, 1)],
    ["phone", { name: "phone", width: 390, height: 844, dpr: 1, touch: true }, (V) => size(V, 1)],
    ["small-phone", { name: "small-phone", width: 360, height: 640, dpr: 1, touch: true }, (V) => size(V, 3)],
    ["phone-sideways", { name: "phone-sideways", width: 640, height: 360, dpr: 2, touch: true }, (V) => size(V, 3)],
    ["pc", { name: "pc", width: 1280, height: 720, dpr: 1, touch: false }, (V) => pc(V)],
    ["film", { name: "film", width: 576, height: 1152, dpr: 1, touch: true, film: "step-08.webm" }, (V) => film(V)],
  ];
  for (const [name, v, run] of views) { if (only && only !== name) continue; console.log("\n" + name + " (" + v.width + "x" + v.height + " @" + v.dpr + ")"); const V = await open(v); try { await run(V); } catch (e) { check(V, "the check ran to its end", false, String(e && e.stack ? e.stack : e).slice(0, 600), "no trouble in the check itself"); try { await V.close(); } catch (e2) { /* already closed */ } } }
  const report = await finish();
  process.exit(report.missed ? 1 : 0);
})();
