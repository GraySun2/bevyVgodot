//! The shared art: the sprite sheet (`sprites.png`, cut up as `sprites.json`
//! says) and the thumb controls' art (`controls.png` and `controls.json`).
//!
//! The files are read from `../shared/` when the game is built and travel
//! inside the game's one .wasm file, so the art is ready on the first frame.

use std::collections::HashMap;

use bevy::asset::RenderAssetUsages;
use bevy::image::{CompressedImageFormats, ImageSampler, ImageType};
use bevy::prelude::*;
use bevy::render::render_resource::{Extent3d, TextureDimension};
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

/// One image's pieces, each cut out as an image of its own.
struct Art {
    file: &'static str,
    pieces: HashMap<String, (Handle<Image>, Vec2)>,
}

impl Art {
    /// Cuts each piece (its place on the image, in pixels) out of the image.
    ///
    /// On an image of their own, a piece's neighbors can never show along its
    /// rim. They did on the whole sheet: where the picture is drawn at a size
    /// that puts a piece's edge exactly on the middle of a screen pixel, the
    /// test browser's GPU sometimes took that pixel from the next piece over.
    fn new(
        world: &mut World,
        file: &'static str,
        png: &[u8],
        pieces: HashMap<String, Rect>,
    ) -> Art {
        let sheet = Image::from_buffer(
            png,
            ImageType::Extension("png"),
            CompressedImageFormats::NONE,
            true,
            ImageSampler::nearest(),
            RenderAssetUsages::RENDER_WORLD,
        )
        .expect(file);
        let width = sheet.width() as usize;
        let data = sheet.data.as_deref().expect(file);
        let bytes = data.len() / (width * sheet.height() as usize);
        let mut images = world.resource_mut::<Assets<Image>>();
        let pieces = pieces
            .into_iter()
            .map(|(name, place)| {
                let (x, y) = (place.min.x as usize, place.min.y as usize);
                let (w, h) = (place.width() as usize, place.height() as usize);
                let mut cut = Vec::with_capacity(w * h * bytes);
                for row in y..y + h {
                    let start = (row * width + x) * bytes;
                    cut.extend_from_slice(&data[start..start + w * bytes]);
                }
                let size = Extent3d {
                    width: w as u32,
                    height: h as u32,
                    depth_or_array_layers: 1,
                };
                let mut image = Image::new(
                    size,
                    TextureDimension::D2,
                    cut,
                    sheet.texture_descriptor.format,
                    RenderAssetUsages::RENDER_WORLD,
                );
                // Nearest sampling keeps the art's pixels sharp at any size.
                image.sampler = ImageSampler::nearest();
                (name, (images.add(image), place.size()))
            })
            .collect();
        Art { file, pieces }
    }

    /// The piece with this name, drawn at its own size.
    fn sprite(&self, name: &str) -> Sprite {
        let Some((image, size)) = self.pieces.get(name) else {
            panic!("{} has nothing called {name:?}", self.file);
        };
        Sprite {
            image: image.clone(),
            custom_size: Some(*size),
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

    /// Whether `sprites.json` has a sprite with this name.
    pub fn has(&self, name: &str) -> bool {
        self.0.pieces.contains_key(name)
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
