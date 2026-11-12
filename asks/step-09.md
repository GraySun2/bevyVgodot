# Step 9: Something lives down here

Written once, before the step, and sent word for word to both builds.

---

Add to the game. Everything from steps 1 to 8 stays as it is. For this step, add only what is below.

The shared folder has changed. `dungeon.json` has one new list, `creatures`: the starting tile of each of the four creatures. Nothing else has changed. This step uses the sprite `creature`, which is already on the sprite sheet. As before, a pixel means one pixel of the sprite sheet, and places are counted from the picture's top-left corner unless it says otherwise.

1. **Four creatures.** Creatures live only in the dungeon. Each time the mage comes down, all four are there, each standing on the middle of its starting tile, each with 3 nerve. Draw the sprite `creature` for each one, over the ground, the things and the aim mark, and under the mage.

2. **A creature's tile and its box.** A creature's tile is the tile under the middle of its sprite. For bumping into things, a creature is a box 20 by 20 pixels in the middle of its sprite, the same as the mage. Its box can't go into a wall tile, a gate's tile while the gate is there, or the `stairs_up` tile. It slides along them the way the mage slides along a wall. Nothing else stops a creature, and creatures pass through each other.

3. **Coming for the mage.** While the mage's tile is no more than 4 tiles across and no more than 4 tiles up or down from a creature's tile, that creature walks straight toward the middle of the mage, at 57.6 pixels a second, the same on a fast phone and a slow one. Walls between the two make no difference to that: the creature still tries, and goes as far as the walls let it. While the mage is farther away than that, the creature stands still.

4. **Gust on a creature.** When Gust is cast and the aimed tile is a creature's tile, the cast costs its 8 mana, plays `gust.wav`, and gives Air its 10 XP. The creature loses 1 nerve and is thrown 64 pixels, at once, straight away from the mage: left, right, up or down, whichever way the aimed tile lies from the mage's tile. If the aimed tile is at a slant from the mage's tile, the bigger part counts, and an even slant counts as left or right. If the aimed tile is the mage's own tile, it is the way the mage faces. The creature stops short where its box would go into something it can't cross.

5. **Draw on a creature.** When Draw is cast and the aimed tile is a creature's tile, the cast costs its 10 mana, plays `draw.wav`, and gives Water its 10 XP. The creature loses 1 nerve, and for the next 2 seconds it walks at half its speed, 28.8 pixels a second. It is not moved.

6. **The other two spells.** Break Ground and Sprout do nothing to a creature. Cast on a creature's tile they change nothing, cost nothing and play `no.wav`, like any other cast that changes nothing.

7. **More than one.** If two creatures share the aimed tile, one cast hits both, for one cost.

8. **No nerve left.** A creature whose nerve reaches 0 is gone from the floor at once. It is back, with the others, the next time the mage comes down.

9. **A touch.** When a creature's box and the mage's box overlap, the creature has touched the mage. The mage loses half the mana it has. It is put on the middle of the `stairs_up` tile, facing down, and stays in the dungeon: being put there does not take it up. The sound `no.wav` plays. Every creature still on the floor is put back on the middle of its own starting tile, with the nerve it has left.

10. **Standing still.** While the game is paused, a panel is open, the page is hidden, or the place is fading, the creatures do not move and a creature's 2 slow seconds do not run.

11. **The rest of the dungeon** stays as it was in step 8: the gates, the coins, the cache, the stairs. Creatures are not saved. Opening the page again starts on the lot, as before.

12. **Nothing else.** No hints, no settings. There are no new keys, pieces or sounds.

13. **The web folder.** The same one command still makes the `web` folder. Tell me how big the download is now.

It is done when a creature is driven off with Gust and Draw, and a touch puts you at the stairs with half your mana.
