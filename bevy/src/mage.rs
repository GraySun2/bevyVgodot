//! The mage: walking where the stick or the keys say, facing that way, and
//! stopping at what it can't cross.

use bevy::prelude::*;

use crate::Screen;
use crate::lot::Blocked;
use crate::picture::{LOT_HEIGHT, LOT_TOP, PICTURE, Place, TILE};
use crate::sheet::Sheet;
use crate::stick::{Stick, work_stick};

/// How fast the mage walks, in pixels a second: 3 tiles.
const SPEED: f32 = 96.0;

/// The knob has to be more than this many pixels out before the mage walks.
const STAND_STILL: f32 = 8.0;

/// For bumping into things the mage is a box in the middle of its sprite,
/// this many pixels from its middle to each side: 20 by 20.
const BODY: f32 = 10.0;

/// The lot's size in pixels.
const LOT: Vec2 = Vec2::new(PICTURE.x, LOT_HEIGHT);

#[derive(Component)]
pub struct Mage {
    facing: Facing,
}

impl Mage {
    pub fn facing(&self) -> Facing {
        self.facing
    }
}

#[derive(Clone, Copy, PartialEq)]
pub enum Facing {
    Up,
    Down,
    Left,
    Right,
}

impl Facing {
    /// The way the mage faces when it walks this way (right and down). At a
    /// slant the bigger part wins, and an even slant counts as left or right.
    fn of(way: Vec2) -> Facing {
        if way.x.abs() >= way.y.abs() {
            if way.x < 0.0 {
                Facing::Left
            } else {
                Facing::Right
            }
        } else if way.y < 0.0 {
            Facing::Up
        } else {
            Facing::Down
        }
    }

    /// One tile the way the mage faces, as columns and rows.
    pub fn step(self) -> IVec2 {
        match self {
            Facing::Up => IVec2::NEG_Y,
            Facing::Down => IVec2::Y,
            Facing::Left => IVec2::NEG_X,
            Facing::Right => IVec2::X,
        }
    }

    fn sprite(self) -> &'static str {
        match self {
            Facing::Up => "mage_up",
            Facing::Down => "mage_down",
            Facing::Left => "mage_left",
            Facing::Right => "mage_right",
        }
    }
}

/// The mage as the game starts, facing down. Add where it stands.
pub fn mage(sheet: &Sheet) -> impl Bundle {
    let facing = Facing::Down;
    (Mage { facing }, sheet.sprite(facing.sprite()))
}

pub fn plugin(app: &mut App) {
    app.add_systems(
        Update,
        walk.after(work_stick).run_if(in_state(Screen::Playing)),
    );
}

pub fn walk(
    time: Res<Time>,
    stick: Res<Stick>,
    keys: Res<ButtonInput<KeyCode>>,
    blocked: Res<Blocked>,
    sheet: Res<Sheet>,
    mage: Single<(&mut Mage, &mut Place, &mut Sprite)>,
) {
    // The way to walk, as right and down: the stick's, or the keys' while the
    // stick is at rest.
    let mut way = stick.knob;
    if way.length() <= STAND_STILL {
        let held = |arrow, letter| (keys.pressed(arrow) || keys.pressed(letter)) as i32;
        way = IVec2::new(
            held(KeyCode::ArrowRight, KeyCode::KeyD) - held(KeyCode::ArrowLeft, KeyCode::KeyA),
            held(KeyCode::ArrowDown, KeyCode::KeyS) - held(KeyCode::ArrowUp, KeyCode::KeyW),
        )
        .as_vec2();
    }
    let Some(way) = way.try_normalize() else {
        return;
    };
    let (mut mage, mut place, mut sprite) = mage.into_inner();

    let facing = Facing::of(way);
    if mage.facing != facing {
        mage.facing = facing;
        *sprite = sheet.sprite(facing.sprite());
    }

    // Where the mage's middle is on the lot, right and down from the lot's
    // top-left corner. Going across first and then down, each on its own,
    // lets a slanted push slide along whatever is in the way.
    let step = way * SPEED * time.delta_secs();
    let lot_corner = Vec2::new(0.0, LOT_TOP);
    let mut on_lot = place.0 - lot_corner;
    for across_or_down in [0, 1] {
        on_lot = go(on_lot, across_or_down, step[across_or_down], &blocked);
    }
    place.0 = on_lot + lot_corner;
}

/// Moves the mage `amount` pixels across (0) or down (1), stopping at the
/// lot's edge and at blocked tiles.
fn go(mut place: Vec2, across_or_down: usize, amount: f32, blocked: &Blocked) -> Vec2 {
    if amount == 0.0 {
        return place;
    }
    let i = across_or_down;
    // The whole sprite stays on the lot.
    place[i] = (place[i] + amount).clamp(TILE / 2.0, LOT[i] - TILE / 2.0);
    // Back out of every blocked tile the box is now in.
    let first = ((place - BODY) / TILE).floor().as_ivec2();
    let last = ((place + BODY) / TILE).ceil().as_ivec2() - 1;
    for y in first.y..=last.y {
        for x in first.x..=last.x {
            let tile = IVec2::new(x, y);
            if blocked.0.contains(&tile) {
                let near_edge = tile[i] as f32 * TILE;
                place[i] = if amount > 0.0 {
                    place[i].min(near_edge - BODY)
                } else {
                    place[i].max(near_edge + TILE + BODY)
                };
            }
        }
    }
    place
}
