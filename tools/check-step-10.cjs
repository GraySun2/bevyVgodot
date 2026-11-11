// The referee's check for step 10, "The prototype", the same for both builds. Like the checks before it, it
// serves a build's web folder the way a plain web host would, opens it in headless Chromium, and plays it with
// real touch events (and, at PC size, the mouse and the keys). Everything it judges it reads from screenshots
// and from what the page sends to the speakers: the six hints of the first loop and when each gives way to the
// next, the two settings under the pause panel, the sound switched off and on, and a saved game erased.
//
//   node tools/check-step-10.cjs <web folder> <folder for screenshots> [one view's name]
//
// Steps 1 to 7 and step 9 still standing is checked by running the older checks on the same build, with
// BUILD_STEP=10. The whole way from the cover to the seed cache is step 9's check on this build.
const path = require("path");
const { K, referee, layoutFor, BUTTONS, SKILLS, PAUSE, SETTINGS } = require("./referee.cjs");

const web = path.resolve(process.argv[2] || "web"), out = path.resolve(process.argv[3] || "check-out"), only = process.argv[4] || "";
const [GUST, BREAK, SPROUT, DRAW] = ["gust", "break_ground", "sprout", "draw"].map((n) => BUTTONS.find((b) => b.name === n));
const PZ = [PAUSE.button.x + 18, PAUSE.button.y + 18], NOWHERE = [170, 30], CRATE = [6, 1], SOUND = [SETTINGS.sound.x + 96, SETTINGS.sound.y + 14], ERASE = [SETTINGS.erase.x + 96, SETTINGS.erase.y + 14];

