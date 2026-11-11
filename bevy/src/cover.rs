//! The cover the page opens on. One tap or click anywhere takes it away for
//! good.

use bevy::prelude::*;

use crate::Screen;
use crate::picture::{CREAM, GREEN, PICTURE, TILE, TextSize, Z_COVER, at, rect};

pub fn plugin(app: &mut App) {
    app.add_systems(OnEnter(Screen::Cover), show_cover)
        .add_systems(Update, tap_to_play.run_if(in_state(Screen::Cover)));
}

fn show_cover(mut commands: Commands) {
    // Both go away by themselves when the screen is no longer the cover.
    commands.spawn((
        DespawnOnExit(Screen::Cover),
        rect(GREEN, 0.0, 0.0, PICTURE.x, PICTURE.y, Z_COVER),
    ));
    commands.spawn((
        DespawnOnExit(Screen::Cover),
        Text2d::new("Tap to play"),
        TextColor(CREAM),
        // About one tile from the top of the T to the tails of the p and y.
        TextSize(TILE),
        at(PICTURE.x / 2.0, PICTURE.y / 2.0, Z_COVER + 1.0),
    ));
}

fn tap_to_play(
    mouse: Res<ButtonInput<MouseButton>>,
    touches: Res<Touches>,
    mut screen: ResMut<NextState<Screen>>,
) {
    if mouse.just_pressed(MouseButton::Left) || touches.any_just_pressed() {
        screen.set(Screen::Playing);
    }
}
