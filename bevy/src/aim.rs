//! The aimed tile: the tile spells are cast on. It is the tile in front of
//! the mage, or a nearby tile the player has touched.

use bevy::prelude::*;

use crate::Screen;
use crate::dungeon::Here;
use crate::panel::{OnStairs, Panel, panel_closed};
use crate::lot::{on_lot, tile_middle, tile_under};
use crate::mage::{Facing, Mage, walk};
use crate::picture::{Place, Presses, Z_AIM, at};
use crate::sheet::Controls;

/// A touch aims at a tile no more than this many tiles from the mage's tile,
/// across and up or down.
pub const TOUCH_REACH: i32 = 2;

#[derive(Resource, Default)]
pub struct Aim {
    /// The aimed tile, or nothing when the tile in front of the mage would be
    /// off the lot.
    pub tile: Option<IVec2>,
    touched: Option<Touched>,
}

/// A tile the player touched. It stays the aimed tile while the mage is on
/// the tile, and faces the way, it did at the touch.
struct Touched {
    tile: IVec2,
    mage_tile: IVec2,
    facing: Facing,
}

/// Marks the sprite that shows the aimed tile.
#[derive(Component)]
pub struct Mark;

pub fn plugin(app: &mut App) {
    app.init_resource::<Aim>()
        .add_systems(Startup, draw_mark)
        .add_systems(
            Update,
            take_aim
                .after(walk)
                .run_if(in_state(Screen::Playing))
                // And in the frame the places swap, so that the mark goes
                // with the mage even under the pause panel.
                .run_if(panel_closed.or_eager(resource_changed::<Here>)),
        );
}

fn draw_mark(mut commands: Commands, controls: Res<Controls>) {
    commands.spawn((
        Mark,
        controls.sprite("aim"),
        at(0.0, 0.0, Z_AIM),
        Visibility::Hidden,
    ));
}

/// It also runs while the mage is on the stairs, so that the mark goes with
/// the mage to the other place; but no touch aims then, or while a panel is
/// open.
pub fn take_aim(
    presses: Res<Presses>,
    on_stairs: Res<OnStairs>,
    panel: Res<Panel>,
    mage: Single<(&Mage, &Place)>,
    mut aim: ResMut<Aim>,
    mark: Single<(&mut Transform, &mut Visibility), With<Mark>>,
) {
    let (mage, place) = *mage;
    // The mage's tile is the one under the middle of its sprite.
    let Some(mage_tile) = tile_under(place.0) else {
        return;
    };
    let facing = mage.facing();

    // A touched tile is let go when the mage's tile changes or the mage turns.
    let moved_on = |touched: &Touched| touched.mage_tile != mage_tile || touched.facing != facing;
    if aim.touched.as_ref().is_some_and(moved_on) {
        aim.touched = None;
    }
    // A press that starts on a tile near enough aims at it.
    let presses = if on_stairs.0 || panel.is_open() { &[][..] } else { &presses.0[..] };
    for tile in presses.iter().filter_map(|press| tile_under(*press)) {
        if (tile - mage_tile).abs().max_element() <= TOUCH_REACH {
            aim.touched = Some(Touched {
                tile,
                mage_tile,
                facing,
            });
        }
    }
    // Otherwise it is the next tile the way the mage faces, if there is one.
    let in_front = mage_tile + facing.step();
    aim.tile = match &aim.touched {
        Some(touched) => Some(touched.tile),
        None => on_lot(in_front).then_some(in_front),
    };

    let (mut transform, mut visibility) = mark.into_inner();
    match aim.tile {
        Some(tile) => {
            let middle = tile_middle(tile);
            transform.set_if_neq(at(middle.x, middle.y, Z_AIM));
            visibility.set_if_neq(Visibility::Inherited);
        }
        None => {
            visibility.set_if_neq(Visibility::Hidden);
        }
    }
}
