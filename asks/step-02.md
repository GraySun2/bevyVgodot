# Step 2: Thumbs

Written once, before the step, and sent word for word to both builds.

---

Add to the game you built in step 1. Everything from step 1 stays as it is: the cover, the fitting and the lot. For this step, add only what is below.

Two new shared files hold the stick's art: `controls.png`, and `controls.json`, which says where each piece is on it. They are in the shared folder beside the others. In this ask a pixel means one pixel of the sprite sheet, so a tile is 32 pixels, and the whole picture is 288 pixels wide and 576 tall.

1. **The stick.** Draw a thumb stick in the bottom strip, from the two pieces in `controls.json`. The base (`stick_base`, 96 by 96 pixels) stays put. Its center is 72 pixels from the picture's left edge and 72 pixels below the top of the bottom strip. The knob (`stick_knob`, 40 by 40 pixels) is drawn over the base and rests on the base's center. Both are sharp, at the same scale as the sprites. The stick is under the cover like the lot is, so it shows once the cover is gone.

2. **Working the stick.** A touch that starts anywhere in the left half of the bottom strip takes hold of the stick. While that touch is down, the knob's center follows it, but never goes farther than 28 pixels from the base's center. Past that, the knob stays 28 pixels out, on the side the thumb is on. The touch keeps hold of the stick wherever it slides, even off the strip or off the picture, until it lifts. When it lifts, the knob goes back to the center. A touch that starts anywhere else does nothing, and a second finger does not disturb the first. The tap that takes the cover away does not work the stick. A mouse works the same way as a finger: press, drag, let go.

3. **Walking.** While the knob's center is more than 8 pixels from the base's center, the mage walks the way the knob points, at any angle, at 96 pixels a second, which is 3 tiles a second. The speed is the same on a fast phone and a slow one. At 8 pixels or less the mage stands still. The mage is drawn over everything else on the lot.

4. **Facing.** The mage faces the way it walks, using the four mage sprites: `mage_up`, `mage_down`, `mage_left` and `mage_right`. At a slant it uses the sprite for the bigger part of the move, and an even slant counts as left or right. When it stops, it keeps facing the way it last walked.

5. **What the mage can't cross.** For bumping into things, the mage is a box 20 by 20 pixels in the middle of its sprite. That box can't go into any of the house's six tiles or the crate's tile. The whole mage sprite stays on the lot, so it can't walk off any edge. When the mage pushes at a slant against something it can't cross, it slides along it and does not stop dead. For now the mage walks freely over rubble, weeds, flowers and the stairwell, and nothing happens on the stairwell.

6. **The page keeps still.** Dragging a thumb on the game does not scroll, zoom or refresh the page, select anything, or bring up a menu.

7. **Keys, for testing.** On a keyboard, the arrow keys and W, A, S and D walk the mage the same way: up, down, left and right, and two keys together for a slant, always at the same 96 pixels a second. The knob does not have to move for keys.

8. **Nothing else.** No spell buttons, no aiming, no sound and no counts yet.

9. **The web folder.** The same one command still makes the `web` folder. Tell me how big the download is now.

It is done when the mage walks to all four corners of the lot with one thumb and can't leave the lot.
