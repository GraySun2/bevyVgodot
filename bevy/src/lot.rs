//! The farm lot, drawn as `lot.json` says, with the mage on the start tile.
//! The dungeon floor (see `dungeon`) is drawn the same way, in the same place.
//!
//! `lot.json` is read from `../shared/` when the game is built. A tile of the
//! lot is named by its column and row, counted from the lot's top-left tile.

use std::collections::{HashMap, HashSet};

use bevy::prelude::*;
use serde::Deserialize;

use crate::dungeon::Here;
use crate::mage::mage;
use crate::picture::{LOT_TOP, TILE, Z_GROUND, Z_MAGE, Z_THING, at, moving};
use crate::sheet::Sheet;

const LOT_JSON: &str = include_str!("../../shared/lot.json");

/// How many tiles the lot is across and down.
pub const LOT_TILES: IVec2 = IVec2::new(9, 12);

/// The parts of a map (`lot.json`, `dungeon.json`) the game uses. `ground`
/// and `things` are rows of letters, top row first; each legend gives a
/// letter's sprite name, or nothing for an empty tile.
#[derive(Deserialize)]
struct MapFile {
    ground_legend: HashMap<char, Option<String>>,
    ground: Vec<String>,
    things_legend: HashMap<char, Option<String>>,
    things: Vec<String>,
}

/// The mage's starting tile, from `lot.json`.
#[derive(Deserialize)]
struct LotStart {
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

/// What is on one tile of the lot: its ground, and the thing standing on it
/// (rubble, weeds, the crate, a crop), each by its sprite's name and with the
/// sprite that draws it. A crop that has been watered also has the time it
/// was watered, by the game's clock in seconds.
#[derive(Default)]
struct Spot {
    ground: Option<(String, Entity)>,
    thing: Option<(String, Entity)>,
    watered_at: Option<f64>,
}

/// Every tile of a place (the lot, or the dungeon floor), as it is now.
/// Spells read and change it through this, so a second cast in the same frame
/// sees what the first one did. Its sprites all hang from one `root`, which
/// shows or hides the whole place. The `Field` resource is the lot.
#[derive(Resource, Default)]
pub struct Field {
    spots: HashMap<IVec2, Spot>,
    root: Option<Entity>,
}

impl Field {
    /// A place with nothing on it yet, its sprites hanging from `root`.
    pub fn new(root: Entity) -> Field {
        Field {
            spots: HashMap::new(),
            root: Some(root),
        }
    }

    /// The entity that every sprite of the place hangs from.
    pub fn root(&self) -> Option<Entity> {
        self.root
    }

    /// Draws a tile's sprite in the place.
    fn spawn(&self, commands: &mut Commands, sheet: &Sheet, tile: IVec2, name: &str, z: f32) -> Entity {
        let middle = tile_middle(tile);
        let mut sprite = commands.spawn((sheet.sprite(name), at(middle.x, middle.y, z)));
        if let Some(root) = self.root {
            sprite.insert(ChildOf(root));
        }
        sprite.id()
    }

    /// Draws a map (written the way `lot.json` is) on a place that has
    /// nothing on it: the ground first, then the things on top of it.
    fn draw(&mut self, commands: &mut Commands, sheet: &Sheet, json: &str, file: &str) {
        let map: MapFile = serde_json::from_str(json).expect(file);
        for (tile, name) in named_tiles(&map.ground, &map.ground_legend) {
            self.set_ground(commands, sheet, tile, name);
        }
        for (tile, name) in named_tiles(&map.things, &map.things_legend) {
            self.put_thing(commands, sheet, tile, name);
        }
    }

    /// The tiles the mage can't walk into.
    pub fn blocked(&self) -> HashSet<IVec2> {
        let blocking = |part: &Option<(String, Entity)>| part.as_ref().is_some_and(|(name, _)| blocks(name));
        self.spots
            .iter()
            .filter(|(_, spot)| blocking(&spot.ground) || blocking(&spot.thing))
            .map(|(tile, _)| *tile)
            .collect()
    }

    /// The first tile, top row first, whose ground or thing has this name.
    pub fn find(&self, name: &str) -> Option<IVec2> {
        self.spots().find_map(|(tile, ground, thing, _)| (ground == Some(name) || thing == Some(name)).then_some(tile))
    }

    /// The name of a tile's ground sprite, if it has one.
    pub fn ground(&self, tile: IVec2) -> Option<&str> {
        let (name, _) = self.spots.get(&tile)?.ground.as_ref()?;
        Some(name)
    }

    /// The name of the thing standing on a tile, if there is one.
    pub fn thing(&self, tile: IVec2) -> Option<&str> {
        let (name, _) = self.spots.get(&tile)?.thing.as_ref()?;
        Some(name)
    }

    /// Gives a tile new ground, drawn with the sprite of this name.
    pub fn set_ground(&mut self, commands: &mut Commands, sheet: &Sheet, tile: IVec2, name: &str) {
        let old = self.spots.get(&tile).and_then(|spot| spot.ground.as_ref()).map(|(_, entity)| *entity);
        let entity = match old {
            Some(entity) => {
                commands.entity(entity).insert(sheet.sprite(name));
                entity
            }
            None => self.spawn(commands, sheet, tile, name, Z_GROUND),
        };
        self.spots.entry(tile).or_default().ground = Some((name.to_string(), entity));
    }

