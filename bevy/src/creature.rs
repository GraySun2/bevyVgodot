//! The creatures on the dungeon floor (see `dungeon`).
//!
//! Each trip down, all four stand on the middles of their starting tiles from
//! `dungeon.json`, each with 3 nerve. A creature walks straight toward the
//! mage while the mage is near. Gust throws it and Draw slows it, and each
//! takes 1 nerve; with none left it is gone until the next trip down. A
//! creature that touches the mage takes half its mana and puts it back on
//! the stairs.

use bevy::ecs::system::SystemParam;
use bevy::prelude::*;
use serde::Deserialize;

use crate::Screen;
use crate::dungeon::{Dungeon, LastTile, SteppingOn, below};
use crate::lot::{Blocked, tile_middle, tile_under};
use crate::mage::{BODY, Facing, Mage, put_mage, step_box, walk};
use crate::mana::Mana;
use crate::panel::not_still;
use crate::picture::{Place, Z_MAGE, moving};
use crate::sheet::Sheet;
use crate::sound::Sounds;

const DUNGEON_JSON: &str = include_str!("../../shared/dungeon.json");

/// The nerve each creature comes down with.
const NERVE: u32 = 3;

/// How fast a creature walks, in pixels a second, and how fast while slowed.
const SPEED: f32 = 57.6;
const SLOW_SPEED: f32 = 28.8;

/// How long Draw slows a creature, in seconds of the game's clock.
const SLOW_SECONDS: f32 = 2.0;

/// A creature comes for the mage while the mage's tile is no more than this
/// many tiles from its own, across and up or down.
const NEAR: i32 = 4;

/// How far Gust throws a creature, in pixels.
const THROW: i32 = 64;

/// Over the ground, the things and the aim mark, and under the mage.
const Z_CREATURE: f32 = Z_MAGE - 0.25;

#[derive(Component)]
pub struct Creature {
    start: IVec2,
    nerve: u32,
    /// How much longer it walks at half speed, in seconds.
    slow: f32,
}

/// The creatures' starting tiles, from `dungeon.json`.
#[derive(Deserialize)]
struct Starts {
    creatures: Vec<StartTile>,
}

#[derive(Deserialize)]
struct StartTile {
    x: i32,
    y: i32,
}

pub fn plugin(app: &mut App) {
    app.add_systems(
        Update,
        (chase.after(walk), touch)
            .chain()
            .before(SteppingOn)
            .run_if(in_state(Screen::Playing))
            .run_if(not_still)
            .run_if(below),
    );
}

/// Puts all four creatures on the middles of their starting tiles, hanging
/// from the dungeon floor's root, so they show and go with it.
pub fn spawn_creatures(commands: &mut Commands, sheet: &Sheet, root: Entity) {
    let starts: Starts = serde_json::from_str(DUNGEON_JSON).expect("dungeon.json");
    for start in starts.creatures {
        let start = IVec2::new(start.x, start.y);
        let middle = tile_middle(start);
        commands.spawn((
            Creature {
                start,
                nerve: NERVE,
                slow: 0.0,
            },
            sheet.sprite("creature"),
            moving(middle.x, middle.y, Z_CREATURE),
            ChildOf(root),
        ));
    }
}

/// What stops a creature: what stops the mage below (walls, and gates while
/// they are there), and the `stairs_up` tile too.
fn stops<'a>(blocked: &'a Blocked, dungeon: &Dungeon) -> impl Fn(IVec2) -> bool + 'a {
    let stairs = dungeon.0.find("stairs_up");
    move |tile| blocked.0.contains(&tile) || Some(tile) == stairs
}

/// While the mage is near, each creature walks straight toward the mage's
/// middle, as far as what stops it lets it. Its slow seconds run meanwhile.
fn chase(
    time: Res<Time>,
    blocked: Res<Blocked>,
    dungeon: Res<Dungeon>,
    mage: Single<&Place, With<Mage>>,
    mut creatures: Query<(&mut Creature, &mut Place), Without<Mage>>,
) {
    let seconds = time.delta_secs();
    let target = mage.0;
    let Some(mage_tile) = tile_under(target) else {
        return;
    };
    let stops = stops(&blocked, &dungeon);
    for (mut creature, mut place) in &mut creatures {
        let speed = if creature.slow > 0.0 { SLOW_SPEED } else { SPEED };
        creature.slow = (creature.slow - seconds).max(0.0);
        let Some(tile) = tile_under(place.0) else {
            continue;
        };
        if creature.nerve == 0 || (mage_tile - tile).abs().max_element() > NEAR {
            continue;
        }
        let to_mage = target - place.0;
        let far = to_mage.length();
        if far > 0.0 {
            let step = to_mage / far * (speed * seconds).min(far);
            place.0 = step_box(place.0, step, &stops);
        }
    }
}

