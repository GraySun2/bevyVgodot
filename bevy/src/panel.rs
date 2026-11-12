//! The panels that stop the game: the skills panel and the pause panel.
//!
//! While one is open, the game's clock stands still and the parts of the
//! game the player works do nothing. The same goes while the mage is on the
//! stairs, going up or down (see `dungeon`). The next press, wherever it starts,
//! closes it and does nothing else, and so does the panel's own key. Then the
//! game goes on from where it was. Whoever opens a panel draws its parts.

use bevy::prelude::*;

use crate::Screen;
use crate::picture::{Presses, Z_MAGE};

/// Over the lot and everything on it, and over the level-up pop.
pub const Z_PANEL: f32 = Z_MAGE + 3.0;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Which {
    Skills,
    Pause,
}

impl Which {
    /// The key that closes it, for testing. It opens it too.
    fn key(self) -> KeyCode {
        match self {
            Which::Skills => KeyCode::KeyK,
            Which::Pause => KeyCode::KeyP,
        }
    }
}

/// Which panel is open, if one is. `just_opened` keeps the press or key that
/// opened it from closing it in the same frame.
#[derive(Resource, Default)]
pub struct Panel {
    open: Option<Which>,
    just_opened: bool,
}

/// Marks every part of the open panel.
#[derive(Component)]
pub struct PanelPart;

/// What opening a panel needs: the panel, the game's clock, and the parts of
/// a panel that may be open already.
#[derive(bevy::ecs::system::SystemParam)]
pub struct Opening<'w, 's> {
    panel: ResMut<'w, Panel>,
    time: ResMut<'w, Time<Virtual>>,
    parts: Query<'w, 's, Entity, With<PanelPart>>,
}

impl Panel {
    pub fn is_open(&self) -> bool {
        self.open.is_some()
    }
}

impl Opening<'_, '_> {
    pub fn open(&self) -> Option<Which> {
        self.panel.open
    }

    /// Opens this panel in place of any that is open, and stops the clock at
    /// once (`hold_clock` keeps it stopped).
    /// The caller then draws the panel's parts, each marked `PanelPart`.
    pub fn show(&mut self, commands: &mut Commands, which: Which) {
        for part in &self.parts {
            commands.entity(part).despawn();
        }
        self.panel.open = Some(which);
        self.panel.just_opened = true;
        self.time.pause();
    }
}

/// Whether the mage is on the stairs, going up or down. `dungeon` says so.
#[derive(Resource, Default)]
pub struct OnStairs(pub bool);

/// Whether no panel is open.
pub fn panel_closed(panel: Res<Panel>) -> bool {
    panel.open.is_none()
}

/// For the game's systems that the player works: they do nothing while a
/// panel is open or the mage is on the stairs.
pub fn not_still(panel: Res<Panel>, on_stairs: Res<OnStairs>) -> bool {
    panel.open.is_none() && !on_stairs.0
}

/// Whether a press that started in this frame is on the box with this
/// top-left corner and size.
pub fn pressed_on(presses: &Presses, corner: Vec2, size: Vec2) -> bool {
    presses.0.iter().any(|press| {
        let from_corner = *press - corner;
        from_corner.cmpge(Vec2::ZERO).all() && from_corner.cmplt(size).all()
    })
}

pub fn plugin(app: &mut App) {
    app.init_resource::<Panel>()
        .init_resource::<OnStairs>()
        // Last, after everything else has had the frame: the press that closes
        // the panel does nothing else.
        .add_systems(
            Last,
            (close_panel.run_if(in_state(Screen::Playing)), hold_clock).chain(),
        );
}

/// The game's clock stands still while a panel is open or the mage is on the
/// stairs, and goes on when neither is so.
fn hold_clock(panel: Res<Panel>, on_stairs: Res<OnStairs>, mut time: ResMut<Time<Virtual>>) {
    let still = panel.open.is_some() || on_stairs.0;
    if still != time.is_paused() {
        if still {
            time.pause();
        } else {
            time.unpause();
        }
    }
}

/// While a panel is open, the next press, wherever it starts, or the panel's
/// key closes it and does nothing else. The game goes on from where it was
/// (`hold_clock` starts the clock again).
fn close_panel(
    mut commands: Commands,
    presses: Res<Presses>,
    keys: Res<ButtonInput<KeyCode>>,
    mut panel: ResMut<Panel>,
    parts: Query<Entity, With<PanelPart>>,
) {
    let Some(which) = panel.open else {
        return;
    };
    if panel.just_opened {
        panel.just_opened = false;
        return;
    }
    if presses.0.is_empty() && !keys.just_pressed(which.key()) {
        return;
    }
    panel.open = None;
    for part in &parts {
        commands.entity(part).despawn();
    }
}
