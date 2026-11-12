//! The six things to do once, and the hint in the top strip for the first of
//! them that has not been done yet. Only what is done on the lot counts.

use bevy::prelude::*;

use crate::counts::piece;
use crate::picture::Z_CONTROL;
use crate::sheet::Controls;
use crate::spell::cast;
use crate::{Screen, Start};

/// The hint's top-left corner.
const CORNER: Vec2 = Vec2::new(132.0, 6.0);

/// The six things to do once, in their order. The hint for each is
/// `hint_1` to `hint_6`, in the same order.
#[derive(Clone, Copy)]
pub enum Thing {
    /// A Gust that cleared a tile.
    Gust,
    /// A Break Ground that made soil.
    BreakGround,
    /// A Sprout that planted a seed.
    Sprout,
    /// A Draw that watered a seed.
    Draw,
    /// A ripe crop picked.
    Pick,
    /// A sale at the crate.
    Sell,
}

/// Which of the six things have been done, at least once, in their order.
#[derive(Resource, Default, Clone, Copy)]
pub struct Done(pub [bool; 6]);

impl Done {
    /// Takes note that this thing has been done. A thing done before stays
    /// as it was, so that the hint is only drawn again when something new
    /// is done.
    pub fn mark(done: &mut ResMut<Done>, thing: Thing) {
        if !done.0[thing as usize] {
            done.0[thing as usize] = true;
        }
    }

    /// The hint's number, 1 to 6, for the first thing not done yet; none
    /// once there has been a sale, whatever else was done or not.
    fn hint(&self) -> Option<usize> {
        if self.0[Thing::Sell as usize] {
            return None;
        }
        self.0.iter().position(|done| !done).map(|first| first + 1)
    }
}

/// Marks the hint piece. There is always one; it is hidden when there is no
/// hint to show.
#[derive(Component)]
struct Hint;

pub fn plugin(app: &mut App) {
    app.init_resource::<Done>()
        .add_systems(Startup, draw)
        .add_systems(OnEnter(Screen::Playing), start.in_set(Start::New))
        // In the frame something is done: after the casts, and the picking
        // and selling before them. The piece is changed in place, never
        // taken away and drawn again, so the engine has finished setting up
        // its sprite before anything changes it (see `show`).
        .add_systems(Update, show.after(cast).run_if(resource_changed::<Done>));
}

fn draw(mut commands: Commands, controls: Res<Controls>) {
    commands.spawn((Hint, piece(&controls, "hint_1", CORNER, Z_CONTROL)));
}

fn start(mut done: ResMut<Done>) {
    *done = Done::default();
}

/// Shows the hint for the first thing not done yet, or hides it for good
/// after a sale. (Bevy sets up a new sprite in the frame after it is drawn
/// if it is drawn late in a frame, and a sprite taken away before then stops
/// the game; changing one piece in place has neither problem.)
fn show(done: Res<Done>, controls: Res<Controls>, hint: Single<(&mut Sprite, &mut Visibility), With<Hint>>) {
    let (mut sprite, mut visibility) = hint.into_inner();
    match done.hint() {
        Some(number) => {
            *sprite = controls.sprite(&format!("hint_{number}"));
            *visibility = Visibility::Inherited;
        }
        None => *visibility = Visibility::Hidden,
    }
}
