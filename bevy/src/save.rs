//! Saving: the game keeps itself in the browser's own storage, so that it is
//! still there after the page is closed. It saves every 30 seconds, and every
//! time the page is hidden or closed. When the cover goes, a saved game is
//! put back as it was.

use std::cell::RefCell;

use bevy::prelude::*;
use serde::{Deserialize, Serialize};
use wasm_bindgen::JsCast;
use wasm_bindgen::closure::Closure;
use web_sys::{Storage, VisibilityState};

use crate::counts::{Coins, Crops, Seeds};
use crate::crop::{NextWeeds, WEEDS_EVERY};
use crate::lot::{Field, LotClock, on_lot};
use crate::mana::{FULL, Mana};
use crate::sheet::Sheet;
use crate::skills::Schools;
use crate::{Screen, Start};

/// Where in the browser's storage the game is kept.
const KEY: &str = "farm-bevy-save";

/// How often the game saves itself while it is open, in seconds.
const EVERY: f64 = 30.0;

/// A saved game, as JSON. Later steps may add to it: anything they add must
/// have a default (`#[serde(default)]`), so that a game saved before still
/// opens.
#[derive(Serialize, Deserialize)]
struct Saved {
    /// Every tile of the lot, top row first.
    tiles: Vec<SavedTile>,
    mana: f32,
    seeds: u32,
    crops: u32,
    coins: u32,
    /// Each school's level and XP, in the order of `School`.
    schools: Vec<(u32, u32)>,
    /// How far the weeds' clock has come: seconds of the lot's clock since
    /// it last started.
    weeds_clock: f64,
}

#[derive(Serialize, Deserialize)]
struct SavedTile {
    x: i32,
    y: i32,
    ground: Option<String>,
    thing: Option<String>,
    /// How long a watered crop has grown, in seconds of the lot's clock.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    grown: Option<f64>,
}

thread_local! {
    /// The game as it was at the end of the last frame, ready to be saved at
    /// once when the page is hidden or closed: the game may have no frame
    /// left by then. There is nothing while the cover is up, so that a page
    /// closed before the cover goes keeps the game saved before.
    static LATEST: RefCell<Option<String>> = const { RefCell::new(None) };
}

pub fn plugin(app: &mut App) {
    app.add_systems(Startup, listen)
        .add_systems(OnEnter(Screen::Playing), load.in_set(Start::Saved))
        .add_systems(Last, keep.run_if(in_state(Screen::Playing)));
}

/// The browser's own storage, if the page may use it.
fn storage() -> Option<Storage> {
    web_sys::window()?.local_storage().ok()?
}

/// Writes the latest game to the browser's storage.
fn write() {
    LATEST.with_borrow(|latest| {
        if let (Some(json), Some(storage)) = (latest, storage()) {
            // If the browser won't keep it (out of room, say), there is
            // nothing better to do than go on playing.
            let _ = storage.set_item(KEY, json);
        }
    });
}

/// Asks the browser to say when the page is hidden or closed, and saves then.
fn listen() {
    let Some(window) = web_sys::window() else {
        return;
    };
    let on_hidden = Closure::<dyn Fn()>::new(|| {
        let document = web_sys::window().and_then(|window| window.document());
        if document.is_some_and(|document| document.visibility_state() == VisibilityState::Hidden) {
            write();
        }
    });
    let on_close = Closure::<dyn Fn()>::new(write);
    if let Some(document) = window.document() {
        let _ = document
            .add_event_listener_with_callback("visibilitychange", on_hidden.as_ref().unchecked_ref());
    }
    let _ = window.add_event_listener_with_callback("pagehide", on_close.as_ref().unchecked_ref());
    // They listen for as long as the page is open.
    on_hidden.forget();
    on_close.forget();
}

/// At the end of every frame, takes note of the game as it is now, and saves
/// it every 30 seconds.
fn keep(
    clock: Res<LotClock>,
    real: Res<Time<Real>>,
    mut next_save: Local<Option<f64>>,
    field: Res<Field>,
    mana: Res<Mana>,
    seeds: Res<Seeds>,
    crops: Res<Crops>,
    coins: Res<Coins>,
    schools: Res<Schools>,
    weeds: Res<NextWeeds>,
) {
    // The crops and the weeds go by the lot's clock.
    let now = clock.0;
    let saved = Saved {
        tiles: field
            .spots()
            .map(|(tile, ground, thing, watered_at)| SavedTile {
                x: tile.x,
                y: tile.y,
                ground: ground.map(str::to_string),
                thing: thing.map(str::to_string),
                grown: watered_at.map(|watered_at| now - watered_at),
            })
            .collect(),
        mana: mana.0,
        seeds: seeds.0,
        crops: crops.0,
        coins: coins.0,
        schools: schools.saved(),
        weeds_clock: now - (weeds.0 - WEEDS_EVERY),
    };
    let Ok(json) = serde_json::to_string(&saved) else {
        return;
    };
    LATEST.set(Some(json));

    let real_now = real.elapsed_secs_f64();
    let due = next_save.get_or_insert(real_now + EVERY);
    if real_now >= *due {
        *due = real_now + EVERY;
        write();
    }
}

/// When the cover goes and there is a saved game, puts it back: every tile,
/// the mana, the counts, the schools and the weeds' clock. The crops and the
/// clocks go on from where they were saved. The mage stands on its starting
/// tile facing down, as always.
#[allow(clippy::too_many_arguments)]
fn load(
    mut commands: Commands,
    clock: Res<LotClock>,
    sheet: Res<Sheet>,
    mut field: ResMut<Field>,
    mut mana: ResMut<Mana>,
    mut seeds: ResMut<Seeds>,
    mut crops: ResMut<Crops>,
    mut coins: ResMut<Coins>,
    mut schools: ResMut<Schools>,
    mut weeds: ResMut<NextWeeds>,
) {
    let json = storage().and_then(|storage| storage.get_item(KEY).ok().flatten());
    // A saved game the game can't read is left alone, and the game starts
    // as new.
    let Some(saved) = json.and_then(|json| serde_json::from_str::<Saved>(&json).ok()) else {
        return;
    };
    let now = clock.0;
    for spot in &saved.tiles {
        let tile = IVec2::new(spot.x, spot.y);
        // A tile with a sprite the sheet doesn't have stays as the lot has it.
        let known = |name: &Option<String>| name.as_deref().is_none_or(|name| sheet.has(name));
        if !on_lot(tile) || !known(&spot.ground) || !known(&spot.thing) {
            continue;
        }
        let watered_at = spot.grown.map(|grown| now - grown.max(0.0));
        field.put_back(
            &mut commands,
            &sheet,
            tile,
            spot.ground.as_deref(),
            spot.thing.as_deref(),
            watered_at,
        );
    }
    mana.0 = saved.mana.clamp(0.0, FULL);
    seeds.0 = saved.seeds;
    crops.0 = saved.crops;
    coins.0 = saved.coins;
    schools.put_back(&saved.schools);
    weeds.0 = now - saved.weeds_clock.clamp(0.0, WEEDS_EVERY) + WEEDS_EVERY;
}