    /// Puts a thing on a tile that has nothing on it.
    pub fn put_thing(&mut self, commands: &mut Commands, sheet: &Sheet, tile: IVec2, name: &str) {
        assert!(self.thing(tile).is_none(), "there is already something on {tile}");
        let entity = self.spawn(commands, sheet, tile, name, Z_THING);
        self.spots.entry(tile).or_default().thing = Some((name.to_string(), entity));
    }

    /// Takes away the thing on a tile, so the ground under it shows.
    pub fn take_thing(&mut self, commands: &mut Commands, tile: IVec2) {
        let Some(spot) = self.spots.get_mut(&tile) else {
            return;
        };
        spot.watered_at = None;
        if let Some((_, entity)) = spot.thing.take() {
            commands.entity(entity).despawn();
        }
    }

    /// Draws the thing on a tile with another sprite: a crop as it grows.
    pub fn change_thing(&mut self, commands: &mut Commands, sheet: &Sheet, tile: IVec2, name: &str) {
        if let Some((old, entity)) = self.spots.get_mut(&tile).and_then(|spot| spot.thing.as_mut()) {
            commands.entity(*entity).insert(sheet.sprite(name));
            *old = name.to_string();
        }
    }

    /// When the crop on a tile was watered, if it has been.
    pub fn watered_at(&self, tile: IVec2) -> Option<f64> {
        self.spots.get(&tile)?.watered_at
    }

    /// Waters the crop on a tile at this time: its ground turns to wet soil.
    pub fn water(&mut self, commands: &mut Commands, sheet: &Sheet, tile: IVec2, now: f64) {
        self.set_ground(commands, sheet, tile, "soil_wet");
        self.spots.entry(tile).or_default().watered_at = Some(now);
    }

    /// Every tile of the lot, top row first, with its ground, the thing on
    /// it, and when its crop was watered.
    pub fn spots(&self) -> impl Iterator<Item = (IVec2, Option<&str>, Option<&str>, Option<f64>)> {
        (0..LOT_TILES.y)
            .flat_map(|row| (0..LOT_TILES.x).map(move |column| IVec2::new(column, row)))
            .map(|tile| (tile, self.ground(tile), self.thing(tile), self.watered_at(tile)))
    }

    /// Puts a tile back as a saved game had it: its ground, the thing on it,
    /// and when its crop was watered.
    pub fn put_back(
        &mut self,
        commands: &mut Commands,
        sheet: &Sheet,
        tile: IVec2,
        ground: Option<&str>,
        thing: Option<&str>,
        watered_at: Option<f64>,
    ) {
        if let Some(ground) = ground
            && self.ground(tile) != Some(ground)
        {
            self.set_ground(commands, sheet, tile, ground);
        }
        if self.thing(tile) != thing {
            self.take_thing(commands, tile);
            if let Some(thing) = thing {
                self.put_thing(commands, sheet, tile, thing);
            }
        }
        self.spots.entry(tile).or_default().watered_at = watered_at;
    }

    /// Every watered crop's tile and when it was watered.
    pub fn watered(&self) -> Vec<(IVec2, f64)> {
        let watered = self.spots.iter();
        watered
            .filter_map(|(tile, spot)| Some((*tile, spot.watered_at?)))
            .collect()
    }
}

/// The tiles the mage can't walk into.
#[derive(Resource, Default)]
pub struct Blocked(pub HashSet<IVec2>);

/// Whether the mage can't walk into a tile that shows this sprite.
fn blocks(name: &str) -> bool {
    name.starts_with("house_") || name == "crate" || name == "wall" || name.starts_with("gate_")
}

/// The lot's own clock, in seconds: crops grow and weeds come by it. It runs
/// with the game's clock, but only while the mage is on the lot, so that the
/// lot waits while the mage is below.
#[derive(Resource, Default)]
pub struct LotClock(pub f64);

pub fn plugin(app: &mut App) {
    app.init_resource::<Blocked>()
        .init_resource::<Field>()
        .init_resource::<LotClock>()
        .add_systems(Startup, draw_lot)
        .add_systems(PreUpdate, run_lot_clock);
}

fn run_lot_clock(time: Res<Time>, here: Res<Here>, mut clock: ResMut<LotClock>) {
    if *here == Here::Lot {
        clock.0 += time.delta_secs_f64();
    }
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

/// A place's root: what all its sprites hang from. Hidden, it hides them.
pub fn place_root(commands: &mut Commands, visibility: Visibility) -> Entity {
    commands.spawn((Transform::IDENTITY, visibility)).id()
}

fn draw_lot(
    mut commands: Commands,
    sheet: Res<Sheet>,
    mut field: ResMut<Field>,
    mut blocked: ResMut<Blocked>,
) {
    *field = Field::new(place_root(&mut commands, Visibility::Inherited));
    field.draw(&mut commands, &sheet, LOT_JSON, "lot.json");
    blocked.0 = field.blocked();

    let lot: LotStart = serde_json::from_str(LOT_JSON).expect("lot.json");
    let start = tile_middle(IVec2::new(lot.start.x, lot.start.y));
    commands.spawn((mage(&sheet), moving(start.x, start.y, Z_MAGE)));
}

/// Draws a map on a new place with its own root, as `draw_lot` does the lot.
pub fn new_place(commands: &mut Commands, sheet: &Sheet, json: &str, file: &str, visibility: Visibility) -> Field {
    let mut field = Field::new(place_root(commands, visibility));
    field.draw(commands, sheet, json, file);
    field
}
