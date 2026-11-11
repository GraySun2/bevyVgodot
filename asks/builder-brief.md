# The builder's brief

Each builder gets this brief once, before step 1, with its own engine's name and folder filled in. It is the same for both sides apart from the three lines marked **Godot** and **Bevy**. It is not an ask and is not counted.

---

You are building a small phone game in **{ENGINE}**. You are one of the builders in a series of build steps. Each step is one ask from me. More asks will follow this one and each adds to the same game, so keep what you write easy to add to. Do what the ask says and nothing more. Don't polish past it.

## Your folder

- Your game folder is `{GAME_DIR}`. It starts empty. Everything you write goes in it.
- The shared art and map are in `{SHARED_DIR}`, which is `../shared/` from your folder. Read them. Never change them. If your engine needs those files inside your folder, have your build command copy them from `../shared/`, so there is one source.
- Don't read or write anywhere else under `/home/user`. Other work is going on there that you must not see.

## The rules

1. Use the engine and nothing else that does game work. No plugins, add-ons, templates, starter projects or game libraries. A general tool the engine doesn't have, such as a JSON reader, is fine.
2. Write the game's code yourself. Don't copy code from another game or project. Reading the engine's own documentation on the web is fine.
3. The game must run in a phone's web browser, held upright, and on a plain static web host: no server code, and no special headers from the host.
4. **Godot:** version 4.7.2, the Compatibility renderer, a web export on one thread (no threads). **Bevy:** version 0.20, built to WebAssembly (`wasm32-unknown-unknown`), drawing with WebGL2.
5. Check your own work before you say it is done. Serve your web folder locally (for example `python3 -m http.server`), open it in headless Chromium at phone size (390 wide, 844 tall) with Playwright, take screenshots, and look at them. Do the same once with the phone turned sideways (844 wide, 390 tall).
6. Don't start other agents. Do the work yourself.

## What is installed

- **Godot:** the editor is `godot` (4.7.2 stable) and runs with `--headless`. The web export templates for 4.7.2 are installed.
- **Bevy:** Rust and cargo 1.97 with the `wasm32-unknown-unknown` target. You may install the other tools a web build needs, such as `wasm-bindgen-cli` at your lock file's version and `wasm-opt`.
- Both: Node 22, Python 3, and Playwright with Chromium (`require('playwright')` works from any folder, and `chromium.launch()` needs no options; WebGL2 works in it).

## When you are done with an ask

Reply with a short report: what you built, the one command that makes the web folder, where the web folder is and how big it is in all (and its biggest file), what you checked and how, anything you could not check, and anything that went wrong on the way and how you fixed it.

---

## Added on 11 November 2026, during step 2

Sent to both builders in the same words, as a note and not an ask, after one builder's list of running programs showed it a piece of the other's test script (see [step 1's log](../log/step-01.md)).

1. Keep your test scripts, screenshots, logs and other working files in a folder called `scratch` inside `{RING_DIR}` (beside your game folder), not in the machine's shared temp folder. Don't list, search or read the shared temp folder.
2. Don't list the machine's running programs (no `ps`, `pgrep`, `top` or the like). When you start a local server, save its process number and stop it by that number.
