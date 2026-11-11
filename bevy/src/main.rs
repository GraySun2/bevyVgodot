//! A small farming game for a phone's web browser, held upright.
//!
//! Each part of the game is one file with a `plugin` function:
//! - `picture`: the upright picture, its layout, and fitting it to the screen
//! - `sheet`: the shared art
//! - `lot`: the farm lot
//! - `stick`: the thumb stick
//! - `mage`: the mage and its walking
//! - `mana`: the mage's mana and the bar that shows it
//! - `aim`: the aimed tile
//! - `spell`: spells and their buttons
//! - `sound`: the sounds
//! - `cover`: the "Tap to play" cover

mod aim;
mod cover;
mod lot;
mod mage;
mod mana;
mod picture;
mod sheet;
mod sound;
mod spell;
mod stick;

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
        .add_plugins((
            picture::plugin,
            sheet::plugin,
            lot::plugin,
            stick::plugin,
            mage::plugin,
            mana::plugin,
            aim::plugin,
            sound::plugin,
            spell::plugin,
            cover::plugin,
        ))
        .run();
}
