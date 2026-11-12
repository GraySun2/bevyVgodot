//! Pausing: the pause button in the top strip, and the pause panel (see
//! `panel`). The game also pauses by itself when the page is hidden: when
//! the player switches to another app or tab, or the phone's screen goes off.
//!
//! Under the pause panel are two settings: the sound, on or off, and erasing
//! the saved game, which asks first.

use std::cell::Cell;

use bevy::prelude::*;
use bevy::time::TimeSystems;
use wasm_bindgen::JsCast;
use wasm_bindgen::closure::Closure;
use web_sys::VisibilityState;

use crate::Screen;
use crate::counts::piece;
use crate::panel::{OnStairs, Opening, Panel, PanelPart, Which, Z_PANEL, on_box, pressed_on};
use crate::picture::{Presses, Z_CONTROL};
use crate::save::erase;
use crate::sheet::Controls;
use crate::skills::open_panel;
use crate::sound::Sounds;

/// The pause button: its top-left corner and size.
const BUTTON_CORNER: Vec2 = Vec2::new(246.0, 6.0);
const BUTTON_SIZE: Vec2 = Vec2::splat(36.0);

/// The pause panel's top-left corner.
const PANEL_CORNER: Vec2 = Vec2::new(48.0, 212.0);

/// The two settings under the pause panel: their top-left corners and size.
const SOUND_CORNER: Vec2 = Vec2::new(48.0, 272.0);
const ERASE_CORNER: Vec2 = Vec2::new(48.0, 304.0);
const SETTING_SIZE: Vec2 = Vec2::new(192.0, 28.0);

/// Marks the sound setting.
#[derive(Component)]
struct SoundSetting;

/// The erase setting, and whether it is asking "sure?". Each pause starts
/// with it not asking.
#[derive(Component)]
struct EraseSetting {
    sure: bool,
}

thread_local! {
    /// Whether the page has been hidden since the game last looked. The
    /// browser says so between frames, so the next frame takes note.
    static HIDDEN: Cell<bool> = const { Cell::new(false) };
}

pub fn plugin(app: &mut App) {
    app.add_systems(Startup, (draw_button, listen))
        // Before the game's clock moves on in the frame, so that no time
        // passes in the game after the page was hidden.
        .add_systems(First, pause_when_hidden.before(TimeSystems))
        .add_systems(
            Update,
            (pause.after(open_panel), work_settings.after(pause))
                .run_if(in_state(Screen::Playing)),
        );
}

/// Whether this place is on one of the two settings.
pub fn on_setting(place: Vec2) -> bool {
    on_box(place, SOUND_CORNER, SETTING_SIZE) || on_box(place, ERASE_CORNER, SETTING_SIZE)
}

fn draw_button(mut commands: Commands, controls: Res<Controls>) {
    commands.spawn(piece(&controls, "button_pause", BUTTON_CORNER, Z_CONTROL));
}

/// Asks the browser to say when the page is hidden.
fn listen() {
    let Some(document) = web_sys::window().and_then(|window| window.document()) else {
        return;
    };
    let on_change = Closure::<dyn Fn()>::new(|| {
        let document = web_sys::window().and_then(|window| window.document());
        if document.is_some_and(|document| document.visibility_state() == VisibilityState::Hidden) {
            HIDDEN.set(true);
        }
    });
    let _ = document
        .add_event_listener_with_callback("visibilitychange", on_change.as_ref().unchecked_ref());
    // It listens for as long as the page is open.
    on_change.forget();
}

/// After the page was hidden, the game is paused and the pause panel shows,
/// in place of the skills panel if that was open. While the cover is still
/// up, there is nothing to pause.
fn pause_when_hidden(
    mut commands: Commands,
    screen: Res<State<Screen>>,
    mut opening: Opening,
    controls: Res<Controls>,
    sounds: Res<Sounds>,
) {
    if !HIDDEN.replace(false) {
        return;
    }
    if *screen.get() == Screen::Playing && opening.open() != Some(Which::Pause) {
        show_pause(&mut commands, &mut opening, &controls, &sounds);
    }
}

