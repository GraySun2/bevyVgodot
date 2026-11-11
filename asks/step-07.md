# Step 7: Sell, save, and a phone call

Written once, before the step, and sent word for word to both builds.

---

Add to the game. Everything from steps 1 to 6 stays as it is. For this step, add only what is below.

Nothing in the shared folder has changed. This step uses pieces and a sound that are already there: the pieces `icon_coin`, `button_pause` and `panel_pause` on `controls.png`, and the sound `sell.wav`. As before, a pixel means one pixel of the sprite sheet, and places are counted from the picture's top-left corner unless it says otherwise.

1. **Coins.** The mage has coins, none at the start. In the top strip, draw the piece `icon_coin` (16 by 16 pixels) with its top-left corner 136 pixels from the left and 26 from the top. Write the number of coins the way the seeds are written, with the first digit's top-left corner 156 pixels from the left and 27 from the top.

2. **Selling.** A touch that starts on the crate's tile sells, if the crate is no more than 2 tiles across and no more than 2 tiles up or down from the mage's tile.
   - With one crop or more, every crop the mage carries is sold: the coins go up by 5 for each crop, the crops go to none, and the sound `sell.wav` plays.
   - With no crops, nothing changes and the sound `no.wav` plays.
   - A touch on the crate from farther away does nothing at all.
   - Selling costs no mana and gives no XP. The touch also aims at the crate's tile, as any touch on a tile in reach does.

3. **The pause button.** In the top strip, draw the piece `button_pause` (36 by 36 pixels) with its top-left corner 246 pixels from the left and 6 from the top. A touch that starts on it pauses the game.

4. **While the game is paused.** Draw the piece `panel_pause` (192 by 56 pixels) with its top-left corner 48 pixels from the left and 212 from the top, over the lot and everything on it. The game stands still, the same way it does while the skills panel is open: nothing moves or changes, the stick and the buttons do nothing, and no tile can be aimed at, picked or sold at. The next touch, wherever it starts, ends the pause and does nothing else. Then everything goes on from where it was.

5. **Leaving and coming back.** When the page is hidden, the game pauses by itself. A page is hidden when the player switches to another app or another tab, or the phone's screen goes off. When the player comes back, the game is still paused and the pause panel is showing, until the next touch. If the skills panel was open, it is closed and the pause panel shows instead. After that touch the game goes on from where it was, and its sounds play as before. While the cover is still up, there is nothing to pause.

6. **Saving.** The game saves itself in the browser's own storage, so that it is still there after the page is closed. It saves every 30 seconds, and every time the page is hidden or closed. What is saved: the ground of every tile and what is on it, how far each watered crop has grown, the mana, the seeds, the crops, the coins, each school's level and XP, and how far the weeds' clock has come.

7. **Opening the page again.** The cover shows first, as always. If there is a saved game, then when the cover goes away the game is as it was saved, except that the mage stands on its starting tile facing down, no panel is open, and the game is not paused. No time has passed while the page was closed: the crops, the mana and the weeds' clock go on from where they were saved. With no saved game, it starts the way it always has.

8. **Later steps.** Later steps will add to the game. A game saved now must still open then.

9. **Keys and mouse, for testing.** The P key pauses, and ends the pause. A mouse press on the crate sells.

10. **Nothing else.** No hints, no settings, no way to erase a saved game, no dungeon.

11. **The web folder.** The same one command still makes the `web` folder. Tell me how big the download is now.

It is done when you sell a harvest, switch to another app and come back, and nothing is lost. Close the page, open it again, and it is the same farm.
