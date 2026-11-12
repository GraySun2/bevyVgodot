# Step 2: Thumbs

**The ask:** [`asks/step-02.md`](../asks/step-02.md), written once and sent word for word to both builders on 11 November 2026. Godot got it at 8:34 am Central. Bevy got it at 9:03 am, when its fix-up for step 1 was back (see [step 1's log](step-01.md)). Each message ended with one more line, the same for both: "Reply with the same kind of short report as before."

**Result: a tie, one ask each.** Both builds pass all 83 things the referee's check tries, and neither needed a second ask. Both pages were then tried on a real phone, briefly, at 10:13 am Central: the stick works in both, and both look right. That closes the step. The score after two steps is Godot 2 asks, Bevy 3.

## For the short

The numbers and the moments from this step that are worth telling. Everything here is from the log below.

- **The score:** a tie, one ask each. So far: Godot 2 asks, Bevy 3.
- **Time:** almost the same, 64 min 32 s for Godot's builder and 63 min 23 s for Bevy's. But Godot's game was first built 7 minutes in, and Bevy's 26 minutes in. The rest of both hours was testing.
- **Change one number and see it again:** a build after a change takes 9 to 12 seconds in Godot and 3 minutes 17 seconds in Bevy. That is the stopwatch number for changing the mage's speed.
- **Code:** 428 lines in Godot, 924 in Bevy, for the same game.
- **Work:** Godot's builder used 311,299 tokens and Bevy's 162,412. The slower build took about half the tokens.
- **Size:** the stick added 6 KB to Godot's download and 44 KB to Bevy's. The totals did not move: 39.9 MB and 13.8 MB.
- **Each engine's own surprise:** in Godot, a thumb pushed at an even slant made the mage face down, because of tiny rounding errors in where the touch was. In Bevy, about one stop in 50, the standing mage showed one column of its pixels twice.
- **The same answers, apart:** the two builders can't see each other, and both made the same two choices the ask left open. The mage faces the way it is pushed even while a wall stops it, and a second finger never takes over the stick.
- **The referee's own miss:** at a phone's real sharpness the test browser drew Godot at 5 to 7 frames a second and Bevy at 2 to 5. The first run of the check blamed Godot for 8 misses that were the check's own.
- **On a real phone:** both worked and looked right, in a brief try.
- **Pictures:** four screenshots of each build are in [`step-02/`](step-02/).

| | Godot 4.7.2 | Bevy 0.20.1 |
| --- | --- | --- |
| Asks for this step | 1 | 1 |
| Asks so far | 2 | 3 |
| Builder's time, from the ask to its report | 64 min 32 s | 63 min 23 s |
| Builder's work, in tokens | 311,299 | 162,412 |
| Builder's tool calls | 47 | 60 |
| What the build is now | 428 lines in 10 files (244 in 8 after step 1) | 924 lines in 10 files, plus a lock file (519 in 8 after step 1's fix-up) |
| Download from a plain host | 39.9 MB in 7 files, 6 KB more than step 1 | 13.8 MB in 3 files, 44 KB more than after the fix-up |
| The same, with the big file gzipped | 10.5 MB | 4.5 MB |
| The game's own part of that | 22 KB | not separate |
| One build after a change | 9 to 12 seconds | 3 minutes 17 seconds for its last one |
| The builder's own checks before it reported | 134 | 148 |

The times and token counts are what the builders' own runs reported. Bevy's run reported its fix-up and this step together, so its figures here are that total less the fix-up's. Godot's build time was timed by the referee. Bevy's is from the clock times of its builder's last build.

## What the ask left to the builder, and what it pinned down

The ask gives numbers wherever a player could tell two builds apart, so the check can be the same for both: where the stick sits (its middle 72 pixels in from the left and 72 below the top of the bottom strip), how far the knob travels (28 pixels), how far it must be pushed before the mage moves (more than 8), the mage's speed (96 pixels a second, 3 tiles), the size of the mage for bumping (a 20 by 20 pixel box), and what is solid (the house, the crate and the lot's edge). Rubble and weeds are not solid yet, or the mage could not reach the corners. How to do any of it is the builder's.

The stick's art is shared, like the sprite sheet: [`shared/controls.png`](../shared/controls.png), drawn by the same script.

## The referee's check

[`tools/check-step-02.cjs`](../tools/check-step-02.cjs) opens a build in headless Chromium, works the stick with real touch events (and the mouse and the keys at PC size), and reads where the mage and the knob are from screenshots alone. It knows nothing about either engine. It tries 83 things in five views. Step 1's picture check, [`tools/check-web.cjs`](../tools/check-web.cjs), runs too, now with the stick in its picture.

| Checked | Godot | Bevy |
| --- | --- | --- |
| The stick is drawn where the ask says, sharp, and the picture still matches the shared files | yes, at every size | yes, at every size |
| The knob follows the thumb, stops 28 pixels out, and goes back when the thumb lifts | yes | yes |
| The mage stands still at 6 pixels and walks at 12 | yes | yes |
| All four corners reached, and the mage can't leave the lot | yes | yes |
| The house and the crate stop the mage, from every side tried | yes, flush each time | yes, flush each time |
| Pushed at a slant against a wall, the mage slides along it | yes | yes |
| The mage faces the way it walks, at nine slants, and keeps its facing | yes | yes |
| Speed with the stick, straight and at a slant (96 pixels a second asked) | 94 and 95 | 98 and 96 |
| A thumb that slides off the strip, or off the picture, keeps hold | yes | yes |
| A touch that starts anywhere else does nothing | yes | yes |
| A second finger doesn't disturb the thumb | yes | yes |
| A tap on the cover where the stick will be doesn't move the mage | yes | yes |
| The mouse works the stick | yes | yes |
| Arrow keys and W, A, S, D, alone and two at a time | yes, all 12 tried | yes, all 12 tried |
| Speed with keys, straight and at a slant | 98 and 102 | 94 and 96 |
| The page did not scroll, zoom or select anything | yes | yes |
| Page errors | none | none |
| Things passed | 83 of 83 | 83 of 83 |
| Frames a second in the test browser, at the walking size | 29 | 25 |

The speeds are measured from screenshots and are good to a few pixels a second.

| | Godot | Bevy |
| --- | --- | --- |
| The start | ![Godot start](step-02/godot-phone-start.png) | ![Bevy start](step-02/bevy-phone-start.png) |
| A thumb held up and left | ![Godot thumb held](step-02/godot-thumb-held.png) | ![Bevy thumb held](step-02/bevy-thumb-held.png) |
| The top right corner | ![Godot corner](step-02/godot-corner-top-right.png) | ![Bevy corner](step-02/bevy-corner-top-right.png) |
| In the gap between the house and the crate | ![Godot gap](step-02/godot-between-house-and-crate.png) | ![Bevy gap](step-02/bevy-between-house-and-crate.png) |

The numbers are in [`step-02/godot-check.json`](step-02/godot-check.json) and [`step-02/bevy-check.json`](step-02/bevy-check.json). In the test browser the two builds can't be told apart by eye.

## Godot: what came back

Two new scripts, one for the stick and one for the mage, and small changes to five other files. The stick script takes the first touch that starts in its half of the strip and follows only that touch. The mage script moves across first and then down, in hops of 8 pixels at most, and backs up to the tile line when a hop lands in something solid. The mouse is switched on as a touch in the project's settings, so the game handles one kind of input.

What went wrong on the way, by the builder's own report:

1. Under a thumb, an even slant faced down. Dividing the touch's place by the screen's zoom left tiny rounding errors, so even was never quite even. It added a tolerance of about a twelfth of a degree.
2. Two mistakes in its own tests, not in the game: lifting one of two fingers the wrong way, and reading screenshots while keys were still held.
3. The referee's housekeeping note arrived mid-step (see [step 1's log](step-01.md)). It moved its test files into its own folder.

