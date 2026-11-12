//! The dungeon floor under the lot, and the stairs between them.
//!
//! Only one place shows at a time, drawn where the lot is drawn. When the
//! mage's tile becomes a stairs tile, coming from another tile, the place
//! darkens, and the other place comes out of the dark with the mage on its
//! stairs, facing down. Each trip down starts fresh, as `dungeon.json` has it.
//! Walking onto coins or the cache takes them. The gates open to spells (see
//! `spell`).

use bevy::prelude::*;

use crate::Screen;
use crate::aim::take_aim;
use crate::counts::{Coins, Seeds};
use crate::lot::{Blocked, Field, new_place, tile_under};
use crate::mage::{Mage, put_mage, walk};
use crate::panel::{OnStairs, not_still};
use crate::picture::{BROWN, LOT_HEIGHT, LOT_TOP, PICTURE, Place, Z_MAGE, rect};
use crate::sheet::Sheet;
use crate::sound::Sounds;

const DUNGEON_JSON: &str = include_str!("../../shared/dungeon.json");

/// The coins in each pile, and the seeds in the cache.
const COINS_IN_A_PILE: u32 = 5;
const SEEDS_IN_THE_CACHE: u32 = 12;

/// Going down or coming up takes this long, in seconds: the first half
/// darkening, the second half coming out of the dark.
const TRIP: f64 = 0.5;

/// Over the place and everything on it, the level-up pop too, and under the
/// panels.
const Z_DARK: f32 = Z_MAGE + 2.5;

/// Which place the mage is in.
#[derive(Resource, Default, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Here {
    #[default]
    Lot,
    Dungeon,
}

/// The dungeon floor as it is on this trip down.
#[derive(Resource, Default)]
pub struct Dungeon(pub Field);

/// The mage's tile as it was, to tell when it becomes another.
#[derive(Resource, Default)]
struct LastTile(Option<IVec2>);

/// A trip up or down the stairs under way: when it started, by the real
/// clock (the game's clock stands still meanwhile), and whether the places
/// have swapped yet.
#[derive(Resource, Default)]
struct Trip(Option<(f64, bool)>);

/// Marks the dark that covers the place during a trip.
#[derive(Component)]
struct Dark;

pub fn plugin(app: &mut App) {
    app.init_resource::<Here>()
        .init_resource::<Dungeon>()
        .init_resource::<LastTile>()
        .init_resource::<Trip>()
        .add_systems(Startup, draw_dark)
        .add_systems(
            Update,
            (step_on.after(walk).run_if(not_still), trip.before(take_aim))
                .chain()
                .run_if(in_state(Screen::Playing)),
        );
}

/// For what only happens on the lot.
pub fn on_the_lot(here: Res<Here>) -> bool {
    *here == Here::Lot
}

fn draw_dark(mut commands: Commands) {
    commands.spawn((
        Dark,
        rect(BROWN, 0.0, LOT_TOP, PICTURE.x, LOT_HEIGHT, Z_DARK),
        Visibility::Hidden,
    ));
}

/// When the mage's tile becomes another: a stairs tile starts a trip, and
/// coins or the cache are taken.
#[allow(clippy::too_many_arguments)]
fn step_on(
    mut commands: Commands,
    mage: Single<&Place, With<Mage>>,
    here: Res<Here>,
    field: Res<Field>,
    mut dungeon: ResMut<Dungeon>,
    mut last: ResMut<LastTile>,
    mut trip: ResMut<Trip>,
    mut on_stairs: ResMut<OnStairs>,
    real: Res<Time<Real>>,
    mut coins: ResMut<Coins>,
    mut seeds: ResMut<Seeds>,
    sounds: Res<Sounds>,
) {
    let tile = tile_under(mage.0);
    if tile == last.0 {
        return;
    }
    // The first time, there is no tile it came from: it only takes note.
    let came = last.0.is_some();
    last.0 = tile;
    let (Some(tile), true) = (tile, came) else {
        return;
    };
    let (place, stairs) = match *here {
        Here::Lot => (&*field, "stairs_down"),
        Here::Dungeon => (&dungeon.0, "stairs_up"),
    };
    if place.ground(tile) == Some(stairs) {
        trip.0 = Some((real.elapsed_secs_f64(), false));
        on_stairs.0 = true;
        return;
    }
    if *here == Here::Dungeon {
        match dungeon.0.thing(tile) {
            Some("coins") => {
                dungeon.0.take_thing(&mut commands, tile);
                coins.0 += COINS_IN_A_PILE;
                sounds.play(&mut commands, "sell");
            }
            Some("cache") => {
                dungeon.0.take_thing(&mut commands, tile);
                seeds.0 += SEEDS_IN_THE_CACHE;
                sounds.play(&mut commands, "pick");
            }
            _ => {}
        }
    }
}

/// A trip up or down: the place darkens evenly for the first half, the
/// places swap, and the other place comes out of the dark for the second
/// half.
#[allow(clippy::too_many_arguments)]
fn trip(
    mut commands: Commands,
    real: Res<Time<Real>>,
    mut trip: ResMut<Trip>,
    mut on_stairs: ResMut<OnStairs>,
    mut here: ResMut<Here>,
    field: Res<Field>,
    mut dungeon: ResMut<Dungeon>,
    mut blocked: ResMut<Blocked>,
    mut last: ResMut<LastTile>,
    sheet: Res<Sheet>,
    mage: Single<(&mut Mage, &mut Place, &mut Sprite)>,
    dark: Single<(&mut Sprite, &mut Visibility), (With<Dark>, Without<Mage>)>,
) {
    let Some((start, swapped)) = trip.0 else {
        return;
    };
    let (mut dark_sprite, mut dark_visibility) = dark.into_inner();
    let t = real.elapsed_secs_f64() - start;
    if !swapped && t >= TRIP / 2.0 {
        trip.0 = Some((start, true));
        let stairs = match *here {
            Here::Lot => {
                // Every trip down starts fresh, as `dungeon.json` has it.
                if let Some(root) = dungeon.0.root() {
                    commands.entity(root).despawn();
                }
                dungeon.0 = new_place(&mut commands, &sheet, DUNGEON_JSON, "dungeon.json", Visibility::Inherited);
                show(&mut commands, field.root(), Visibility::Hidden);
                *here = Here::Dungeon;
                blocked.0 = dungeon.0.blocked();
                dungeon.0.find("stairs_up")
            }
            Here::Dungeon => {
                show(&mut commands, dungeon.0.root(), Visibility::Hidden);
                show(&mut commands, field.root(), Visibility::Inherited);
                *here = Here::Lot;
                blocked.0 = field.blocked();
                field.find("stairs_down")
            }
        };
        let stairs = stairs.expect("a place with stairs");
        let (mut mage, mut place, mut sprite) = mage.into_inner();
        put_mage(&mut mage, &mut place, &mut sprite, &sheet, stairs);
        // Arriving on the stairs does not use them.
        last.0 = Some(stairs);
    }
    if t >= TRIP {
        trip.0 = None;
        on_stairs.0 = false;
        dark_visibility.set_if_neq(Visibility::Hidden);
        return;
    }
    let half = TRIP / 2.0;
    let darkness = if t < half { t / half } else { (TRIP - t) / half };
    dark_sprite.color = BROWN.with_alpha(darkness.clamp(0.0, 1.0) as f32);
    dark_visibility.set_if_neq(Visibility::Inherited);
}

fn show(commands: &mut Commands, root: Option<Entity>, visibility: Visibility) {
    if let Some(root) = root {
        commands.entity(root).insert(visibility);
    }
}
