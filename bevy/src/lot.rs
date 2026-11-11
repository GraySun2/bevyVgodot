//! The farm lot, drawn as `lot.json` says, with the mage on the start tile.
//!
//! `lot.json` is read from `../shared/` when the game is built.

use std::collections::HashMap;

use bevy::prelude::*;
use serde::Deserialize;

use crate::picture::{LOT_TOP, TILE, Z_GROUND, Z_MAGE, Z_THING, at};
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
pub fn tile_at(x: usize, y: usize, z: f32) -> Transform {
    at(
        (x as f32 + 0.5) * TILE,
        LOT_TOP + (y as f32 + 0.5) * TILE,
        z,
    )
}

pub fn plugin(app: &mut App) {
    app.add_systems(Startup, draw_lot);
}

fn draw_lot(mut commands: Commands, sheet: Res<Sheet>) {
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
                    commands.spawn((sheet.sprite(name), tile_at(x, y, z)));
                }
            }
        }
    }

    commands.spawn((
        sheet.sprite("mage_down"),
        tile_at(lot.start.x, lot.start.y, Z_MAGE),
    ));
}