/// A press that starts on the pause button, or the P key, pauses the game.
/// The P key also swaps the skills panel for the pause panel, as hiding the
/// page does.
pub fn pause(
    mut commands: Commands,
    presses: Res<Presses>,
    keys: Res<ButtonInput<KeyCode>>,
    mut opening: Opening,
    controls: Res<Controls>,
    on_stairs: Res<OnStairs>,
    sounds: Res<Sounds>,
) {
    // Not while the mage is on the stairs: the game stands still then anyway.
    if on_stairs.0 {
        return;
    }
    let key = keys.just_pressed(KeyCode::KeyP);
    let asked = match opening.open() {
        None => key || pressed_on(&presses, BUTTON_CORNER, BUTTON_SIZE),
        Some(Which::Skills) => key,
        Some(Which::Pause) => false,
    };
    if asked {
        show_pause(&mut commands, &mut opening, &controls, &sounds);
    }
}

/// Opens the pause panel, with the two settings under it.
fn show_pause(commands: &mut Commands, opening: &mut Opening, controls: &Controls, sounds: &Sounds) {
    opening.show(commands, Which::Pause);
    commands.spawn((PanelPart, piece(controls, "panel_pause", PANEL_CORNER, Z_PANEL)));
    commands.spawn((
        PanelPart,
        SoundSetting,
        piece(controls, sound_piece(sounds), SOUND_CORNER, Z_PANEL),
    ));
    commands.spawn((
        PanelPart,
        EraseSetting { sure: false },
        piece(controls, erase_piece(false), ERASE_CORNER, Z_PANEL),
    ));
}

fn sound_piece(sounds: &Sounds) -> &'static str {
    if sounds.is_on() { "set_sound_on" } else { "set_sound_off" }
}

fn erase_piece(sure: bool) -> &'static str {
    if sure { "set_erase_sure" } else { "set_erase" }
}

/// While the game is paused, a press that starts on the sound setting
/// switches the sound. One that starts on the erase setting asks first, and
/// a second one erases the saved game and starts the game over as new. Any
/// other press takes the question back; one that is not on a setting also
/// ends the pause (see `panel`). A press in the frame the pause began does
/// nothing here, as it does nothing to the panel.
fn work_settings(
    presses: Res<Presses>,
    panel: Res<Panel>,
    controls: Res<Controls>,
    mut sounds: ResMut<Sounds>,
    mut sound_setting: Query<&mut Sprite, (With<SoundSetting>, Without<EraseSetting>)>,
    mut erase_setting: Query<(&mut EraseSetting, &mut Sprite), Without<SoundSetting>>,
) {
    if panel.open() != Some(Which::Pause) || panel.just_opened() || presses.0.is_empty() {
        return;
    }
    let on_sound = presses
        .0
        .iter()
        .filter(|&&press| on_box(press, SOUND_CORNER, SETTING_SIZE))
        .count();
    let on_erase = presses
        .0
        .iter()
        .filter(|&&press| on_box(press, ERASE_CORNER, SETTING_SIZE))
        .count();
    let elsewhere = presses.0.len() - on_sound - on_erase;

    // Each press on it switches it once.
    if on_sound % 2 == 1 {
        let on = !sounds.is_on();
        sounds.set_on(on);
        for mut sprite in &mut sound_setting {
            *sprite = controls.sprite(sound_piece(&sounds));
        }
    }
    for (mut setting, mut sprite) in &mut erase_setting {
        if on_sound > 0 || elsewhere > 0 {
            setting.sure = false;
        } else if setting.sure {
            erase();
            return;
        } else {
            setting.sure = true;
        }
        *sprite = controls.sprite(erase_piece(setting.sure));
    }
}
