//! Crops: a watered seed grows by the clock until it is ripe, a touch picks
//! a ripe one, and a touch on the crate sells them. Weeds come back on bare
//! grass every so often.

use bevy::prelude::*;

use crate::{Screen, Start};
use crate::aim::{TOUCH_REACH, take_aim};
use crate::counts::{Coins, Crops};
use crate::dungeon::on_the_lot;
use crate::hint::{Done, Thing};
use crate::lot::{Field, LOT_TILES, LotClock, tile_under};
use crate::mage::Mage;
use crate::picture::{Place, Presses};
use crate::sheet::Sheet;
use crate::sound::Sounds;
use crate::panel::not_still;
use crate::spell::cast;

/// A watered crop's sprite from so many seconds after it was watered. It
/// stays ripe.
const STAGES: [(f64, &str); 4] = [
    (0.0, "crop_seed"),
    (10.0, "crop_sprout"),
    (25.0, "crop_grown"),
    (40.0, "crop_ripe"),
];

/// Weeds grow on one tile of bare grass this often, in seconds, counted from
/// when the cover goes.
pub const WEEDS_EVERY: f64 = 45.0;

/// When the next weeds grow, by the lot's clock in seconds.
#[derive(Resource, Default)]
pub struct NextWeeds(pub f64);

/// The coins a crop sells for.
const PRICE: u32 = 5;

pub fn plugin(app: &mut App) {
    app.init_resource::<NextWeeds>()
        .add_systems(OnEnter(Screen::Playing), start_weeds.in_set(Start::New))
        .add_systems(
            Update,
            (
                (pick, sell)
                    .chain()
                    .after(take_aim)
                    .before(cast)
                    .run_if(not_still)
                    .run_if(on_the_lot),
                (grow, weeds).chain().after(cast),
            )
                .run_if(in_state(Screen::Playing)),
        );
}

/// A touch or mouse press that starts on a ripe crop near enough picks it.
#[allow(clippy::too_many_arguments)]
fn pick(
    mut commands: Commands,
    presses: Res<Presses>,
    mage: Single<&Place, With<Mage>>,
    mut field: ResMut<Field>,
    mut crops: ResMut<Crops>,
    sheet: Res<Sheet>,
    sounds: Res<Sounds>,
    mut done: ResMut<Done>,
) {
    let Some(mage_tile) = tile_under(mage.0) else {
        return;
    };
    for tile in presses.0.iter().filter_map(|press| tile_under(*press)) {
        let near = (tile - mage_tile).abs().max_element() <= TOUCH_REACH;
        if near && field.thing(tile) == Some("crop_ripe") {
            // Gone, and the ground is bare grass again.
            field.take_thing(&mut commands, tile);
            field.set_ground(&mut commands, &sheet, tile, "grass");
            crops.0 += 1;
            sounds.play(&mut commands, "pick");
            Done::mark(&mut done, Thing::Pick);
        }
    }
}

/// A touch or mouse press that starts on the crate near enough sells every
/// crop the mage carries, or plays `no.wav` if it carries none. It costs no
/// mana. From farther away it does nothing.
#[allow(clippy::too_many_arguments)]
fn sell(
    mut commands: Commands,
    presses: Res<Presses>,
    mage: Single<&Place, With<Mage>>,
    field: Res<Field>,
    mut crops: ResMut<Crops>,
    mut coins: ResMut<Coins>,
    sounds: Res<Sounds>,
    mut done: ResMut<Done>,
) {
    let Some(mage_tile) = tile_under(mage.0) else {
        return;
    };
    for tile in presses.0.iter().filter_map(|press| tile_under(*press)) {
        let near = (tile - mage_tile).abs().max_element() <= TOUCH_REACH;
        if near && field.thing(tile) == Some("crate") {
            if crops.0 > 0 {
                coins.0 += PRICE * crops.0;
                crops.0 = 0;
                sounds.play(&mut commands, "sell");
                Done::mark(&mut done, Thing::Sell);
            } else {
                sounds.play(&mut commands, "no");
            }
        }
    }
}

/// Each watered crop shows the sprite for its age.
fn grow(mut commands: Commands, clock: Res<LotClock>, mut field: ResMut<Field>, sheet: Res<Sheet>) {
    let now = clock.0;
    for (tile, watered_at) in field.watered() {
        let age = now - watered_at;
        let (_, name) = STAGES
            .into_iter()
            .rev()
            .find(|(from, _)| age >= *from)
            .unwrap_or(STAGES[0]);
        if field.thing(tile) != Some(name) {
            field.change_thing(&mut commands, &sheet, tile, name);
        }
    }
}

fn start_weeds(clock: Res<LotClock>, mut next: ResMut<NextWeeds>) {
    next.0 = clock.0 + WEEDS_EVERY;
}

/// When the time comes, weeds grow on the bare grass tile farthest from the
/// mage's tile (tiles across plus tiles up or down). Of those as far, the one
/// highest up, then the one most to the left. With no bare grass, nothing.
fn weeds(
    mut commands: Commands,
    clock: Res<LotClock>,
    mut next: ResMut<NextWeeds>,
    mage: Single<&Place, With<Mage>>,
    mut field: ResMut<Field>,
    sheet: Res<Sheet>,
) {
    let Some(mage_tile) = tile_under(mage.0) else {
        return;
    };
    while clock.0 >= next.0 {
        next.0 += WEEDS_EVERY;
        let bare_grass = (0..LOT_TILES.y)
            .flat_map(|row| (0..LOT_TILES.x).map(move |column| IVec2::new(column, row)))
            .filter(|&tile| {
                matches!(field.ground(tile), Some("grass" | "grass_flowers"))
                    && field.thing(tile).is_none()
            });
        // Rows top first, and in a row left first, so the first of the
        // farthest is the one to take.
        let mut farthest: Option<(i32, IVec2)> = None;
        for tile in bare_grass {
            let distance = (tile - mage_tile).abs().element_sum();
            if farthest.is_none_or(|(most, _)| distance > most) {
                farthest = Some((distance, tile));
            }
        }
        if let Some((_, tile)) = farthest {
            field.put_thing(&mut commands, &sheet, tile, "weeds");
        }
    }
}
