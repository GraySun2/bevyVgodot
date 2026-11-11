// The referee's check for step 7, "Sell, save, and a phone call", the same for both builds. Like the checks
// before it, it serves a build's web folder the way a plain web host would, opens it in headless Chromium, and
// plays it with real touch events (and, at PC size, the mouse and the keys). Everything it judges it reads from
// screenshots and from what the page sends to the speakers: the coin count, a sale at the crate, the pause
// button and its panel, the game standing still while the page is hidden, and the same farm after the page
// is closed and opened again.
//
//   node tools/check-step-07.cjs <web folder> <folder for screenshots> [one view's name]
//
// The test browser never really hides a page, so the kit tells the page it is hidden (see "Leaving the page
// and coming back" in referee.cjs). The switch to another app on a real phone is still a person's check.
// Steps 1 to 6 still standing is checked by running the older checks on the same build, with BUILD_STEP=7.
const path = require("path");
const { K, referee, layoutFor, BUTTONS, SKILLS, PAUSE } = require("./referee.cjs");

const web = path.resolve(process.argv[2] || "web"), out = path.resolve(process.argv[3] || "check-out"), only = process.argv[4] || "";
const [GUST, BREAK, SPROUT, DRAW] = ["gust", "break_ground", "sprout", "draw"].map((n) => BUTTONS.find((b) => b.name === n));
const BACK = 6.5, WEEDS = 45, BARW = SKILLS.bar.w, SK = [SKILLS.button.x + 18, SKILLS.button.y + 18], PZ = [PAUSE.button.x + 18, PAUSE.button.y + 18], NOWHERE = [170, 12], CRATE = [6, 1];
const needXp = (level) => Math.round(100 * Math.pow(1.12, level - 1)), fillFor = (xp, level) => Math.round((BARW * xp) / needXp(level));
const mid = (b) => [b.x + 28, b.y + 28];

