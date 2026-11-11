//! The counts in the top strip, each a small picture with a number written
//! after it in the digit pieces. So far there is one: the seeds the mage
//! carries.

use bevy::prelude::*;
use bevy::sprite::Anchor;

use crate::Screen;
use crate::picture::{Z_CONTROL, at};
use crate::sheet::Controls;

/// How many seeds the mage has when the cover goes.
const FIRST_SEEDS: u32 = 8;

/// Where the seed count is: its picture's top-left corner, and the first
/// digit's.
const SEED_ICON: Vec2 = Vec2::new(8.0, 26.0);
const SEED_DIGITS: Vec2 = Vec2::new(28.0, 27.0);

/// Each next digit starts this many pixels further right.
const DIGIT_STEP: f32 = 12.0;

/// How many seeds the mage carries.
#[derive(Resource)]
pub struct Seeds(pub u32);

/// Marks the digits that write the seed count.
#[derive(Component, Clone)]
struct SeedDigit;

pub fn plugin(app: &mut App) {
    app.insert_resource(Seeds(FIRST_SEEDS))
        .add_systems(Startup, draw_icons)
        .add_systems(OnEnter(Screen::Playing), fill)
        // After everything that changes the count in the frame.
        .add_systems(
            PostUpdate,
            show_seeds
                .before(TransformSystems::Propagate)
                .run_if(resource_changed::<Seeds>),
        );
}

/// A piece of the controls' art, placed by its top-left corner.
fn piece(controls: &Controls, name: &str, corner: Vec2) -> impl Bundle {
    (
        controls.sprite(name),
        Anchor::TOP_LEFT,
        at(corner.x, corner.y, Z_CONTROL),
    )
}

fn draw_icons(mut commands: Commands, controls: Res<Controls>) {
    commands.spawn(piece(&controls, "icon_seed", SEED_ICON));
}

fn fill(mut seeds: ResMut<Seeds>) {
    seeds.0 = FIRST_SEEDS;
}

fn show_seeds(
    mut commands: Commands,
    seeds: Res<Seeds>,
    controls: Res<Controls>,
    old: Query<Entity, With<SeedDigit>>,
) {
    for digit in &old {
        commands.entity(digit).despawn();
    }
    write_number(&mut commands, &controls, seeds.0, SEED_DIGITS, SeedDigit);
}

/// Writes a number with the digit pieces, the first digit's top-left corner
/// at `corner`, with no zeros in front. Each digit gets `marker`.
fn write_number(
    commands: &mut Commands,
    controls: &Controls,
    number: u32,
    corner: Vec2,
    marker: impl Component + Clone,
) {
    for (i, digit) in number.to_string().chars().enumerate() {
        let left = corner + Vec2::new(i as f32 * DIGIT_STEP, 0.0);
        commands.spawn((
            marker.clone(),
            piece(controls, &format!("digit_{digit}"), left),
        ));
    }
}