(async () => {
  const ref = await referee(web, out, 10, layoutFor(Number(process.env.BUILD_STEP || 10)));
  const { open, check, finish, lot, round, at, near, lotThing } = ref;
  const mana = (l) => (l.mana ? l.mana.mana : null);
  const tile = (l, xy) => l.tiles[xy[1]][xy[0]], cnt = (l, n) => (l.counts[n] ? l.counts[n].text : null);
  const counts = (l) => ({ seeds: cnt(l, "seeds"), crops: cnt(l, "crops"), coins: cnt(l, "coins") });
  const heard = (s) => (s.heard ? s.name : "none");
  const untilTime = async (V, t) => { const ms = t - Date.now(); if (ms > 0) await V.wait(ms); };
  const hear = async (V, act, ms = 1000) => { const t = await V.sound.now(); await act(); await V.wait(ms); return V.sound.since(t); };
  const quick = async (V, b, xy, gap = 300) => { if (xy) { await V.tapTile(xy[0], xy[1], 40); await V.wait(80); } await V.tapButton(b, 40); await V.wait(gap); };
  const set = (l) => (l.settings ? l.settings.sound + "/" + l.settings.erase : "none");
  const asMap = (l) => { const wrong = []; for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 9; tx++) { const t = l.tiles[ty][tx]; if (t.thing !== lotThing(tx, ty) || t.ground !== lot.ground_legend[lot.ground[ty][tx]]) wrong.push(tx + "," + ty); } return wrong; };

  // The touch that takes the cover away. From it the referee keeps count of how long the game has stood still
  // since (paused, or the page closed), between two bounds, as in step 7's check.
  async function begin(V, quiet) {
    if (!quiet) check(V, "the cover shows first", V.coverSeen, V.secondsToCover + " s", "the cover with its words");
    await V.tap(...NOWHERE, 250); V.still = { lo: 0, hi: 0 }; await V.wait(900); await V.pace();
    return V.look("start", true);
  }
  const stretch = async (V, start) => { const sLo = Date.now(); await start(); return { sLo, sHi: Date.now() }; };
  const unstretch = async (V, st, stop) => { const eLo = Date.now(); await stop(); const eHi = Date.now(); V.still.lo += Math.max(0, eLo - st.sHi) / 1000; V.still.hi += (eHi - st.sLo) / 1000; };
  function startState(V, l, pct, what = "") {
    check(V, what + "the mage starts below the door, facing down", l.place === "lot" && near(l, K.START.x, K.START.y, 1) && l.mage.facing === "down", at(l), "144, 80, facing down");
    check(V, what + "every tile shows the ground and the thing the shared lot says", asMap(l).length === 0, asMap(l).slice(0, 8), "all 108 tiles right");
    check(V, what + "8 seeds, no crops, no coins, full mana", cnt(l, "seeds") === "8" && cnt(l, "crops") === "0" && cnt(l, "coins") === "0" && mana(l) >= 99, { ...counts(l), mana: mana(l) }, "8, 0, 0, 100");
    check(V, what + "the first hint shows in the top strip: a finger, rubble, an arrow, the purple button", l.hint === 1 && l.hintWrongPixels <= (pct <= 1 ? 6 : 40), { hint: l.hint, wrongPixels: l.hintWrongPixels }, "hint_1 at 132, 6");
    check(V, what + "the picture matches the shared art", l.pictureWrongPct <= pct, l.pictureWrongPct + "% of pixels wrong", pct + "% or less");
  }
  async function end(V) {
    const page = await V.page.evaluate(() => ({ x: window.scrollX, y: window.scrollY, zoom: window.visualViewport ? window.visualViewport.scale : 1, picked: String(window.getSelection ? window.getSelection() : "").length }));
    check(V, "the page did not scroll, zoom or select anything", page.x === 0 && page.y === 0 && page.zoom === 1 && page.picked === 0, page, "still");
    check(V, "no errors on the page", V.errs.length === 0, V.errs.slice(0, 3), "none");
    await V.close();
  }

  // ---------------- The playing view: one picture pixel to one screen pixel ----------------
  async function play(V) {
    let l = await begin(V), s, st; startState(V, l, 1);

    // The hints. Break Ground first: the hint still asks for a Gust.
    await quick(V, BREAK, [4, 3]); l = await V.look("soil-before-any-gust");
    check(V, "soil made before any Gust: the hint still shows the first thing not yet done, the Gust", tile(l, [4, 3]).ground === "soil" && l.hint === 1, { tile: tile(l, [4, 3]).ground, hint: l.hint }, "soil, hint_1");
    await quick(V, GUST, [2, 4]); l = await V.look("gust-done");
    check(V, "after a Gust that clears a tile, with soil already made, the hint is the third: tap soil, then the green button", tile(l, [2, 4]).thing === null && l.hint === 3 && l.hintWrongPixels <= 6, { tile: tile(l, [2, 4]), hint: l.hint, wrongPixels: l.hintWrongPixels }, "hint_3");
    await quick(V, GUST, [4, 3]); l = await V.look("a-gust-that-clears-nothing");
    check(V, "a cast that changes nothing does not move the hint on", l.hint === 3, { hint: l.hint }, "hint_3");
    await quick(V, SPROUT, [4, 3]); l = await V.look("seed-planted");
    check(V, "after a seed is planted, the hint is the fourth: tap the seed, then the blue button", tile(l, [4, 3]).thing === "crop_seed" && l.hint === 4 && l.hintWrongPixels <= 6, { tile: tile(l, [4, 3]), hint: l.hint }, "hint_4");
    const wLo = Date.now(); await V.tapButton(DRAW, 40); const wHi = Date.now(); await V.wait(300); l = await V.look("seed-watered");
    check(V, "after the seed is watered, the hint is the fifth: tap the ripe crop", tile(l, [4, 3]).ground === "soil_wet" && l.hint === 5 && l.hintWrongPixels <= 6 && l.pictureWrongPct <= 1, { tile: tile(l, [4, 3]), hint: l.hint, picture: l.pictureWrongPct }, "hint_5");

    // The two settings, under the pause panel.
    st = await stretch(V, () => V.tap(...PZ)); await V.settle(); l = await V.look("paused-with-the-settings", true);
    check(V, "paused: under the pause panel are the sound setting, on, and the erase setting", !!l.paused && set(l) === "on/plain", { paused: !!l.paused, settings: set(l) }, "set_sound_on at 48, 272 and set_erase at 48, 304");
    check(V, "the picture with the settings on it matches the shared art", l.pictureWrongPct <= 1, l.pictureWrongPct + "% of pixels wrong", "1% or less");
    await V.tap(...SOUND); await V.settle(); l = await V.look("sound-off");
    check(V, "a touch on the sound setting turns it off, and the game stays paused", !!l.paused && set(l) === "off/plain" && l.pictureWrongPct <= 1, { paused: !!l.paused, settings: set(l), picture: l.pictureWrongPct }, "paused, set_sound_off");
    await unstretch(V, st, () => V.tap(...NOWHERE)); await V.settle();
    s = await hear(V, () => quick(V, GUST, [6, 4], 100)); l = await V.look("a-silent-gust");
    check(V, "with the sound off, a Gust still clears its tile and nothing is heard", !l.paused && tile(l, [6, 4]).thing === null && !s.heard, { paused: !!l.paused, tile: tile(l, [6, 4]), heard: heard(s) }, "the tile cleared, no sound");
    // Closed and opened again: the hint and the sound setting were saved.
    st = await stretch(V, () => V.away.hide()); await V.wait(800); await V.reopen(); await unstretch(V, st, () => V.tap(...NOWHERE, 250)); await V.wait(900); await V.pace(); l = await V.look("opened-again", true);
    check(V, "closed and opened again: the hint is where it was", l.hint === 5 && tile(l, [6, 4]).thing === null, { hint: l.hint, tile: tile(l, [6, 4]) }, "hint_5");
    s = await hear(V, () => quick(V, GUST, [2, 0], 100)); l = await V.look("still-silent");
    check(V, "opened again, the sound is still off", tile(l, [2, 0]).thing === null && !s.heard, { tile: tile(l, [2, 0]), heard: heard(s) }, "the tile cleared, no sound");
    st = await stretch(V, () => V.tap(...PZ)); await V.settle(); l = await V.look("paused-again"); const was = set(l); await V.tap(...SOUND); await V.settle(); l = await V.look("sound-on-again");
    check(V, "a second touch on the sound setting turns it back on", was === "off/plain" && set(l) === "on/plain" && !!l.paused, { before: was, after: set(l), paused: !!l.paused }, "off, then on, still paused");
    // The erase setting asks first, and any other touch takes the question back.
    await V.tap(...ERASE); await V.settle(); l = await V.look("erase-asks-first");
    check(V, "a touch on the erase setting asks first: it shows its second picture, and nothing is erased", !!l.paused && set(l) === "on/sure" && l.hint === 5 && l.pictureWrongPct <= 1, { paused: !!l.paused, settings: set(l), hint: l.hint, picture: l.pictureWrongPct }, "paused, set_erase_sure");
    await unstretch(V, st, () => V.tap(...NOWHERE)); await V.settle(); l = await V.look("question-taken-back");
    check(V, "a touch anywhere else ends the pause and erases nothing", !l.paused && tile(l, [4, 3]).ground === "soil_wet" && l.hint === 5, { paused: !!l.paused, tile: tile(l, [4, 3]), hint: l.hint }, "not paused, the farm as it was");
    st = await stretch(V, () => V.tap(...PZ)); await V.settle(); l = await V.look("paused-a-third-time"); await unstretch(V, st, () => V.tap(...NOWHERE)); await V.settle();
    check(V, "paused again, the erase setting shows its first picture again", set(l) === "on/plain", set(l), "on/plain");
    s = await hear(V, () => quick(V, GUST, [3, 2], 100));
    check(V, "with the sound on again, a cast is heard: a Gust on bare grass plays the soft no", heard(s) === "no", { heard: heard(s) }, "no.wav");

    // The crop ripens, is picked and sold: the last two hints, and then none.
    await untilTime(V, wHi + (40 + V.still.hi) * 1000 + 1300); l = await V.look("ripe");
    check(V, "the crop is ripe after 40 seconds of play, and the hint still says to tap it", tile(l, [4, 3]).thing === "crop_ripe" && l.hint === 5, { tile: tile(l, [4, 3]), hint: l.hint, stoodStill: [round(V.still.lo), round(V.still.hi)], secondsSinceWatering: round((Date.now() - wLo) / 1000) }, "crop_ripe, hint_5");
    await V.tapTile(4, 3); await V.wait(600); l = await V.look("picked");
    check(V, "after the crop is picked, the hint is the sixth: tap the crate", cnt(l, "crops") === "1" && l.hint === 6 && l.hintWrongPixels <= 6 && l.pictureWrongPct <= 1, { crops: cnt(l, "crops"), hint: l.hint, picture: l.pictureWrongPct }, "1 crop, hint_6");
    await V.tapTile(...CRATE); await V.wait(600); l = await V.look("sold");
    check(V, "after the first sale there is no hint", cnt(l, "coins") === "5" && l.hint === null && l.hintWrongPixels > 100 && l.pictureWrongPct <= 1, { coins: cnt(l, "coins"), hint: l.hint, picture: l.pictureWrongPct }, "5 coins, no hint, the strip bare there");
    await V.reopen(); await V.tap(...NOWHERE, 250); await V.wait(900); await V.pace(); l = await V.look("opened-after-the-sale");
    check(V, "closed and opened again after the sale: still no hint", cnt(l, "coins") === "5" && l.hint === null, { coins: cnt(l, "coins"), hint: l.hint }, "5 coins, no hint");

    // Erasing the saved game: two touches on the erase setting, and the game starts over as new.
    await V.tap(...PZ); await V.settle(); await V.tap(...ERASE); await V.settle(); l = await V.look("about-to-erase"); await V.tap(...ERASE); const cover = await V.waitCover(30000);
    check(V, "a second touch on the erase setting erases the saved game: the cover shows again", set(l) === "on/sure" && cover, { before: set(l), cover }, "set_erase_sure, then the cover");
    await V.tap(...NOWHERE, 250); await V.wait(900); await V.pace(); l = await V.look("a-new-game", true); startState(V, l, 1, "after erasing, ");
    await V.reopen(); await V.tap(...NOWHERE, 250); await V.wait(900); await V.pace(); l = await V.look("still-a-new-game");
    check(V, "closed and opened again after erasing: the old farm is not back", cnt(l, "coins") === "0" && tile(l, [4, 3]).ground === "grass" && tile(l, [2, 4]).thing === "rubble" && l.hint === 1, { coins: cnt(l, "coins"), tile: tile(l, [4, 3]).ground, rubble: tile(l, [2, 4]).thing, hint: l.hint }, "0 coins, grass at 4,3, the rubble back at 2,4, hint_1");
    s = await hear(V, () => quick(V, GUST, [2, 4], 100));
    check(V, "a new game has its sound on", heard(s) === "gust", { heard: heard(s) }, "gust.wav");
    await end(V);
  }

  // ---------------- The other sizes: the hint and the settings in the picture ----------------
  async function size(V, pct) {
    let l = await begin(V); startState(V, l, pct);
    await V.tap(...PZ); await V.settle(); l = await V.look("paused-with-the-settings", true);
    check(V, "paused: the two settings show, and the picture matches the shared art", !!l.paused && set(l) === "on/plain" && l.pictureWrongPct <= pct, { paused: !!l.paused, settings: set(l), picture: l.pictureWrongPct }, "on/plain, " + pct + "% or less wrong");
    await V.tap(...SOUND); await V.settle(); l = await V.look("sound-off");
    check(V, "a touch on the sound setting lands on it at this size", !!l.paused && set(l) === "off/plain", { paused: !!l.paused, settings: set(l) }, "off/plain, still paused");
    await V.tap(...SOUND); await V.settle(); await V.tap(...NOWHERE); await V.settle(); l = await V.look("going");
    check(V, "the next touch elsewhere ends the pause", !l.paused, { paused: !!l.paused }, "not paused");
    await end(V);
  }

  // ---------------- PC size: the P key and the mouse ----------------
  async function pc(V) {
    let l = await begin(V), s; startState(V, l, 3);
    await V.page.keyboard.press("p"); await V.settle(); l = await V.look("key-p-pauses");
    check(V, "the P key pauses, and the settings show", !!l.paused && set(l) === "on/plain", { paused: !!l.paused, settings: set(l) }, "paused, on/plain");
    await V.tap(...SOUND); await V.settle(); l = await V.look("mouse-turns-the-sound-off"); await V.page.keyboard.press("p"); await V.settle();
    s = await hear(V, () => V.page.keyboard.press("1")); 
    check(V, "a mouse press turns the sound off: a cast is then silent", set(l) === "off/plain" && !s.heard, { settings: set(l), heard: heard(s) }, "off, no sound");
    await V.page.keyboard.press("2"); await V.wait(400); l = await V.look("soil-made");
    await V.page.keyboard.press("p"); await V.settle(); await V.tap(...ERASE); await V.settle(); await V.tap(...ERASE); const cover = await V.waitCover(30000);
    await V.tap(...NOWHERE, 250); await V.wait(900); const n = await V.look("a-new-game");
    check(V, "two mouse presses on the erase setting start the game over", tile(l, [4, 3]).ground === "soil" && cover && tile(n, [4, 3]).ground === "grass" && n.hint === 1, { before: tile(l, [4, 3]).ground, cover, after: tile(n, [4, 3]).ground, hint: n.hint }, "soil, the cover, then grass and hint_1");
    await end(V);
  }

  // ---------------- A short film of the step, for the series ----------------
  async function film(V) {
    await begin(V, true); await V.wait(800);
    await quick(V, GUST, [2, 4], 1200); await quick(V, BREAK, [4, 3], 1200); await quick(V, SPROUT, null, 1200); await quick(V, DRAW, null, 1500);
    await V.tap(...PZ); await V.wait(1500); await V.tap(...SOUND); await V.wait(1200); await V.tap(...SOUND); await V.wait(1200); await V.tap(...ERASE); await V.wait(1500); await V.tap(...NOWHERE); await V.wait(36000);
    await V.tapTile(4, 3); await V.wait(1500); await V.tapTile(...CRATE); await V.wait(2500); await V.close();
  }

  const views = [
    ["play", { name: "play", width: 288, height: 576, dpr: 1, touch: true }, (V) => play(V)],
    ["phone-sharp", { name: "phone-sharp", width: 390, height: 844, dpr: 3, touch: true }, (V) => size(V, 1)],
    ["phone", { name: "phone", width: 390, height: 844, dpr: 1, touch: true }, (V) => size(V, 1)],
    ["small-phone", { name: "small-phone", width: 360, height: 640, dpr: 1, touch: true }, (V) => size(V, 3)],
    ["phone-sideways", { name: "phone-sideways", width: 640, height: 360, dpr: 2, touch: true }, (V) => size(V, 3)],
    ["pc", { name: "pc", width: 1280, height: 720, dpr: 1, touch: false }, (V) => pc(V)],
    ["film", { name: "film", width: 576, height: 1152, dpr: 1, touch: true, film: "step-10.webm" }, (V) => film(V)],
  ];
  for (const [name, v, run] of views) { if (only && only !== name) continue; console.log("\n" + name + " (" + v.width + "x" + v.height + " @" + v.dpr + ")"); const V = await open(v); try { await run(V); } catch (e) { check(V, "the check ran to its end", false, String(e && e.stack ? e.stack : e).slice(0, 600), "no trouble in the check itself"); try { await V.close(); } catch (e2) { /* already closed */ } } }
  const report = await finish();
  process.exit(report.missed ? 1 : 0);
})();
