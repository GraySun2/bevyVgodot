//! The shared sprite sheet: `sprites.png`, cut up as `sprites.json` says.
//!
//! Both files are read from `../shared/` when the game is built and travel
//! inside the game's one .wasm file, so the sheet is ready on the first frame.

use std::collections::HashMap;

use bevy::asset::RenderAssetUsages;
use bevy::image::{CompressedImageFormats, ImageSampler, ImageType};
use bevy::prelude::*;
use serde::Deserialize;

const SPRITES_PNG: &[u8] = include_bytes!("../../shared/sprites.png");
const SPRITES_JSON: &str = include_str!("../../shared/sprites.json");

/// The parts of `sprites.json` the game uses.
#[derive(Deserialize)]
struct SheetFile {
    tile: f32,
    sprites: HashMap<String, Corner>,
}

/// A sprite's top-left corner on the sheet, in pixels.
#[derive(Deserialize)]
struct Corner {
    x: f32,
    y: f32,
}

#[derive(Resource)]
pub struct Sheet {
    image: Handle<Image>,
    tile: f32,
    sprites: HashMap<String, Corner>,
}

impl Sheet {
    /// The sprite with this name in `sprites.json`.
    pub fn sprite(&self, name: &str) -> Sprite {
        let Some(corner) = self.sprites.get(name) else {
            panic!("sprites.json has no sprite called {name:?}");
        };
        let corner = Vec2::new(corner.x, corner.y);
        Sprite {
            image: self.image.clone(),
            // Cut a hair inside the sprite's edges, so that its neighbors on
            // the sheet can never show along its rim. It is still drawn one
            // tile big.
            rect: Some(Rect::from_corners(corner, corner + self.tile).inflate(-0.01)),
            custom_size: Some(Vec2::splat(self.tile)),
            ..default()
        }
    }
}

impl FromWorld for Sheet {
    fn from_world(world: &mut World) -> Self {
        let file: SheetFile = serde_json::from_str(SPRITES_JSON).expect("sprites.json");
        // Nearest sampling keeps the sprites' pixels sharp at any size.
        let image = Image::from_buffer(
            SPRITES_PNG,
            ImageType::Extension("png"),
            CompressedImageFormats::NONE,
            true,
            ImageSampler::nearest(),
            RenderAssetUsages::RENDER_WORLD,
        )
        .expect("sprites.png");
        Sheet {
            image: world.resource_mut::<Assets<Image>>().add(image),
            tile: file.tile,
            sprites: file.sprites,
        }
    }
}

pub fn plugin(app: &mut App) {
    app.init_resource::<Sheet>()
        .add_systems(Last, plain_sprite_square);
}

/// Makes sprites show their art on real phones.
///
/// Bevy 0.20 draws every `Sprite` on one square that all sprites share. It
/// packs that square's corners into small whole numbers and has the shader
/// unpack them. On a real Android phone the unpacking lost each corner's place
/// on the image, so a sprite showed only its top-left pixel: one flat color,
/// or nothing where that pixel is see-through. This swaps the shared square
/// for the same square with plain numbers, which need no unpacking. It runs
/// once, as soon as the first sprite has its square, and then every `Sprite`
/// in the game is drawn on the plain one.
fn plain_sprite_square(
    sprites: Query<&Mesh2d, With<Sprite>>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut done: Local<bool>,
) {
    if *done {
        return;
    }
    let Some(square) = sprites.iter().next() else {
        return;
    };
    // One unit big, like Bevy's own; each sprite stretches it to its size.
    let plain = Rectangle::from_size(Vec2::ONE)
        .mesh()
        .build()
        .with_removed_attribute(Mesh::ATTRIBUTE_NORMAL);
    meshes
        .insert(square.id(), plain)
        .expect("the sprites' square");
    *done = true;
}
