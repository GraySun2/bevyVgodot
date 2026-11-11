//! A small farming game for a phone's web browser, held upright.
//!
//! Each part of the game is one file with a `plugin` function:
//! - `picture`: the upright picture, its layout, and fitting it to the screen
//! - `sheet`: the shared sprite sheet
//! - `lot`: the farm lot and the mage
//! - `cover`: the "Tap to play" cover

mod cover;
mod lot;
mod picture;
mod sheet;

use bevy::prelude::*;

/// Which screen the player is on. The page opens on the cover; one tap moves
/// on to playing, and nothing goes back.
#[derive(States, Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum Screen {
    #[default]
    Cover,
    Playing,
}

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                // Draw on the canvas in index.html, at whatever size the page gives it.
                canvas: Some("#game".into()),
                fit_canvas_to_parent: true,
                ..default()
            }),
            ..default()
        }))
        .init_state::<Screen>()
        .add_plugins((picture::plugin, sheet::plugin, lot::plugin, cover::plugin))
        .run();
}
