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
//! - `counts`: the counts in the top strip: seeds, crops and coins
//! - `spell`: spells and their buttons
//! - `crop`: crops growing, being picked and sold, and weeds coming back
//! - `dungeon`: the dungeon floor under the lot, and the stairs
//! - `creature`: the creatures on the dungeon floor
//! - `panel`: the panels that stop the game while they are open
//! - `skills`: the schools of magic, their levels, and the skills panel
//! - `pause`: pausing, by the pause button or when the page is hidden
//! - `save`: saving the game in the browser, and putting it back
//! - `sound`: the sounds
//! - `cover`: the "Tap to play" cover

mod aim;
mod counts;
mod cover;
mod creature;
mod crop;
mod dungeon;
mod lot;
mod mage;
mod mana;
mod panel;
mod pause;
mod picture;
mod save;
mod sheet;
mod skills;
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

/// What happens as the cover goes, in this order: everything starts as new,
/// then a saved game, if there is one, is put back over it.
#[derive(SystemSet, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Start {
    New,
    Saved,
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
        .configure_sets(OnEnter(Screen::Playing), (Start::New, Start::Saved).chain())
        .add_plugins((
            picture::plugin,
            sheet::plugin,
            lot::plugin,
            stick::plugin,
            mage::plugin,
            mana::plugin,
            counts::plugin,
            aim::plugin,
            sound::plugin,
            spell::plugin,
            crop::plugin,
            dungeon::plugin,
            creature::plugin,
        ))
        .add_plugins((
            panel::plugin,
            skills::plugin,
            pause::plugin,
            save::plugin,
            cover::plugin,
        ))
        .run();
}
