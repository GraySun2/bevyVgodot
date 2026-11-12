# Step 10: The prototype

Written once, before the step, and sent word for word to both builds.

---

Add to the game. Everything from steps 1 to 9 stays as it is. For this step, add only what is below.

The shared folder has changed. `controls.png` is bigger and `controls.json` lists new pieces on it: six hints, `hint_1` to `hint_6`, and four pieces for two settings, `set_sound_on`, `set_sound_off`, `set_erase` and `set_erase_sure`. Every piece that was there before is where it was. There are no new sprites and no new sounds. As before, a pixel means one pixel of the sprite sheet, and places are counted from the picture's top-left corner unless it says otherwise.

1. **Six things to do once.** The game keeps track of six things the player has done at least once, on the lot, in this order:
   1. a Gust that cleared a tile,
   2. a Break Ground that made soil,
   3. a Sprout that planted a seed,
   4. a Draw that watered a seed,
   5. a ripe crop picked,
   6. a sale at the crate.

2. **The hint.** In the top strip, draw one hint piece (68 by 16 pixels) with its top-left corner 132 pixels from the left and 6 from the top. It is the hint for the first of the six things that has not been done yet: `hint_1` for the first, `hint_2` for the second, and so on. A thing done early still counts, so the hint can skip ahead. Once there has been a sale, no hint is drawn, ever again, whatever else was done or not. The hint shows in the dungeon too. What is done in the dungeon does not count toward the six.

3. **The two settings.** While the game is paused, draw two more pieces under the pause panel, over the lot and everything on it: the sound setting (192 by 28 pixels) with its top-left corner 48 pixels from the left and 272 from the top, and the erase setting (192 by 28 pixels) at 48 from the left and 304 from the top. This is the same whether the pause came from the pause button, the P key, or leaving the page and coming back.

4. **The sound setting.** The sound starts on. Draw `set_sound_on` while it is on and `set_sound_off` while it is off. While the game is paused, a touch that starts on the sound setting switches it, and the game stays paused. While the sound is off, the game plays no sound at all. Everything else goes on as it does with sound.

5. **The erase setting.** Draw `set_erase`. While the game is paused, a touch that starts on the erase setting asks first: the piece changes to `set_erase_sure`, nothing is erased, and the game stays paused. A second touch on it then erases the saved game and starts the game over as new: the cover shows, and behind it is the game as it is the very first time, with nothing saved. After that, closing the page and opening it again must not bring the old game back.

6. **Taking the question back.** While `set_erase_sure` shows, any touch that does not start on the erase setting takes the question back: the next time the game is paused, `set_erase` shows again. A touch on the sound setting still switches the sound. A touch anywhere else still ends the pause, as before.

7. **Saving.** The six things and the sound setting are saved with the rest of the game, and are as they were when the page is opened again. A game saved by an earlier step still opens: its six things count as not done, and its sound is on.

8. **Keys and mouse, for testing.** A mouse press works like a touch on both settings. There are no new keys.

9. **Nothing else.**

10. **The web folder.** The same one command still makes the `web` folder. Tell me how big the download is now.

It is done when a new player gets from the cover to the seed cache with no help, on a phone.
