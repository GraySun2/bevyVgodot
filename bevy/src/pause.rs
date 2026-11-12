//! Pausing: the pause button in the top strip, and the pause panel (see
//! `panel`). The game also pauses by itself when the page is hidden: when
//! the player switches to another app or tab, or the phone's screen goes off.

use std::cell::Cell;

use bevy::prelude::*;
use bevy::time::TimeSystems;
use wasm_bindgen::JsCast;
use wasm_bindgen::closure::Closure;
use web_sys::VisibilityState;

use crate::Screen;
use crate::counts::piece;
use crate::panel::{OnStairs, Opening, PanelPart, Which, Z_PANEL, pressed_on};
use crate::picture::{Presses, Z_CONTROL};
use crate::sheet::Controls;
use crate::skills::open_panel;

/// The pause button: its top-left corner and size.
const BUTTON_CORNER: Vec2 = Vec2::new(246.0, 6.0);
const BUTTON_SIZE: Vec2 = Vec2::splat(36.0);

/// The pause panel's top-left corner.
const PANEL_CORNER: Vec2 = Vec2::new(48.0, 212.0);

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
            pause.after(open_panel).run_if(in_state(Screen::Playing)),
        );
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
) {
    if !HIDDEN.replace(false) {
        return;
    }
    if *screen.get() == Screen::Playing && opening.open() != Some(Which::Pause) {
        show_pause(&mut commands, &mut opening, &controls);
    }
}

/// A press that starts on the pause button, or the P key, pauses the game.
/// The P key also swaps the skills panel for the pause panel, as hiding the
/// page does.
fn pause(
    mut commands: Commands,
    presses: Res<Presses>,
    keys: Res<ButtonInput<KeyCode>>,
    mut opening: Opening,
    controls: Res<Controls>,
    on_stairs: Res<OnStairs>,
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
        show_pause(&mut commands, &mut opening, &controls);
    }
}

fn show_pause(commands: &mut Commands, opening: &mut Opening, controls: &Controls) {
    opening.show(commands, Which::Pause);
    commands.spawn((PanelPart, piece(controls, "panel_pause", PANEL_CORNER, Z_PANEL)));
}