Choices the ask left open, as the builder made them:

- The mage faces the way it is pushed, even while a wall stops it.
- Nothing runs under the cover. Keys pressed before the tap do nothing.
- A second finger that lands on the stick's half while the stick is held never takes hold, even after the first lifts.

The builder ran 134 checks of its own. Most of its 64 minutes went there: the game was first built seven minutes in.

One thing it left behind: a local test server it could not stop without listing running programs, which the note had just told it not to do. It said so in its report, and the referee stopped it.

## Bevy: what came back

Two new source files, one for the stick and one for the mage, and changes to four others. The engine gained one more of its own parts, the keyboard. The stick takes a touch or a left mouse press that starts on its half of the strip. The mage's walk is timed by the clock, not by frames. The page's own file has styles and three small handlers that stop scrolling, zooming, selecting and menus.

What went wrong on the way, by the builder's own report:

1. About one stop in 50, the standing mage showed one column of its pixels twice. It now draws the mage and the knob on the nearest whole screen pixel.
2. Two faults in its test tools, not in the game: lifting one of two fingers needed a different call, and the test browser's built-in swipe and pinch did nothing, so it made the touches by hand.
3. One failure it could not explain: in one of six runs of its sizes test, the test browser closed during the sideways part at a phone's real sharpness. The other five runs were clean and it could not make it happen again.
4. The referee's housekeeping note arrived mid-step. It wrote its test tools again in its own folder and did not copy the old ones.

Choices the ask left open, as the builder made them:

- The mage faces the way the thumb pushes, even while a wall stops it. Godot's builder chose the same.
- A second finger that comes down while the first holds the stick never takes over, even after the first lifts. Godot's builder chose the same.
- The stick wins over the keys once it is more than 8 pixels out.
- Below 4 frames a second the game runs slow, so the mage can't jump through a wall.

Its first build of the step was 26 minutes in. The rest was testing.

## The referee's own misses

- **The check walked too slowly to judge.** The test browser draws with software. At a phone's real sharpness, three screen pixels to a point, it drew Godot's build at 5 to 7 frames a second and Bevy's at 2 to 5. No phone is that slow. A push that should end between two frames ran long, the mage overshot, and the first run of the check showed 8 misses for Godot that were the check's, not the build's. The check now does its walking at phone size with one screen pixel to a point, where the test browser keeps up (29 frames a second for Godot, 25 for Bevy). It measures the frames a second in every view, allows for them wherever a check turns on timing, and uses walls instead of timing to put the mage where a test needs it. One view still runs at the real sharpness. No ask was sent because of this.
- **Two keys never lift in the same instant.** The check read the mage's facing after two keys were let go. The key that lifted last turned the mage its own way for one frame, which is right, and the check called it a miss. It now reads the facing while the keys are down. No ask was sent because of this either.
- The check was tried on a plain stand-in page first, written by the referee from the same ask, and on a copy of that page with faults put in, to see that it passes what is right and catches what is wrong.

## On a real phone

Godot's page had the stick from 10:03 am Central and Bevy's from 10:12 am. Both were tried on the same phone as in step 1, and the word at 10:13 am was that both work and look good. It was a brief try. Whether every corner was walked on the phone, and what the phone's browser does on a long drag, was not reported.

## Not checked

- Every corner, on a real phone. The check walks them all in the test browser. The phone try was brief.
- Whether a real phone's browser scrolls, zooms or brings up a menu when a thumb drags on the game for a long time. The test browser can't show that.
- An iPhone's browser in particular.
