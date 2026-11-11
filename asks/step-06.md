# Step 6: Skills

Written once, before the step, and sent word for word to both builds.

---

Add to the game. Everything from steps 1 to 5 stays as it is. For this step, add only what is below.

The shared folder has changed. `controls.png` is bigger and `controls.json` lists new pieces on it: `button_skills`, `panel_skills` and `pop_level_up`, and two for a later step. Every piece that was there before is where it was. There are no new sprites and no new sound files: this step uses `level_up.wav`, which is already there. As before, a pixel means one pixel of the sprite sheet, and places are counted from the picture's top-left corner unless it says otherwise.

1. **Four schools.** Each spell trains its own school of magic: Gust trains Air, Break Ground trains Earth, Sprout trains Growth, and Draw trains Water. Each school has a level and some XP. All four start at level 1 with 0 XP.

2. **XP.** A cast that changes something gives its spell's school 10 XP: a Gust that clears a tile, a Break Ground that makes soil, a Sprout that plants a seed, a Draw that waters one. A cast that plays `no.wav` gives nothing, and neither does a cast with too little mana. Picking gives nothing.

3. **Levels.** A school at level 1 needs 100 XP to reach level 2. Each level after that needs 12% more than the one before, to the nearest whole number: 112 to reach level 3, then 125, 140, 157, and so on. When a school's XP reaches what it needs, its level goes up by one and that much XP is taken away, so what is over is kept. Levels do nothing else yet.

4. **The level-up pop.** When a school gains a level, the sound `level_up.wav` plays, and the piece `pop_level_up` (102 by 22 pixels) shows for 1.5 seconds, with its top-left corner 93 pixels from the left and 54 from the top, over the lot and everything on it. The spell's own sound plays too, as before.

5. **The skills button.** In the top strip, draw the piece `button_skills` (36 by 36 pixels) with its top-left corner 204 pixels from the left and 6 from the top. A touch that starts on it opens the skills panel.

6. **The skills panel.** Draw the piece `panel_skills` (256 by 208 pixels) with its top-left corner 16 pixels from the left and 112 from the top, over the lot and everything on it. The piece has a row for each school, from the top: Air, Earth, Growth, Water. It already holds the names, the letters "LV" and four empty bars. On it, for each school:
   - Write the school's level with the digit pieces, after its "LV". The first digit's top-left corner is 228 pixels from the left of the picture, and from the top 148 for Air, 190 for Earth, 232 for Growth and 274 for Water. Each next digit starts 12 pixels further right.
   - Fill the school's bar from the left with the color `#ffd25a`, as far as its XP has come toward the next level. The inside of a bar is 228 pixels wide and 8 tall. Its top-left corner is 30 pixels from the left, and from the top 168 for Air, 210 for Earth, 252 for Growth and 294 for Water. All 228 pixels would be everything the next level needs, none is 0 XP, and in between in proportion, to the nearest pixel.

7. **While the panel is open, the game stands still.** Nothing moves or changes: the mage, the mana, the crops' growing, the weeds' clock, a level-up pop's time. The stick and the spell buttons do nothing, and no tile can be aimed at or picked. The next touch, wherever it starts, closes the panel and does nothing else. Then everything goes on from where it was.

8. **Keys and mouse, for testing.** The K key opens the panel, and closes it. A mouse press works like a touch.

9. **Nothing else.** Levels change nothing about the spells. No selling, no coins.

10. **The web folder.** The same one command still makes the `web` folder. Tell me how big the download is now.

It is done when ten Gusts take Air to level 2, and the panel shows it.
