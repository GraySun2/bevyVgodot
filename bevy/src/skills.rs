//! Skills: each spell trains its school of magic, which gains levels with XP.
//! The skills button in the top strip opens a panel that shows them, and the
//! game stands still while it is open.

use bevy::prelude::*;
use bevy::window::PrimaryWindow;

use crate::Screen;
use crate::counts::piece;
use crate::picture::{Presses, Z_MAGE, rect, zoom};
use crate::sheet::Controls;
use crate::sound::Sounds;

/// The four schools, in the panel's order from the top.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum School {
    Air,
    Earth,
    Growth,
    Water,
}

/// The XP a cast that changes something gives its school.
const XP_PER_CAST: u32 = 10;

/// What a school at level 1 needs to reach level 2. Each level after that
/// needs 12% more than the one before, to the nearest whole number.
const FIRST_NEED: u32 = 100;

/// What a school at this level needs to reach the next: 100, 112, 125, 140,
/// 157, and so on, each worked out from the one before.
fn need(level: u32) -> u32 {
    (1..level).fold(FIRST_NEED, |need, _| (need as f64 * 1.12).round() as u32)
}

#[derive(Clone, Copy)]
struct Skill {
    level: u32,
    xp: u32,
}

/// Every school's level and XP, in the order of `School`.
#[derive(Resource)]
pub struct Schools([Skill; 4]);

impl Default for Schools {
    fn default() -> Self {
        Schools([Skill { level: 1, xp: 0 }; 4])
    }
}

/// The level-up pop: its piece, its top-left corner and how long it shows.
const POP_CORNER: Vec2 = Vec2::new(93.0, 54.0);
const POP_SECONDS: f64 = 1.5;
/// Over the lot and everything on it, and under the panel.
const Z_POP: f32 = Z_MAGE + 2.0;

/// When the level-up pop goes away, by the game's clock in seconds.
#[derive(Resource, Default)]
struct PopUntil(f64);

#[derive(Component)]
struct Pop;

impl Schools {
    /// A cast of one of the school's spells changed something: the school
    /// gets its XP, and maybe a level. Says if it gained a level.
    fn train(&mut self, school: School) -> bool {
        let skill = &mut self.0[school as usize];
        skill.xp += XP_PER_CAST;
        let mut gained = false;
        while skill.xp >= need(skill.level) {
            skill.xp -= need(skill.level);
            skill.level += 1;
            gained = true;
        }
        gained
    }
}

/// Gives a school the XP for a cast that changed something. When it gains a
/// level, `level_up.wav` plays and the pop shows.
#[derive(bevy::ecs::system::SystemParam)]
pub struct Training<'w> {
    schools: ResMut<'w, Schools>,
    pop_until: ResMut<'w, PopUntil>,
    time: Res<'w, Time>,
}

impl Training<'_> {
    pub fn train(&mut self, commands: &mut Commands, sounds: &Sounds, school: School) {
        if self.schools.train(school) {
            sounds.play(commands, "level_up");
            self.pop_until.0 = self.time.elapsed_secs_f64() + POP_SECONDS;
        }
    }
}

// ---------------------------------------------------------------- the panel

/// The skills button: its top-left corner and size.
const BUTTON_CORNER: Vec2 = Vec2::new(204.0, 6.0);
const BUTTON_SIZE: Vec2 = Vec2::splat(36.0);

/// The panel, and where its parts are.
const PANEL_CORNER: Vec2 = Vec2::new(16.0, 112.0);
const Z_PANEL: f32 = Z_POP + 1.0;
/// The first digit of each school's level, across, and each row's top.
const LEVEL_X: f32 = 228.0;
const LEVEL_TOPS: [f32; 4] = [148.0, 190.0, 232.0, 274.0];
const DIGIT_STEP: f32 = 12.0;
/// The inside of each school's bar: its left, each row's top, and its size.
const BAR_X: f32 = 30.0;
const BAR_TOPS: [f32; 4] = [168.0, 210.0, 252.0, 294.0];
const BAR_SIZE: Vec2 = Vec2::new(228.0, 8.0);
const BAR_COLOR: Color = Color::srgb_u8(0xff, 0xd2, 0x5a);

/// Whether the skills panel is open. `just_opened` keeps the press or key
/// that opened it from closing it in the same frame.
#[derive(Resource, Default)]
pub struct Panel {
    open: bool,
    just_opened: bool,
}

/// For the game's systems that the player works: they do nothing while the
/// panel is open.
pub fn panel_closed(panel: Res<Panel>) -> bool {
    !panel.open
}

