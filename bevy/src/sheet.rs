//! The shared art: the sprite sheet (`sprites.png`, cut up as `sprites.json`
//! says) and the thumb controls' art (`controls.png` and `controls.json`).
//!
//! The files are read from `../shared/` when the game is built and travel
//! inside the game's one .wasm file, so the art is ready on the first frame.

use std::collections::HashMap;

use bevy::asset::RenderAssetUsages;
use bevy::image::{CompressedImageFormats, ImageSampler, ImageType};
use bevy::prelude::*;
use serde::Deserialize;

/// The parts of `sprites.json` the game uses. Every sprite is one tile big.
#[derive(Deserialize)]
struct SpritesFile {
    tile: f32,
    sprites: HashMap<String, Corner>,
}

/// A sprite's top-left corner on the sheet, in pixels.
#[derive(Deserialize)]
struct Corner {
    x: f32,
    y: f32,
}

/// The parts of `controls.json` the game uses. Each piece has its own size.
#[derive(Deserialize)]
struct ControlsFile {
    pieces: HashMap<String, Piece>,
}

/// A piece's top-left corner on the image and its size, in pixels.
#[derive(Deserialize)]
struct Piece {
    x: f32,
    y: f32,
    w: f32,
    h: f32,
}

/// One image, and where each named piece is on it, in pixels.
struct Art {
    file: &'static str,
    image: Handle<Image>,
    pieces: HashMap<String, Rect>,
}

impl Art {
    fn new(
        world: &mut World,
        file: &'static str,
        png: &[u8],
        pieces: HashMap<String, Rect>,
    ) -> Art {
        // Nearest sampling keeps the art's pixels sharp at any size.
        let image = Image::from_buffer(
            png,
            ImageType::Extension("png"),
            CompressedImageFormats::NONE,
            true,
            ImageSampler::nearest(),
            RenderAssetUsages::RENDER_WORLD,
        )
        .expect(file);
        Art {
            file,
            image: world.resource_mut::<Assets<Image>>().add(image),
            pieces,
        }
    }

    /// The piece with this name, drawn at its own size.
    fn sprite(&self, name: &str) -> Sprite {
        let Some(piece) = self.pieces.get(name) else {
            panic!("{} has nothing called {name:?}", self.file);
        };
        Sprite {
            image: self.image.clone(),
            // Cut a hair inside the piece's edges, so that its neighbors on
            // the image can never show along its rim. It is still drawn at
            // its full size.
            rect: Some(piece.inflate(-0.01)),
            custom_size: Some(piece.size()),
            ..default()
        }
    }
}

/// The sprite sheet.
#[derive(Resource)]
pub struct Sheet(Art);

impl Sheet {
    /// The sprite with this name in `sprites.json`.
    pub fn sprite(&self, name: &str) -> Sprite {
        self.0.sprite(name)
    }
}

impl FromWorld for Sheet {
    fn from_world(world: &mut World) -> Self {
        let file: SpritesFile =
            serde_json::from_str(include_str!("../../shared/sprites.json")).expect("sprites.json");
        let pieces = file
            .sprites
            .into_iter()
            .map(|(name, corner)| {
                let corner = Vec2::new(corner.x, corner.y);
                (name, Rect::from_corners(corner, corner + file.tile))
            })
            .collect();
        let png = include_bytes!("../../shared/sprites.png");
        Sheet(Art::new(world, "sprites.json", png, pieces))
    }
}

/// The thumb controls' art.
#[derive(Resource)]
pub struct Controls(Art);

impl Controls {
    /// The piece with this name in `controls.json`.
    pub fn sprite(&self, name: &str) -> Sprite {
        self.0.sprite(name)
    }
}

impl FromWorld for Controls {
    fn from_world(world: &mut World) -> Self {
        let file: ControlsFile = serde_json::from_str(include_str!("../../shared/controls.json"))
            .expect("controls.json");
        let pieces = file
            .pieces
            .into_iter()
            .map(|(name, piece)| {
                let corner = Vec2::new(piece.x, piece.y);
                let size = Vec2::new(piece.w, piece.h);
                (name, Rect::from_corners(corner, corner + size))
            })
            .collect();
        let png = include_bytes!("../../shared/controls.png");
        Controls(Art::new(world, "controls.json", png, pieces))
    }
}

pub fn plugin(app: &mut App) {
    app.init_resource::<Sheet>()
        .init_resource::<Controls>()
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