(async () => {
  const ref = await referee(web, out, 7, layoutFor(Number(process.env.BUILD_STEP || 7)));
  const { open, check, finish, lot, round, at, near, knobAt, aimedAt, lotThing } = ref;
  const bar = (l) => (l.mana ? l.mana.filledPixels : null), mana = (l) => (l.mana ? l.mana.mana : null);
  const tile = (l, xy) => l.tiles[xy[1]][xy[0]], cnt = (l, n) => (l.counts[n] ? l.counts[n].text : null);
  const counts = (l) => ({ seeds: cnt(l, "seeds"), crops: cnt(l, "crops"), coins: cnt(l, "coins") });
  const heard = (s) => (s.heard ? s.name : "none");
  // A tile as the player sees it, weeds left out: they come back by themselves.
  const sig = (t) => t.ground + "/" + (t.thing === "weeds" ? null : t.thing), sigs = (l) => l.tiles.flat().map(sig).join();
  const diff = (a, b) => { const d = []; for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 9; tx++) if (sig(a.tiles[ty][tx]) !== sig(b.tiles[ty][tx])) d.push(tx + "," + ty + " " + sig(b.tiles[ty][tx]) + " was " + sig(a.tiles[ty][tx])); return d; };
  const weeds = (l) => l.tiles.flat().filter((t) => t.thing === "weeds").length;
  const panel = (l) => (l.panel ? SKILLS.schools.map((n) => l.panel.schools[n].level + ":" + l.panel.schools[n].fill).join(" ") : "closed");
  const wantPanel = (xp) => SKILLS.schools.map((n) => { let level = 1, x = xp[n] || 0; while (x >= needXp(level)) { x -= needXp(level); level++; } return level + ":" + fillFor(x, level); }).join(" ");
  const untilTime = async (V, t) => { const ms = t - Date.now(); if (ms > 0) await V.wait(ms); };
  const hear = async (V, act, ms = 1000) => { const t = await V.sound.now(); await act(); await V.wait(ms); return V.sound.since(t); };

  // The touch that takes the cover away. From it the referee keeps the game's own clock: the time since the
  // cover went, less every stretch the game stood still (paused, a panel open, the page hidden or closed).
  // Each stretch is known only between two bounds, so the clock is too: "lo" and "hi".
  async function begin(V, quiet) {
    if (!quiet) check(V, "the cover shows first", V.coverSeen, V.secondsToCover + " s", "the cover with its words");
    V.coverLo = Date.now(); await V.tap(...NOWHERE, 250); V.coverHi = Date.now(); V.still = { lo: 0, hi: 0 }; await V.wait(900); await V.pace();
    return V.look("start", true);
  }
  const stood = (V, sLo, sHi, eLo, eHi) => { V.still.lo += Math.max(0, eLo - sHi) / 1000; V.still.hi += (eHi - sLo) / 1000; };
  // A stretch standing still, begun by "start" and ended by "stop", each an act of the referee's.
  async function stretch(V, start) { const sLo = Date.now(); await start(); const sHi = Date.now(); return { sLo, sHi }; }
  async function unstretch(V, st, stop) { const eLo = Date.now(); await stop(); const eHi = Date.now(); stood(V, st.sLo, st.sHi, eLo, eHi); }
  const pause = (V, press) => stretch(V, press || (() => V.tap(...PZ)));

  function startState(V, l, pct) {
    check(V, "the mage starts below the door, facing down", near(l, K.START.x, K.START.y, 1) && l.mage.facing === "down", at(l), "144, 80, facing down");
    const wrong = []; for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 9; tx++) { const t = l.tiles[ty][tx]; if (t.thing !== lotThing(tx, ty) || t.ground !== lot.ground_legend[lot.ground[ty][tx]]) wrong.push(tx + "," + ty); }
    check(V, "every tile shows the ground and the thing the shared lot says", wrong.length === 0, wrong, "all 108 tiles right");
    check(V, "the coin picture is in the top strip, and the coin count says 0", l.counts.coins && l.counts.coins.iconWrongPixels <= (pct <= 1 ? 6 : 30) && cnt(l, "coins") === "0", l.counts.coins, "icon_coin at 136, 26, the digit 0 at 156, 27");
    check(V, "the pause button is in the top strip", l.pauseButton && l.pauseButton.shows && l.pauseButton.wrongPixels <= (pct <= 1 ? 8 : 60), l.pauseButton, "button_pause at 246, 6");
    check(V, "the game is not paused, and no panel is open", !l.paused && !l.panel, { paused: !!l.paused, panel: panel(l) }, "neither");
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
  // One cast for setting things up: aim (if a tile is given), then the button.
  const quick = async (V, b, xy, gap = 150) => { if (xy) { await V.tapTile(xy[0], xy[1], 40); await V.wait(80); } await V.tapButton(b, 40); await V.wait(gap); };

  // ---------------- The playing view: one picture pixel to one screen pixel ----------------
  async function play(V) {
    let l = await begin(V), s, a, b, st; startState(V, l, 1); const xp = { air: 0, earth: 0, growth: 0, water: 0 };

    // The crate with nothing to sell: the soft "no", and the touch aims at the crate.
    s = await hear(V, () => V.tapTile(...CRATE)); l = await V.look("crate-with-no-crops");
    check(V, "a touch on the crate with no crops changes nothing and plays the soft no", heard(s) === "no" && cnt(l, "coins") === "0" && cnt(l, "crops") === "0", { heard: heard(s), ...counts(l) }, "no.wav, 0 coins");
    check(V, "the touch aims at the crate's tile", aimedAt(l) === CRATE.join(), aimedAt(l), CRATE.join());

    // Two crops, planted and watered from the starting tile. They grow while the pause is tried.
    await quick(V, BREAK, [4, 3], 300); await quick(V, SPROUT, null, 300); const w1Lo = Date.now(); await V.tapButton(DRAW, 40); const w1Hi = Date.now(), S1 = { ...V.still }; await V.wait(300);
    await quick(V, BREAK, [3, 3], 300); await quick(V, SPROUT, null, 300); await V.tapButton(DRAW, 40); const w2Hi = Date.now(); await V.wait(300);
    xp.earth += 20; xp.growth += 20; xp.water += 20;
    await V.tapTile(2, 4); await V.settle(); a = await V.look("two-crops-watered");
    check(V, "the farm from the steps before still works: two seeds planted and watered", [[4, 3], [3, 3]].every((xy) => tile(a, xy).ground === "soil_wet" && tile(a, xy).thing === "crop_seed") && cnt(a, "seeds") === "6" && aimedAt(a) === "2,4", { a: tile(a, [4, 3]), b: tile(a, [3, 3]), seeds: cnt(a, "seeds"), aimed: aimedAt(a) }, "two watered seeds, 6 seeds left, the mark on 2,4");

    // The pause button.
    st = await pause(V); await V.settle(); l = await V.look("paused", true);
    check(V, "a touch on the pause button shows the pause panel", !!l.paused && l.paused.wrongPct <= 2, l.paused, "panel_pause at 48, 212");
    check(V, "the picture with the pause panel on it matches the shared art", l.pictureWrongPct <= 1, l.pictureWrongPct + "% of pixels wrong", "1% or less");
    await V.wait(2000); b = await V.look("still-paused");
    check(V, "while the game is paused, the mana stands still", mana(l) < 95 && bar(b) === bar(l) && !!b.paused, { atFirst: mana(l), twoSecondsLater: mana(b), paused: !!b.paused }, "the same bar two seconds later, under 95");
    // A touch on a spell button ends the pause and casts nothing: the rubble at the aimed tile stays.
    { const t = await V.sound.now(); await unstretch(V, st, () => V.tap(...mid(GUST))); await V.wait(600); s = await V.sound.since(t); l = await V.look("pause-ended-by-a-button"); }
    check(V, "the next touch ends the pause", !l.paused, { paused: !!l.paused }, "no pause panel");
    check(V, "a touch on a spell button that ends the pause casts nothing", !s.heard && tile(l, [2, 4]).thing === "rubble" && bar(l) >= bar(b), { heard: heard(s), tile: tile(l, [2, 4]), mana: mana(l) }, "no sound, the rubble still there, no mana spent");
    // A touch on the stick ends the pause and does nothing else.
    st = await pause(V); await V.settle();
    await unstretch(V, st, () => V.finger.down(1, K.STICK.x, K.STICK.y)); await V.finger.slide(1, K.STICK.x - 45, K.STICK.y); await V.wait(600); l = await V.look("pause-ended-by-the-stick"); await V.finger.lift(1); await V.settle();
    check(V, "a touch on the stick that ends the pause does not move the mage", !l.paused && near(l, K.START.x, K.START.y, 1) && knobAt(l, 0, 0, 1), { paused: !!l.paused, mage: at(l), knob: l.knob }, "not paused, the mage where it was, the knob at rest");

    // Leaving and coming back: the page is hidden for five seconds.
    a = await V.look("before-leaving"); st = await stretch(V, () => V.away.hide()); await V.wait(5000); await V.away.show(); await V.settle(); l = await V.look("back-again", true);
    check(V, "coming back to the page, the game is paused and the pause panel shows", !!l.paused && l.paused.wrongPct <= 2, l.paused, "panel_pause at 48, 212");
    { const most = mana(a) + (BACK * (st.sHi - a.at)) / 1000 + 2;
      check(V, "while the page was hidden, the game stood still: the mana is where it was", mana(a) < 90 && mana(l) <= most && mana(l) >= mana(a) - 1, { before: mana(a), back: mana(l), atMost: round(most) }, "what it was when the page was hidden"); }
    await V.wait(1500); b = await V.look("back-and-still-paused");
    check(V, "it stays paused until the next touch", !!b.paused && bar(b) === bar(l), { paused: !!b.paused, mana: [mana(l), mana(b)] }, "paused, the same bar");
    { const t = await V.sound.now(); await unstretch(V, st, () => V.tap(...mid(GUST))); await V.wait(600); s = await V.sound.since(t); l = await V.look("back-and-going"); }
    check(V, "the next touch ends that pause too, and does nothing else", !l.paused && !s.heard && tile(l, [2, 4]).thing === "rubble", { paused: !!l.paused, heard: heard(s), tile: tile(l, [2, 4]) }, "not paused, no sound, the rubble still there");
    s = await hear(V, () => V.tapButton(GUST)); l = await V.look("gust-after-coming-back"); xp.air += 10;
    check(V, "after coming back, the game goes on and its sounds still play", heard(s) === "gust" && tile(l, [2, 4]).thing === null, { heard: heard(s), tile: tile(l, [2, 4]) }, "gust.wav, the rubble gone");
    // Hidden with the skills panel open: back to the pause panel, and the skills panel closed.
    st = await stretch(V, () => V.tap(...SK)); await V.settle(); await V.away.hide(); await V.wait(2000); await V.away.show(); await V.settle(); l = await V.look("back-with-the-skills-panel-closed", true);
    check(V, "hidden while the skills panel was open: coming back shows the pause panel, and the skills panel is closed", !!l.paused && !l.panel, { paused: !!l.paused, panel: panel(l) }, "paused, the skills panel closed");
    await unstretch(V, st, () => V.tap(...NOWHERE)); await V.settle(); l = await V.look("going-again");
    check(V, "and the next touch goes on with no panel open", !l.paused && !l.panel, { paused: !!l.paused, panel: panel(l) }, "neither");

    // The first crop is ripe 40 seconds of play after it was watered: the pauses and the time away do not count.
    const P1 = { lo: V.still.lo - S1.lo, hi: V.still.hi - S1.hi };
    await untilTime(V, w1Lo + (40 + P1.lo) * 1000 - 1300); a = await V.look("ripe-before"); await untilTime(V, w1Hi + (40 + P1.hi) * 1000 + 1200); b = await V.look("ripe-after");
    check(V, "the crop's growing stood still while paused and while away: it is ripe 40 seconds of play after it was watered", P1.lo >= 9 && a.at < w1Lo + (40 + P1.lo) * 1000 - 400 && tile(a, [4, 3]).thing === "crop_grown" && tile(b, [4, 3]).thing === "crop_ripe",
      { stoodStillFor: [round(P1.lo), round(P1.hi)], justBefore: tile(a, [4, 3]).thing, justAfter: tile(b, [4, 3]).thing }, "crop_grown, then crop_ripe");
    await untilTime(V, w2Hi + (40 + P1.hi) * 1000 + 1200);

    // Picking both, then the crate from too far away: nothing at all.
    await V.tapTile(4, 3); await V.wait(500); await V.tapTile(3, 3); await V.wait(500); await V.walkToTile(4, 5, 6); a = await V.look("two-crops-carried");
    s = await hear(V, () => V.tapTile(...CRATE)); l = await V.look("crate-too-far");
    check(V, "a touch on the crate from more than 2 tiles away does nothing at all", cnt(a, "crops") === "2" && cnt(l, "crops") === "2" && cnt(l, "coins") === "0" && !s.heard && aimedAt(l) === aimedAt(a), { before: counts(a), after: counts(l), heard: heard(s), aimed: [aimedAt(a), aimedAt(l)] }, "2 crops, 0 coins, no sound, the mark where it was");
    // The sale.
    await V.walkToTile(4, 2, 6); a = await V.look("before-the-sale"); s = await hear(V, () => V.tapTile(...CRATE)); l = await V.look("sold");
    check(V, "a touch on the crate within 2 tiles sells every crop for 5 coins each", cnt(l, "coins") === "10" && cnt(l, "crops") === "0", counts(l), "10 coins, 0 crops");
    check(V, "the coin count is written with the digit pieces in their places", l.counts.coins && l.counts.coins.wrongPixels <= 8 && l.pictureWrongPct <= 1, { coins: l.counts.coins, picture: l.pictureWrongPct }, "1 at 156, 27 and 0 at 168, 27");
    check(V, "the sale plays sell.wav", heard(s) === "sell", { heard: heard(s), seconds: s.seconds, hz: s.hz }, "sell.wav");
    check(V, "selling costs no mana, and the touch aims at the crate", bar(l) >= bar(a) && aimedAt(l) === CRATE.join(), { mana: [mana(a), mana(l)], aimed: aimedAt(l) }, "no mana spent, the mark on 6,1");
    s = await hear(V, () => V.tapTile(...CRATE)); l = await V.look("nothing-left-to-sell");
    check(V, "a second touch sells nothing more", cnt(l, "coins") === "10" && heard(s) === "no", { ...counts(l), heard: heard(s) }, "10 coins still, no.wav");

    // A farm worth saving: four tiles of soil, a dry seed, a watered seed, and mana well under full.
    await need(V, 97);
    await quick(V, BREAK, [5, 2]); await quick(V, BREAK, [5, 3]); await quick(V, BREAK, [3, 3]); await quick(V, SPROUT, null); await quick(V, BREAK, [4, 3]); await quick(V, SPROUT, null); xp.earth += 40; xp.growth += 20;
    st = await stretch(V, () => V.tap(...SK)); await V.settle(); l = await V.look("panel-before-closing", true); await unstretch(V, st, () => V.tap(...NOWHERE)); await V.settle();
    check(V, "selling gives no XP, and the casts so far show on the skills panel", panel(l) === wantPanel(xp), panel(l), wantPanel(xp));
    const w3Lo = Date.now(); await V.tapButton(DRAW, 40); const w3Hi = Date.now(), S3 = { ...V.still }; xp.water += 10; await V.wait(250);
    const L0 = await V.look("the-farm-before-closing");
    check(V, "the farm before the page is closed", tile(L0, [4, 3]).ground === "soil_wet" && tile(L0, [4, 3]).thing === "crop_seed" && tile(L0, [3, 3]).ground === "soil" && tile(L0, [3, 3]).thing === "crop_seed" && tile(L0, [5, 2]).ground === "soil" && tile(L0, [5, 3]).ground === "soil" && cnt(L0, "seeds") === "4" && mana(L0) < 70,
      { watered: tile(L0, [4, 3]), dry: tile(L0, [3, 3]), soil: [tile(L0, [5, 2]).ground, tile(L0, [5, 3]).ground], ...counts(L0), mana: mana(L0) }, "a watered seed, a dry seed, two bare soil tiles, 4 seeds, mana under 70");

    // Close the page and open it again. The game stands still from the moment the page is hidden to the touch on the cover.
    let hid = await stretch(V, () => V.away.hide()); await V.wait(1000); await V.reopen();
    check(V, "opened again, the cover shows first", V.coverSeen, V.secondsToCover + " s", "the cover with its words");
    await unstretch(V, hid, () => V.tap(...NOWHERE, 250)); const backAt = Date.now(); await V.wait(900); await V.pace(); const L1 = await V.look("opened-again", true);
    check(V, "opened again, the mage stands on its starting tile facing down", near(L1, K.START.x, K.START.y, 1) && L1.mage.facing === "down", at(L1), "144, 80, facing down");
    check(V, "opened again, every tile is as it was: the same farm", diff(L0, L1).length === 0, diff(L0, L1).slice(0, 8), "no tile different");
    check(V, "opened again, the seeds, crops and coins are as they were", JSON.stringify(counts(L1)) === JSON.stringify(counts(L0)), counts(L1), JSON.stringify(counts(L0)));
    { const want = mana(L0) + (BACK * (hid.sHi - L0.at + (L1.at - backAt))) / 1000;
      check(V, "opened again, the mana goes on from where it was saved", mana(L1) < 96 && Math.abs(mana(L1) - want) <= 5, { before: mana(L0), now: mana(L1), wouldBe: round(want) }, "within 5 of what it would be with no time passed"); }
    check(V, "opened again, the game is not paused and no panel is open", !L1.paused && !L1.panel, { paused: !!L1.paused, panel: panel(L1) }, "neither");
    check(V, "opened again, the picture matches the shared art", L1.pictureWrongPct <= 1, L1.pictureWrongPct + "% of pixels wrong", "1% or less");
    // No time passed while the page was closed: the watered seed sprouts 10 seconds of play after it was watered.
    const P3 = { lo: V.still.lo - S3.lo, hi: V.still.hi - S3.hi };
    await untilTime(V, w3Lo + (10 + P3.lo) * 1000 - 1300); a = await V.look("sprout-before"); await untilTime(V, w3Hi + (10 + P3.hi) * 1000 + 1200); b = await V.look("sprout-after");
    check(V, "the crop's growing was saved, and no time passed while the page was closed: it sprouts 10 seconds of play after it was watered", a.at < w3Lo + (10 + P3.lo) * 1000 - 400 && tile(a, [4, 3]).thing === "crop_seed" && tile(b, [4, 3]).thing === "crop_sprout",
      { closedFor: [round(P3.lo), round(P3.hi)], justBefore: tile(a, [4, 3]).thing, justAfter: tile(b, [4, 3]).thing }, "crop_seed, then crop_sprout");
    st = await stretch(V, () => V.tap(...SK)); await V.settle(); l = await V.look("panel-opened-again", true); await unstretch(V, st, () => V.tap(...NOWHERE)); await V.settle();
    check(V, "opened again, every school's level and XP are as they were", panel(l) === wantPanel(xp), panel(l), wantPanel(xp));
    // Saved every 30 seconds: a Gust, 31 seconds of play, then the page shut with no warning at all.
    s = await hear(V, () => quick(V, GUST, [6, 4])); const gustAt = Date.now(); xp.air += 10; l = await V.look("gust-before-the-wait");
    check(V, "a Gust clears the weeds at 6,4", tile(l, [6, 4]).thing === null && heard(s) === "gust", { tile: tile(l, [6, 4]), heard: heard(s) }, "cleared, gust.wav");
    // Meanwhile, the weeds' clock was saved too: its next moment comes at a whole number of 45 seconds of play.
    { const lo = (Date.now() - V.coverHi) / 1000 - V.still.hi, n = Math.floor((lo + 3) / WEEDS) + 1;
      await untilTime(V, V.coverLo + (n * WEEDS + V.still.lo) * 1000 - 1500); a = await V.look("weeds-before"); await untilTime(V, V.coverHi + (n * WEEDS + V.still.hi) * 1000 + 1300); b = await V.look("weeds-after");
      check(V, "the weeds' clock was saved: the next weeds grow " + n * WEEDS + " seconds of play after the cover first went away", weeds(b) === weeds(a) + 1, { weedsBefore: weeds(a), weedsAfter: weeds(b), stoodStillFor: [round(V.still.lo), round(V.still.hi)] }, "one more tile of weeds"); }

    await untilTime(V, gustAt + 31500); await V.reopen({ deaf: true }); await V.tap(...NOWHERE, 250); await V.wait(900); await V.pace(); l = await V.look("opened-after-no-warning");
    check(V, "the game saves every 30 seconds: shut with no warning 31 seconds after a Gust, the tile is still cleared", l.tiles[4][6].thing === null && cnt(l, "coins") === "10", { tile: tile(l, [6, 4]), ...counts(l) }, "6,4 cleared, 10 coins");
    // Saved when the page is hidden: a Gust, and the page hidden and closed a moment later.
    await need(V, 20); await quick(V, GUST, [2, 0], 250); a = await V.look("gust-before-closing");
    await V.reopen(); await V.tap(...NOWHERE, 250); await V.wait(900); await V.pace(); l = await V.look("opened-a-third-time");
    check(V, "the game saves when the page is hidden: closed a moment after a Gust, the tile is still cleared", tile(a, [2, 0]).thing === null && tile(l, [2, 0]).thing === null, { before: tile(a, [2, 0]), after: tile(l, [2, 0]) }, "2,0 cleared both times");
    check(V, "the picture still matches the shared art", l.pictureWrongPct <= 1, l.pictureWrongPct + "% of pixels wrong", "1% or less");
    await end(V);
  }

  // ---------------- The other sizes: the count, the button, the panel, and coming back ----------------
  async function size(V, pct) {
    let l = await begin(V); startState(V, l, pct);
    await V.tap(...PZ); await V.settle(); l = await V.look("paused", true);
    check(V, "a touch on the pause button shows the pause panel, and it matches the shared art", !!l.paused && l.pictureWrongPct <= pct, { paused: l.paused, picture: l.pictureWrongPct }, "panel_pause, " + pct + "% or less wrong");
    await V.tap(...NOWHERE); await V.settle(); l = await V.look("going");
    check(V, "the next touch ends the pause", !l.paused, { paused: !!l.paused }, "no pause panel");
    await V.away.hide(); await V.wait(1500); await V.away.show(); await V.settle(); l = await V.look("back-again");
    check(V, "coming back to the page, the pause panel shows", !!l.paused, { paused: !!l.paused }, "paused");
    await V.tap(...NOWHERE); await V.settle(); l = await V.look("going-again");
    check(V, "and the next touch goes on", !l.paused, { paused: !!l.paused }, "no pause panel");
    await end(V);
  }

  // ---------------- PC size: the P key and the mouse ----------------
  async function pc(V) {
    let l = await begin(V), s; startState(V, l, 3);
    await V.page.keyboard.press("p"); await V.settle(); l = await V.look("key-p-pauses");
    check(V, "the P key pauses", !!l.paused, { paused: !!l.paused }, "paused");
    await V.page.keyboard.press("p"); await V.settle(); l = await V.look("key-p-goes-on");
    check(V, "and the P key ends the pause", !l.paused, { paused: !!l.paused }, "not paused");
    await V.tap(...PZ); await V.settle(); l = await V.look("mouse-pauses");
    check(V, "a mouse press on the pause button pauses", !!l.paused, { paused: !!l.paused }, "paused");
    await V.tap(...NOWHERE); await V.settle();
    // A crop grown with the keys, picked and sold with the mouse.
    await V.page.keyboard.press("2"); await V.wait(300); await V.page.keyboard.press("3"); await V.wait(300); await V.page.keyboard.press("4"); await V.wait(41500);
    await V.tapTile(4, 3); await V.wait(500); s = await hear(V, () => V.tapTile(...CRATE)); l = await V.look("mouse-sells");
    check(V, "a mouse press on the crate sells", cnt(l, "coins") === "5" && cnt(l, "crops") === "0" && heard(s) === "sell", { ...counts(l), heard: heard(s) }, "5 coins, 0 crops, sell.wav");
    await V.reopen(); await V.tap(...NOWHERE, 250); await V.wait(900); await V.pace(); l = await V.look("opened-again");
    check(V, "closed and opened again at PC size, the coins are still there", cnt(l, "coins") === "5" && tile(l, [4, 3]).ground === "grass", { ...counts(l), tile: tile(l, [4, 3]) }, "5 coins, the picked tile bare");
    await end(V);
  }

  // ---------------- A short film of the step, for the series ----------------
  async function film(V) {
    await begin(V, true); await V.wait(500);
    await quick(V, BREAK, [4, 3], 500); await quick(V, SPROUT, null, 500); await quick(V, DRAW, null, 700); await quick(V, BREAK, [3, 3], 500); await quick(V, SPROUT, null, 500); await quick(V, DRAW, null, 700);
    await V.wait(6000); await V.tap(...PZ); await V.wait(2500); await V.tap(...NOWHERE); await V.wait(33000);
    await V.tapTile(4, 3); await V.wait(900); await V.tapTile(3, 3); await V.wait(1200); await V.tapTile(...CRATE); await V.wait(2500);
    await V.reopen(); await V.wait(1200); await V.tap(...NOWHERE, 250); await V.wait(4000); await V.close();
  }

  const views = [
    ["play", { name: "play", width: 288, height: 576, dpr: 1, touch: true }, (V) => play(V)],
    ["phone-sharp", { name: "phone-sharp", width: 390, height: 844, dpr: 3, touch: true }, (V) => size(V, 1)],
    ["phone", { name: "phone", width: 390, height: 844, dpr: 1, touch: true }, (V) => size(V, 1)],
    ["small-phone", { name: "small-phone", width: 360, height: 640, dpr: 1, touch: true }, (V) => size(V, 3)],
    ["phone-sideways", { name: "phone-sideways", width: 640, height: 360, dpr: 2, touch: true }, (V) => size(V, 3)],
    ["pc", { name: "pc", width: 1280, height: 720, dpr: 1, touch: false }, (V) => pc(V)],
    ["film", { name: "film", width: 576, height: 1152, dpr: 1, touch: true, film: "step-07.webm" }, (V) => film(V)],
  ];
  for (const [name, v, run] of views) { if (only && only !== name) continue; console.log("\n" + name + " (" + v.width + "x" + v.height + " @" + v.dpr + ")"); const V = await open(v); try { await run(V); } catch (e) { check(V, "the check ran to its end", false, String(e && e.stack ? e.stack : e).slice(0, 600), "no trouble in the check itself"); try { await V.close(); } catch (e2) { /* already closed */ } } }
  const report = await finish();
  process.exit(report.missed ? 1 : 0);
})();
