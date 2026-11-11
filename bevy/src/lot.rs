//! The farm lot, drawn as `lot.json` says, with the mage on the start tile.
//!
//! `lot.json` is read from `../shared/` when the game is built. A tile of the
//! lot is named by its column and row, counted from the lot's top-left tile.

use std::collections::{HashMap, HashSet};

use bevy::prelude::*;
use serde::Deserialize;

use crate::mage::mage;
use crate::picture::{LOT_TOP, TILE, Z_GROUND, Z_MAGE, Z_THING, at, moving};
use crate::sheet::Sheet;

const LOT_JSON: &str = include_str!("../../shared/lot.json");

/// How many tiles the lot is across and down.
pub const LOT_TILES: IVec2 = IVec2::new(9, 12);

/// The parts of `lot.json` the game uses. `ground` and `things` are rows of
/// letters, top row first; each legend gives a letter's sprite name, or
/// nothing for an empty tile.
#[derive(Deserialize)]
struct LotFile {
    ground_legend: HashMap<char, Option<String>>,
    ground: Vec<String>,
    things_legend: HashMap<char, Option<String>>,
    things: Vec<String>,
    start: Start,
}

#[derive(Deserialize)]
struct Start {
    x: i32,
    y: i32,
}

/// Whether there is such a tile on the lot.
pub fn on_lot(tile: IVec2) -> bool {
    tile.cmpge(IVec2::ZERO).all() && tile.cmplt(LOT_TILES).all()
}

/// The middle of a tile, as a place in the picture.
pub fn tile_middle(tile: IVec2) -> Vec2 {
    Vec2::new(0.0, LOT_TOP) + (tile.as_vec2() + 0.5) * TILE
}

/// The tile under a place in the picture, or nothing if the place is off the
/// lot.
pub fn tile_under(place: Vec2) -> Option<IVec2> {
    let tile = ((place - Vec2::new(0.0, LOT_TOP)) / TILE)
        .floor()
        .as_ivec2();
    on_lot(tile).then_some(tile)
}

/// A thing that stands on a tile, over the ground: rubble, weeds or the
/// crate. `name` is its sprite's name.
#[derive(Component)]
pub struct Thing {
    pub tile: IVec2,
    pub name: String,
}

/// The tiles the mage can't walk into.
#[derive(Resource, Default)]
pub struct Blocked(pub HashSet<IVec2>);

/// Whether the mage can't walk into a tile that shows this sprite.
fn blocks(name: &str) -> bool {
    name.starts_with("house_") || name == "crate"
}

pub fn plugin(app: &mut App) {
    app.init_resource::<Blocked>()
        .add_systems(Startup, draw_lot);
}

/// Every tile that has a sprite in these rows of letters, with the sprite's
/// name.
fn named_tiles<'a>(
    rows: &'a [String],
    legend: &'a HashMap<char, Option<String>>,
) -> impl Iterator<Item = (IVec2, &'a str)> {
    rows.iter().enumerate().flat_map(move |(y, row)| {
        row.chars().enumerate().filter_map(move |(x, letter)| {
            let Some(name) = legend.get(&letter) else {
                panic!("lot.json: the letter {letter:?} is not in its legend");
            };
            Some((IVec2::new(x as i32, y as i32), name.as_deref()?))
        })
    })
}

fn draw_lot(mut commands: Commands, sheet: Res<Sheet>, mut blocked: ResMut<Blocked>) {
    let lot: LotFile = serde_json::from_str(LOT_JSON).expect("lot.json");

    // The ground first, then the things on top of it.
    for (tile, name) in named_tiles(&lot.ground, &lot.ground_legend) {
        let middle = tile_middle(tile);
        commands.spawn((sheet.sprite(name), at(middle.x, middle.y, Z_GROUND)));
        if blocks(name) {
            blocked.0.insert(tile);
        }
    }
    for (tile, name) in named_tiles(&lot.things, &lot.things_legend) {
        let middle = tile_middle(tile);
        commands.spawn((
            Thing {
                tile,
                name: name.to_string(),
            },
            sheet.sprite(name),
            at(middle.x, middle.y, Z_THING),
        ));
        if blocks(name) {
            blocked.0.insert(tile);
        }
    }

    let start = tile_middle(IVec2::new(lot.start.x, lot.start.y));
    commands.spawn((mage(&sheet), moving(start.x, start.y, Z_MAGE)));
}
