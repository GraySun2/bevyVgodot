# Step 3: The first spell

Written once, before the step, and sent word for word to both builds.

---

Add to the game. Everything from steps 1 and 2 stays as it is. For this step, add only what is below.

The shared folder has changed. `controls.png` is bigger and `controls.json` lists new pieces on it: `aim`, and two for each spell button. The two stick pieces are where they were. There are new sound files, and `sounds.json` says what each one is. Some of the new pieces and sounds are for later steps. Use only the ones named here. As before, a pixel means one pixel of the sprite sheet, and places are counted from the picture's top-left corner unless it says otherwise.

1. **Mana.** The mage has mana. It is 100 when the cover goes away, and 100 is as high as it goes. It comes back by itself, all the time, at 6.5 a second, the same on a fast phone and a slow one.

2. **The mana bar.** In the top strip, draw a box 120 pixels wide and 12 tall, with its top-left corner 8 pixels from the left and 8 from the top. Its 1 pixel border is the color `#fff4d8`. That leaves 118 by 10 inside. The inside is `#5ac8e8` from the left for the mana the mage has, and `#1f3a36` for the rest: 118 pixels of `#5ac8e8` at 100 mana, none at 0, and in between in proportion, to the nearest pixel.

3. **The aimed tile.** The mage's tile is the tile under the middle of its sprite. The aimed tile is the next tile from the mage's tile, the way the mage faces. Draw the piece `aim` on the aimed tile, over the ground and whatever is on the tile, and under the mage. If the next tile would be off the lot, no tile is aimed and the mark does not show.

4. **Aiming by touch.** A touch that starts on a tile of the lot aims at that tile, if the tile is no more than 2 tiles across and no more than 2 tiles up or down from the mage's tile. The mage's own tile counts. The mark moves there at once. That tile stays the aimed tile until the mage's tile changes or the mage turns to face another way. Then the aimed tile is the one in front again. A touch on a tile farther away does nothing.

5. **The Gust button.** In the bottom strip, draw the piece `spell_gust` (56 by 56 pixels) with its top-left corner 156 pixels from the picture's left edge and 12 pixels below the top of the bottom strip. While the mage has less than 8 mana, draw `spell_gust_off` there instead.

6. **Casting Gust.** A touch that starts on the button casts Gust once on the aimed tile. Holding the touch down does nothing more. What a cast does:
   - With less than 8 mana, nothing at all happens, and there is no sound.
   - If the aimed tile has rubble or weeds on it, they are gone and the ground under them shows. The mana drops by 8. The sound `gust.wav` plays.
   - Otherwise, the mana stays as it is and the sound `no.wav` plays. That covers a tile with nothing to clear, the house, the crate, the stairwell, and no aimed tile at all.

7. **Two thumbs.** The thumb on the stick, a touch on a tile and a touch on the button are separate touches, and each does its own job while the others are down. The mage can walk while the other thumb aims and casts. A touch that starts on the lot or on the button never works the stick. The stick's touch does not aim or cast, wherever it slides.

8. **Sound.** No sound plays before the tap that takes the cover away. Each cast plays its sound once, from the start, and sounds may overlap.

9. **Keys and mouse, for testing.** The 1 key casts Gust. A mouse press works like a touch: on a tile it aims, on the button it casts.

10. **Nothing else.** No other spells, no soil, no counts.

11. **The web folder.** The same one command still makes the `web` folder. Tell me how big the download is now.

It is done when Gust clears a rubble tile, the mana drops and comes back, and you can hear it on a phone.
