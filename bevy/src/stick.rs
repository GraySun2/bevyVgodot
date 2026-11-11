//! The thumb stick in the bottom strip. A thumb, or a mouse, that starts on
//! the left half of the strip takes hold of the knob and drags it about. The
//! mage walks the way the knob points; that part is in `mage`.

use bevy::prelude::*;
use bevy::window::PrimaryWindow;

use crate::Screen;
use crate::picture::{CONTROLS_TOP, PICTURE, Place, Z_CONTROL, at, moving, picture_point};
use crate::sheet::Controls;

/// The middle of the base, where the knob rests.
const CENTER: Vec2 = Vec2::new(72.0, CONTROLS_TOP + 72.0);

/// The farthest the knob's middle goes from the base's middle, in pixels.
const REACH: f32 = 28.0;

/// Where the knob is.
#[derive(Resource, Default)]
pub struct Stick {
    /// The knob's middle, in pixels right and down from the base's middle.
    /// It is zero while nothing holds the stick.
    pub knob: Vec2,
    hold: Option<Hold>,
}

/// What has hold of the stick.
#[derive(Clone, Copy)]
enum Hold {
    /// The touch with this number.
    Finger(u64),
    Mouse,
}

/// Marks the knob's sprite.
#[derive(Component)]
pub struct Knob;

pub fn plugin(app: &mut App) {
    app.init_resource::<Stick>()
        .add_systems(Startup, draw_stick)
        // Only while playing, so the tap that takes the cover away has
        // already started by the time the stick looks for new presses.
        .add_systems(Update, work_stick.run_if(in_state(Screen::Playing)));
}

fn draw_stick(mut commands: Commands, controls: Res<Controls>) {
    commands.spawn((
        controls.sprite("stick_base"),
        at(CENTER.x, CENTER.y, Z_CONTROL),
    ));
    commands.spawn((
        Knob,
        controls.sprite("stick_knob"),
        moving(CENTER.x, CENTER.y, Z_CONTROL + 0.5),
    ));
}

/// A press that starts here takes hold of the stick: the left half of the
/// bottom strip.
fn starts_on_stick(point: Vec2) -> bool {
    (0.0..PICTURE.x / 2.0).contains(&point.x) && (CONTROLS_TOP..PICTURE.y).contains(&point.y)
}

pub fn work_stick(
    touches: Res<Touches>,
    mouse: Res<ButtonInput<MouseButton>>,
    window: Single<&Window, With<PrimaryWindow>>,
    camera: Single<(&Camera, &GlobalTransform)>,
    mut stick: ResMut<Stick>,
    mut knob: Single<&mut Place, With<Knob>>,
) {
    let (camera, camera_transform) = *camera;
    let point = |screen: Vec2| picture_point(camera, camera_transform, screen);
    let cursor = window.cursor_position().and_then(point);

    // A press takes hold only as it starts, and only while nothing else has
    // hold. So a second finger never disturbs the first.
    if stick.hold.is_none() {
        stick.hold = touches
            .iter_just_pressed()
            .find(|touch| point(touch.start_position()).is_some_and(starts_on_stick))
            .map(|touch| Hold::Finger(touch.id()));
    }
    if stick.hold.is_none()
        && mouse.just_pressed(MouseButton::Left)
        && cursor.is_some_and(starts_on_stick)
    {
        stick.hold = Some(Hold::Mouse);
    }

    // Where the holder is now, wherever it has slid to. The outer `None` is
    // for when it has let go; the inner one for a mouse that is off the page.
    let holder = match stick.hold {
        Some(Hold::Finger(id)) => touches.get_pressed(id).map(|touch| point(touch.position())),
        Some(Hold::Mouse) if mouse.pressed(MouseButton::Left) => Some(cursor),
        _ => None,
    };
    match holder {
        Some(Some(point)) => stick.knob = (point - CENTER).clamp_length_max(REACH),
        Some(None) => {}
        None => {
            stick.hold = None;
            stick.knob = Vec2::ZERO;
        }
    }

    knob.set_if_neq(Place(CENTER + stick.knob));
}
