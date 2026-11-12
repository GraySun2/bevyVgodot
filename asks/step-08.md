# Step 8: Down the stairs

Written once, before the step, and sent word for word to both builds.

---

Add to the game. Everything from steps 1 to 7 stays as it is. For this step, add only what is below.

The shared folder has changed. There is one new file, `dungeon.json`: the map of the dungeon floor, written the same way as `lot.json`. Nothing else has changed. This step uses sprites that are already on the sprite sheet: `floor`, `wall`, `stairs_up`, `gate_rubble`, `gate_dirt`, `gate_vine`, `gate_basin`, `coins` and `cache`. As before, a pixel means one pixel of the sprite sheet, and places are counted from the picture's top-left corner unless it says otherwise.

1. **Two places.** The game now has two places: the lot, and the dungeon floor under it. Only one shows at a time. The dungeon is 9 tiles wide and 12 tall and is drawn exactly where the lot is drawn. Draw it the way the lot is drawn: the ground of every tile from `dungeon.json`, then the things on the tiles, then the aim mark, then the mage. The two strips and everything on them stay as they are in both places.

2. **Going down.** When the mage's tile becomes the lot's stairwell tile, the mage goes down. It is then in the dungeon, standing on the middle of the `stairs_up` tile, facing down.

3. **Coming up.** When the mage's tile becomes the `stairs_up` tile, the mage goes up. It is then on the lot, standing on the middle of the stairwell tile, facing down.

4. **Arriving is not using.** Arriving on a stairs tile does not use it. The stairs work only when the mage's tile becomes that tile from another tile, so the mage has to step off and walk back on.

5. **The fade.** Going down or coming up takes half a second. Over the first quarter of a second, the place (the 288 by 384 pixels where the lot is drawn) darkens evenly to the color `#2a1a14`. Then the other place, with the mage already standing on its stairs, comes out of the dark over the next quarter of a second. During that half second nothing moves or changes: the mage, the mana, the crops, the weeds' clock. No spell can be cast and no tile aimed at.

6. **Walls and gates.** The mage's box can't go into a `wall` tile, and it can't go into a gate's tile while the gate is there. It slides along them as it does along the house. The coins, the cache and the stairs do not stop it.

7. **Aiming.** Aiming works in the dungeon as it does on the lot: the tile in front of the mage, or a touched tile no more than 2 tiles away. Any tile of the dungeon can be aimed at, walls too.

8. **The four gates.** Each gate opens to one spell and no other: `gate_rubble` to Gust, `gate_dirt` to Break Ground, `gate_vine` to Sprout, and `gate_basin` to Draw. When the right spell is cast on an aimed gate, the gate is gone, the floor under it shows, and the mage can walk through. That cast costs the spell's mana, plays the spell's own sound, and gives the spell's school 10 XP. Sprout needs no seed to open the vine and uses none.

9. **Every other cast in the dungeon.** It changes nothing, costs nothing, gives no XP and plays `no.wav`. That covers the wrong spell on a gate, and any spell on the floor, a wall, the coins, the cache, the stairs, or no aimed tile at all. With too little mana for the spell, nothing at all happens and there is no sound, as on the lot.

10. **Coins and the cache.** When the mage's tile becomes a tile with `coins` on it, the mage takes them: they are gone from the tile, the coin count goes up by 5, and `sell.wav` plays. When the mage's tile becomes the tile with the `cache` on it, the mage takes it: it is gone from the tile, the seeds go up by 12, and `pick.wav` plays. A touch on them does nothing but aim.

11. **Every trip down starts fresh.** Each time the mage comes down, the dungeon is as `dungeon.json` has it: all four gates shut, and the coins and the cache back.

12. **The lot waits.** While the mage is below, the lot stands still: no crop grows and the weeds' clock does not run. They go on from where they were when the mage is back up. The mana comes back at 6.5 a second in both places.

13. **Pausing and panels.** The pause button, the skills button and their panels work below as they do on the lot, and so does leaving the page and coming back.

14. **Saving.** The game saves as before. The dungeon itself is not saved. If the page is closed while the mage is below, then opening it again puts the mage on its starting tile on the lot, as always, with the seeds and coins it had.

15. **Nothing else.** No creatures, no hints, no settings. There are no new keys.

16. **The web folder.** The same one command still makes the `web` folder. Tell me how big the download is now.

It is done when each gate opens to its own spell and no other, and the cache's 12 seeds are still yours back on the lot.
