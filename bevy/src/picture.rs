//! The upright picture: its layout, the camera that shows it, and fitting it
//! to the screen.
//!
//! Everything in the game is placed in picture pixels: one unit is one pixel
//! of the sprite sheet, counted right and down from the picture's top-left
//! corner. Use `at` to place things.

use bevy::camera::{ScalingMode, Viewport};
use bevy::prelude::*;
use bevy::sprite::Anchor;
use bevy::text::FontAtlasSet;
use bevy::window::PrimaryWindow;

/// One tile of the sprite sheet, in picture pixels.
pub const TILE: f32 = 32.0;

/// The whole picture: 9 tiles wide and 18 tall.
pub const PICTURE: Vec2 = Vec2::new(9.0 * TILE, 18.0 * TILE);

/// From the top: the strip for the counts, the farm lot, the strip for the
/// thumb controls. Each is as wide as the picture.
pub const COUNTS_HEIGHT: f32 = 1.5 * TILE;
pub const LOT_HEIGHT: f32 = 12.0 * TILE;
pub const CONTROLS_HEIGHT: f32 = 4.5 * TILE;
pub const LOT_TOP: f32 = COUNTS_HEIGHT;
pub const CONTROLS_TOP: f32 = LOT_TOP + LOT_HEIGHT;

/// The strips and the cover.
pub const GREEN: Color = Color::srgb_u8(0x2f, 0x5a, 0x2a);
/// The screen around the picture.
pub const BROWN: Color = Color::srgb_u8(0x2a, 0x1a, 0x14);
/// Words.
pub const CREAM: Color = Color::srgb_u8(0xff, 0xf4, 0xd8);

/// What is drawn over what: a higher number is drawn on top.
pub const Z_STRIP: f32 = 0.0;
pub const Z_GROUND: f32 = 1.0;
pub const Z_THING: f32 = 2.0;
pub const Z_MAGE: f32 = 3.0;
pub const Z_COVER: f32 = 10.0;

/// The place `x` pixels right and `y` pixels down from the picture's top-left
/// corner.
pub fn at(x: f32, y: f32, z: f32) -> Transform {
    Transform::from_xyz(x, -y, z)
}

/// A plain rectangle of one color, placed by its top-left corner.
pub fn rect(color: Color, x: f32, y: f32, width: f32, height: f32, z: f32) -> impl Bundle {
    (
        Sprite::from_color(color, Vec2::new(width, height)),
        Anchor::TOP_LEFT,
        at(x, y, z),
    )
}

/// Put this on a `Text2d` to give its font size in picture pixels. `fit_text`
/// then keeps its letters sharp at whatever size the picture is on the screen.
#[derive(Component)]
pub struct TextSize(pub f32);

pub fn plugin(app: &mut App) {
    app.insert_resource(ClearColor(BROWN))
        .add_systems(Startup, setup)
        .add_systems(Update, (fit_picture, fit_text));
}

fn setup(mut commands: Commands) {
    // The camera sees exactly the picture, with the picture's top-left corner
    // at (0, 0). `fit_picture` says where on the screen it draws.
    commands.spawn((
        Camera2d,
        Projection::Orthographic(OrthographicProjection {
            scaling_mode: ScalingMode::Fixed {
                width: PICTURE.x,
                height: PICTURE.y,
            },
            viewport_origin: Vec2::new(0.0, 1.0),
            ..OrthographicProjection::default_2d()
        }),
        Msaa::Off,
    ));

    commands.spawn(rect(GREEN, 0.0, 0.0, PICTURE.x, COUNTS_HEIGHT, Z_STRIP));
    commands.spawn(rect(
        GREEN,
        0.0,
        CONTROLS_TOP,
        PICTURE.x,
        CONTROLS_HEIGHT,
        Z_STRIP,
    ));
}

/// How wide the picture is on the screen, in screen pixels: as big as fits.
/// The picture is 1 wide to 2 tall, so its height is twice this.
fn fitted_width(window: &Window) -> u32 {
    window.physical_width().min(window.physical_height() / 2)
}

/// Makes the picture as big as fits on the screen, keeps its shape and
/// centers it. It runs every frame, so a resized or turned screen is fitted
/// again at once. The rest of the screen keeps the clear color.
fn fit_picture(window: Single<&Window, With<PrimaryWindow>>, mut camera: Single<&mut Camera>) {
    let width = fitted_width(&window);
    if width == 0 {
        return;
    }
    let size = UVec2::new(width, 2 * width);
    let position = (window.physical_size() - size) / 2;
    let fitted = camera
        .viewport
        .as_ref()
        .is_some_and(|v| v.physical_position == position && v.physical_size == size);
    if !fitted {
        camera.viewport = Some(Viewport {
            physical_position: position,
            physical_size: size,
            ..default()
        });
    }
}

/// Keeps letters sharp. Bevy draws letters at the font size times the
/// screen's pixel ratio, without looking at the camera. So ask for the size
/// the letters really are on the screen, and scale the text back to its place
/// in the picture.
fn fit_text(
    window: Single<&Window, With<PrimaryWindow>>,
    mut sized: Query<(&TextSize, &mut TextFont, &mut Transform)>,
    mut all: Query<&mut Text2d>,
    mut atlases: ResMut<FontAtlasSet>,
    mut last_zoom: Local<f32>,
) {
    let zoom = fitted_width(&window) as f32 / PICTURE.x / window.scale_factor();
    if zoom == 0.0 {
        return;
    }
    if *last_zoom != zoom {
        *last_zoom = zoom;
        // Bevy keeps the letters it has drawn at every font size it has ever
        // seen. Let go of the old sizes, and have every text drawn again.
        atlases.clear();
        for mut text in &mut all {
            text.set_changed();
        }
    }
    for (text_size, mut font, mut transform) in &mut sized {
        let font_size = FontSize::Px(text_size.0 * zoom);
        if font.font_size != font_size {
            font.font_size = font_size;
            transform.scale = Vec3::splat(1.0 / zoom);
        }
    }
}
