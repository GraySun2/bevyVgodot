//! The mage's mana, and the bar in the top strip that shows it.

use bevy::prelude::*;

use crate::Screen;
use crate::picture::{CREAM, Z_CONTROL, rect};

/// The most mana the mage can have. It has this much when the cover goes.
const FULL: f32 = 100.0;

/// How much mana comes back by itself each second.
const PER_SECOND: f32 = 6.5;

/// The bar's box, border and all: its top-left corner and its size, in
/// picture pixels. The border is 1 pixel; the inside shows the mana.
const BAR_CORNER: Vec2 = Vec2::new(8.0, 8.0);
const BAR_SIZE: Vec2 = Vec2::new(120.0, 12.0);
const BORDER: f32 = 1.0;

/// The inside of the bar: the mana the mage has, and the rest.
const HAS: Color = Color::srgb_u8(0x5a, 0xc8, 0xe8);
const REST: Color = Color::srgb_u8(0x1f, 0x3a, 0x36);

/// How much mana the mage has.
#[derive(Resource)]
pub struct Mana(pub f32);

/// Marks the part of the bar that grows and shrinks with the mana.
#[derive(Component)]
struct Has;

pub fn plugin(app: &mut App) {
    app.insert_resource(Mana(FULL))
        .add_systems(Startup, draw_bar)
        .add_systems(OnEnter(Screen::Playing), fill)
        .add_systems(Update, regain.run_if(in_state(Screen::Playing)))
        // After everything that spends mana in the frame.
        .add_systems(
            PostUpdate,
            show_mana
                .before(TransformSystems::Propagate)
                .run_if(resource_changed::<Mana>),
        );
}

fn draw_bar(mut commands: Commands) {
    let inside_corner = BAR_CORNER + BORDER;
    let inside = BAR_SIZE - 2.0 * BORDER;
    commands.spawn(rect(
        CREAM,
        BAR_CORNER.x,
        BAR_CORNER.y,
        BAR_SIZE.x,
        BAR_SIZE.y,
        Z_CONTROL,
    ));
    commands.spawn(rect(
        REST,
        inside_corner.x,
        inside_corner.y,
        inside.x,
        inside.y,
        Z_CONTROL + 0.1,
    ));
    // One pixel wide; `show_mana` stretches it to the right width.
    commands.spawn((
        Has,
        rect(
            HAS,
            inside_corner.x,
            inside_corner.y,
            1.0,
            inside.y,
            Z_CONTROL + 0.2,
        ),
    ));
}

fn fill(mut mana: ResMut<Mana>) {
    mana.0 = FULL;
}

/// Mana comes back all the time, by the clock, so as fast on a slow phone as
/// on a fast one.
pub fn regain(time: Res<Time>, mut mana: ResMut<Mana>) {
    mana.0 = (mana.0 + PER_SECOND * time.delta_secs()).min(FULL);
}

fn show_mana(mana: Res<Mana>, has: Single<(&mut Transform, &mut Visibility), With<Has>>) {
    // In proportion, to the nearest pixel.
    let inside_width = BAR_SIZE.x - 2.0 * BORDER;
    let width = (inside_width * mana.0 / FULL).round();
    let (mut transform, mut visibility) = has.into_inner();
    if width >= 1.0 {
        if transform.scale.x != width {
            transform.scale.x = width;
        }
        visibility.set_if_neq(Visibility::Inherited);
    } else {
        visibility.set_if_neq(Visibility::Hidden);
    }
}