/// A creature whose box overlaps the mage's has touched it: the mage loses
/// half its mana and is put on the middle of `stairs_up`, facing down, still
/// below; `no.wav` plays; and every creature on the floor goes back to the
/// middle of its starting tile, with the nerve it has left.
#[allow(clippy::too_many_arguments)]
fn touch(
    mut commands: Commands,
    mut mana: ResMut<Mana>,
    sheet: Res<Sheet>,
    sounds: Res<Sounds>,
    dungeon: Res<Dungeon>,
    mut last: ResMut<LastTile>,
    mage: Single<(&mut Mage, &mut Place, &mut Sprite)>,
    mut creatures: Query<(&Creature, &mut Place), Without<Mage>>,
) {
    let (mut mage, mut mage_place, mut sprite) = mage.into_inner();
    let touched = creatures.iter().any(|(creature, place)| {
        let apart = (place.0 - mage_place.0).abs();
        creature.nerve > 0 && apart.x < 2.0 * BODY && apart.y < 2.0 * BODY
    });
    let Some(stairs) = dungeon.0.find("stairs_up") else {
        return;
    };
    if !touched {
        return;
    }
    mana.0 /= 2.0;
    put_mage(&mut mage, &mut mage_place, &mut sprite, &sheet, stairs);
    // Being put on the stairs does not take the mage up.
    last.0 = Some(stairs);
    sounds.play(&mut commands, "no");
    for (creature, mut place) in &mut creatures {
        place.0 = tile_middle(creature.start);
    }
}

/// What a spell needs to reach the creatures: where the mage is and which
/// way it faces, and the creatures.
#[derive(SystemParam)]
pub struct Creatures<'w, 's> {
    mage: Single<'w, 's, (&'static Mage, &'static Place)>,
    creatures: Query<'w, 's, (Entity, &'static mut Creature, &'static mut Place), Without<Mage>>,
}

impl Creatures<'_, '_> {
    /// Whether a creature stands on this tile.
    pub fn on(&self, tile: IVec2) -> bool {
        self.creatures
            .iter()
            .any(|(_, creature, place)| creature.nerve > 0 && tile_under(place.0) == Some(tile))
    }

    /// Gust on this tile: each creature on it loses 1 nerve and is thrown
    /// 64 pixels straight away from the mage, stopping short of what stops it.
    pub fn gust(&mut self, commands: &mut Commands, tile: IVec2, blocked: &Blocked, dungeon: &Dungeon) {
        let (mage, mage_place) = *self.mage;
        let way = match tile_under(mage_place.0) {
            Some(mage_tile) => away(tile - mage_tile, mage.facing()),
            None => mage.facing().step(),
        };
        let stops = stops(blocked, dungeon);
        self.hit(commands, tile, |_, place| {
            // A pixel at a time, so that it can't jump over a wall.
            for _ in 0..THROW {
                let next = step_box(place.0, way.as_vec2(), &stops);
                if next == place.0 {
                    break;
                }
                place.0 = next;
            }
        });
    }

    /// Draw on this tile: each creature on it loses 1 nerve and walks at half
    /// speed for the next 2 seconds.
    pub fn draw(&mut self, commands: &mut Commands, tile: IVec2) {
        self.hit(commands, tile, |creature, _| creature.slow = SLOW_SECONDS);
    }

    /// Takes 1 nerve from each creature on the tile; one with none left is
    /// gone at once, and the rest get `then`.
    fn hit(&mut self, commands: &mut Commands, tile: IVec2, mut then: impl FnMut(&mut Creature, &mut Place)) {
        for (entity, mut creature, mut place) in &mut self.creatures {
            if creature.nerve == 0 || tile_under(place.0) != Some(tile) {
                continue;
            }
            creature.nerve -= 1;
            if creature.nerve == 0 {
                commands.entity(entity).despawn();
            } else {
                then(&mut creature, &mut place);
            }
        }
    }
}

/// Straight away from the mage, toward the aimed tile: the bigger part of the
/// slant counts, an even slant counts as left or right, and the mage's own
/// tile counts as the way it faces.
fn away(from_mage: IVec2, facing: Facing) -> IVec2 {
    if from_mage == IVec2::ZERO {
        facing.step()
    } else if from_mage.x.abs() >= from_mage.y.abs() {
        IVec2::new(from_mage.x.signum(), 0)
    } else {
        IVec2::new(0, from_mage.y.signum())
    }
}