/// Marks every part of the open panel.
#[derive(Component)]
struct PanelPart;

pub fn plugin(app: &mut App) {
    app.init_resource::<Schools>()
        .init_resource::<PopUntil>()
        .init_resource::<Panel>()
        .add_systems(Startup, draw)
        .add_systems(
            Update,
            (open_panel.run_if(panel_closed), show_pop).run_if(in_state(Screen::Playing)),
        )
        // Last, after everything else has had the frame: the press that closes
        // the panel does nothing else.
        .add_systems(Last, close_panel.run_if(in_state(Screen::Playing)));
}

fn draw(mut commands: Commands, controls: Res<Controls>) {
    commands.spawn(piece(&controls, "button_skills", BUTTON_CORNER, crate::picture::Z_CONTROL));
    commands.spawn((
        Pop,
        piece(&controls, "pop_level_up", POP_CORNER, Z_POP),
        Visibility::Hidden,
    ));
}

/// The pop shows until its time is up, by the game's clock, so it waits
/// while the panel is open.
fn show_pop(time: Res<Time>, pop_until: Res<PopUntil>, mut pop: Single<&mut Visibility, With<Pop>>) {
    let showing = time.elapsed_secs_f64() < pop_until.0;
    pop.set_if_neq(if showing {
        Visibility::Inherited
    } else {
        Visibility::Hidden
    });
}

/// A press that starts on the skills button, or the K key, opens the panel,
/// and the game's clock stops.
fn open_panel(
    mut commands: Commands,
    presses: Res<Presses>,
    keys: Res<ButtonInput<KeyCode>>,
    mut panel: ResMut<Panel>,
    mut time: ResMut<Time<Virtual>>,
    schools: Res<Schools>,
    controls: Res<Controls>,
    window: Single<&Window, With<PrimaryWindow>>,
) {
    let on_button = |press: &Vec2| {
        let from_corner = *press - BUTTON_CORNER;
        from_corner.cmpge(Vec2::ZERO).all() && from_corner.cmplt(BUTTON_SIZE).all()
    };
    if !(presses.0.iter().any(on_button) || keys.just_pressed(KeyCode::KeyK)) {
        return;
    }
    panel.open = true;
    panel.just_opened = true;
    time.pause();

    commands.spawn((PanelPart, piece(&controls, "panel_skills", PANEL_CORNER, Z_PANEL)));
    for (row, skill) in schools.0.iter().enumerate() {
        for (i, digit) in skill.level.to_string().chars().enumerate() {
            let corner = Vec2::new(LEVEL_X + i as f32 * DIGIT_STEP, LEVEL_TOPS[row]);
            commands.spawn((
                PanelPart,
                piece(&controls, &format!("digit_{digit}"), corner, Z_PANEL + 0.1),
            ));
        }
        // As far as the XP has come toward the next level, to the nearest pixel.
        let filled = (BAR_SIZE.x * skill.xp as f32 / need(skill.level) as f32).round();
        if filled >= 1.0 {
            // A hair longer and taller than its pixels: where the picture is
            // drawn at a size that puts the bar's right or bottom edge exactly
            // on the middle of a screen pixel, the panel's art can show that pixel
            // as inside the bar, and the fill then covers it too, instead of
            // leaving a dark line along its edge. The hair is a fifteenth of a
            // screen pixel, because some GPUs (the test browser's among them)
            // place corners only to the nearest sixteenth.
            let hair = 1.0 / 15.0 / zoom(&window).max(0.01);
            commands.spawn((
                PanelPart,
                rect(
                    BAR_COLOR,
                    BAR_X,
                    BAR_TOPS[row],
                    filled + hair,
                    BAR_SIZE.y + hair,
                    Z_PANEL + 0.1,
                ),
            ));
        }
    }
}

/// While the panel is open, the next press, wherever it starts, or the K key
/// closes it and does nothing else. The game goes on from where it was.
fn close_panel(
    mut commands: Commands,
    presses: Res<Presses>,
    keys: Res<ButtonInput<KeyCode>>,
    mut panel: ResMut<Panel>,
    mut time: ResMut<Time<Virtual>>,
    parts: Query<Entity, With<PanelPart>>,
) {
    if !panel.open {
        return;
    }
    if panel.just_opened {
        panel.just_opened = false;
        return;
    }
    if presses.0.is_empty() && !keys.just_pressed(KeyCode::KeyK) {
        return;
    }
    panel.open = false;
    time.unpause();
    for part in &parts {
        commands.entity(part).despawn();
    }
}
