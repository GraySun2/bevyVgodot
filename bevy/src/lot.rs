//! The farm lot, drawn as `lot.json` says, with the mage on the start tile.
//!
//! `lot.json` is read from `../shared/` when the game is built.

use std::collections::{HashMap, HashSet};

use bevy::prelude::*;
use serde::Deserialize;

use crate::mage::mage;
use crate::picture::{LOT_TOP, TILE, Z_GROUND, Z_MAGE, Z_THING, at, moving};
use crate::sheet::Sheet;

const LOT_JSON: &str = include_str!("../../shared/lot.json");

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
    x: usize,
    y: usize,
}

/// The middle of the lot tile in column `x` and row `y`, counted from the
/// lot's top-left tile.
pub fn tile_middle(x: usize, y: usize) -> Vec2 {
    Vec2::new((x as f32 + 0.5) * TILE, LOT_TOP + (y as f32 + 0.5) * TILE)
}

/// The lot tiles the mage can't walk into, each as its column and row counted
/// from the lot's top-left tile.
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

fn draw_lot(mut commands: Commands, sheet: Res<Sheet>, mut blocked: ResMut<Blocked>) {
    let lot: LotFile = serde_json::from_str(LOT_JSON).expect("lot.json");

    // The ground first, then the things on top of it.
    for (rows, legend, z) in [
        (&lot.ground, &lot.ground_legend, Z_GROUND),
        (&lot.things, &lot.things_legend, Z_THING),
    ] {
        for (y, row) in rows.iter().enumerate() {
            for (x, letter) in row.chars().enumerate() {
                let Some(name) = legend.get(&letter) else {
                    panic!("lot.json: the letter {letter:?} is not in its legend");
                };
                if let Some(name) = name {
                    let middle = tile_middle(x, y);
                    commands.spawn((sheet.sprite(name), at(middle.x, middle.y, z)));
                    if blocks(name) {
                        blocked.0.insert(IVec2::new(x as i32, y as i32));
                    }
                }
            }
        }
    }

    let start = tile_middle(lot.start.x, lot.start.y);
    commands.spawn((mage(&sheet), moving(start.x, start.y, Z_MAGE)));
}
