# Step 1: On your phone

Written once, before the step, and sent word for word to both builds.

---

Start a new game in your folder. It is a small farming game played in a phone's web browser with the phone held upright. For this step, make only what is below.

1. **The upright picture.** The whole game is one upright picture, 9 tiles wide and 18 tiles tall. A tile is 32 by 32 pixels on the sprite sheet. From the top: a strip one and a half tiles high, empty for now, which will hold the counts later. Then the farm lot, 9 tiles wide and 12 tall. Then a strip four and a half tiles high, empty for now, which will hold the thumb controls later. Both strips are the plain color `#2f5a2a`.

2. **Fitting the screen.** Make the picture as big as fits on the screen, keep its shape, and center it. Fill whatever is left of the screen with the plain color `#2a1a14`. So on an upright phone the picture fills the screen, and on a PC or a phone turned sideways it is the same upright picture with bars at its sides. If the screen changes size or is turned, fit it again. The sprites' pixels stay sharp, never blurred, at any size.

3. **The cover.** The page opens on a cover: the whole upright picture in the color `#2f5a2a` with the words "Tap to play" in the color `#fff4d8`, centered, about one tile tall. One tap or click anywhere takes the cover away for good.

4. **The lot.** Under the cover is the farm lot, drawn from the three shared files. `lot.json` says which tile goes where. `sprites.json` says where each sprite is on `sprites.png`. Draw the ground first and the things on top of it. Then draw the mage on the start tile, facing the player (the sprite `mage_down`).

5. **Nothing else.** Nothing moves yet. No controls, no sound, no counts.

6. **The web folder.** Give me one command that makes the game as a folder called `web` inside your folder, which a plain web host can serve as it is. Tell me how big the download is.

It is done when the page opens on a phone and the lot fills the screen upright.
