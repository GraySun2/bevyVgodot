# Step 4: Soil and seeds

Written once, before the step, and sent word for word to both builds.

---

Add to the game. Everything from steps 1 to 3 stays as it is. For this step, add only what is below.

The shared folder has changed. `controls.png` is wider and `controls.json` lists new pieces on it: three small count pictures, and the ten digits, `digit_0` to `digit_9`. Every piece that was there before is where it was. Some of the new pieces are for later steps. Use only the ones named here. As before, a pixel means one pixel of the sprite sheet, and places are counted from the picture's top-left corner unless it says otherwise.

1. **Break Ground.** A second spell, with its own button. Draw the piece `spell_break_ground` (56 by 56 pixels) with its top-left corner 220 pixels from the picture's left edge and 12 pixels below the top of the bottom strip. While the mage has less than 14 mana, draw `spell_break_ground_off` there instead. A touch that starts on the button casts Break Ground once on the aimed tile, the same way a touch on the Gust button casts Gust:
   - With less than 14 mana, nothing at all happens, and there is no sound.
   - If the aimed tile is grass, plain or with flowers, and has nothing on it, the tile turns to soil: from then on its ground is the sprite `soil`. The mana drops by 14. The sound `break_ground.wav` plays.
   - Otherwise, the mana stays as it is and the sound `no.wav` plays. That covers a tile with rubble or weeds still on it, a tile that is already soil, the house, the crate, the stairwell, and no aimed tile at all.

2. **Seeds.** The mage carries seeds. There are 8 when the cover goes away.

3. **The seed count.** In the top strip, draw the piece `icon_seed` (16 by 16 pixels) with its top-left corner 8 pixels from the left and 26 from the top. To its right, write the number of seeds with the digit pieces (each 10 by 14 pixels). The first digit's top-left corner is 28 pixels from the left and 27 from the top, and each next digit starts 12 pixels further right. No zeros in front: 8 is the one digit 8, 12 is two digits, and none left is the one digit 0.

4. **Sprout.** A third spell, with its own button. Draw the piece `spell_sprout` (56 by 56 pixels) with its top-left corner 156 pixels from the picture's left edge and 76 pixels below the top of the bottom strip. While the mage has less than 10 mana, draw `spell_sprout_off` there instead. A touch that starts on the button casts Sprout once on the aimed tile:
   - With less than 10 mana, nothing at all happens, and there is no sound.
   - If the aimed tile is soil with nothing on it, and the mage has at least one seed, a seed is planted: draw the sprite `crop_seed` on the tile, over the soil. The seeds drop by one. The mana drops by 10. The sound `sprout.wav` plays.
   - Otherwise, the mana and the seeds stay as they are and the sound `no.wav` plays. That covers grass, a tile with rubble or weeds on it, soil that already has a seed, the house, the crate, the stairwell, no aimed tile at all, and having no seeds left.

5. **Gust stays as it is.** Gust still clears only rubble and weeds. On soil, and on a planted seed, it changes nothing and plays `no.wav`.

6. **Walking.** Soil and a planted seed do not stop the mage.

7. **Touches.** Each new button works the way the Gust button does: one cast for each touch that starts on it, and the stick and the other touches go on doing their own jobs.

8. **Keys, for testing.** The 2 key casts Break Ground and the 3 key casts Sprout. A mouse press on a button casts, as before.

9. **Nothing else.** The seed does not grow. No water, no picking, no other counts.

10. **The web folder.** The same one command still makes the `web` folder. Tell me how big the download is now.

It is done when a cleared tile becomes soil, then holds a seed, and the count drops by one.
