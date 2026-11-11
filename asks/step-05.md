# Step 5: Water

Written once, before the step, and sent word for word to both builds.

---

Add to the game. Everything from steps 1 to 4 stays as it is. For this step, add only what is below.

Nothing in the shared folder has changed. This step uses pieces, sprites and sounds that are already there: the pieces `spell_draw`, `spell_draw_off` and `icon_crop` on `controls.png`, the sprites `soil_wet`, `crop_sprout`, `crop_grown` and `crop_ripe`, and the sounds `draw.wav` and `pick.wav`. As before, a pixel means one pixel of the sprite sheet, and places are counted from the picture's top-left corner unless it says otherwise.

1. **Draw.** A fourth spell, with its own button. Draw the piece `spell_draw` (56 by 56 pixels) with its top-left corner 220 pixels from the picture's left edge and 76 pixels below the top of the bottom strip. While the mage has less than 10 mana, draw `spell_draw_off` there instead. A touch that starts on the button casts Draw once on the aimed tile:
   - With less than 10 mana, nothing at all happens, and there is no sound.
   - If the aimed tile holds a planted seed that has not been watered, it is watered: from then on the tile's ground is the sprite `soil_wet`. The mana drops by 10. The sound `draw.wav` plays.
   - Otherwise, the mana stays as it is and the sound `no.wav` plays. That covers soil with no seed, a crop that is already watered, grass, a tile with rubble or weeds on it, the house, the crate, the stairwell, and no aimed tile at all.

2. **Growing.** A seed that has not been watered waits, for as long as it takes. A watered one grows by the clock, the same on a fast phone and a slow one. Counted from the moment it is watered: it shows `crop_seed` for the first 10 seconds, `crop_sprout` from 10 seconds, `crop_grown` from 25 seconds, and `crop_ripe` from 40 seconds on. A ripe crop stays ripe. Each crop keeps its own time.

3. **Picking.** A touch that starts on a tile holding a ripe crop picks it, if the tile is no more than 2 tiles across and no more than 2 tiles up or down from the mage's tile. The crop is gone, and the tile's ground is the sprite `grass` again, with nothing on it. The mage has one crop more. The sound `pick.wav` plays. Picking costs no mana and gives no seed back. The touch also aims at the tile, as any touch on a tile in reach does. A touch on a ripe crop farther away does nothing, and a touch on a crop that is not ripe only aims.

4. **The crop count.** The mage carries crops, none when the cover goes away. In the top strip, draw the piece `icon_crop` (16 by 16 pixels) with its top-left corner 72 pixels from the left and 26 from the top. Write the number of crops the way the seeds are written, with the first digit's top-left corner 92 pixels from the left and 27 from the top.

5. **Weeds come back.** Every 45 seconds, counted from when the cover goes away, weeds grow on one tile of bare grass: a tile whose ground is grass, plain or with flowers, with nothing on it. It is the bare grass tile farthest from the mage's tile, counting tiles across plus tiles up or down. If several are as far, it is the one highest up, and of those the one most to the left. With no bare grass at all, nothing grows that time. The clock is the same on a fast phone and a slow one. Weeds never grow on soil, wet or dry.

6. **The other spells on a crop.** Gust, Break Ground and Sprout change nothing on a tile that holds a crop, watered or not, whatever its size, and play `no.wav`. Gust clears the new weeds like any others.

7. **Walking.** Wet soil and a crop of any size do not stop the mage.

8. **Touches.** The Draw button works the way the other buttons do. A touch that starts on the stick or on a button never picks, wherever it slides.

9. **Keys and mouse, for testing.** The 4 key casts Draw. A mouse press on a ripe crop picks it.

10. **Nothing else.** No selling, no coins, no skills.

11. **The web folder.** The same one command still makes the `web` folder. Tell me how big the download is now.

It is done when a watered seed is ripe 40 seconds later, picking it leaves bare ground, and a weed comes back.
