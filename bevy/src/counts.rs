//! The counts in the top strip, each a small picture with a number written
//! after it in the digit pieces: the seeds and the crops the mage carries,
//! and its coins.

use std::marker::PhantomData;

use bevy::ecs::component::Mutable;
use bevy::prelude::*;
use bevy::sprite::Anchor;

use crate::dungeon::SteppingOn;
use crate::spell::cast;
use crate::{Screen, Start};
use crate::picture::{Z_CONTROL, at};
use crate::sheet::Controls;

/// Each next digit starts this many pixels further right.
const DIGIT_STEP: f32 = 12.0;

/// A count shown in the top strip.
trait Count: Resource + Component<Mutability = Mutable> {
    /// How many there are when the cover goes.
    const FIRST: u32;
    /// The picture's piece, and its top-left corner.
    const ICON: &'static str;
    const ICON_CORNER: Vec2;
    /// The first digit's top-left corner.
    const DIGITS: Vec2;
    fn new(number: u32) -> Self;
    fn number(&self) -> u32;
}

/// How many seeds the mage carries.
#[derive(Resource)]
pub struct Seeds(pub u32);

impl Count for Seeds {
    const FIRST: u32 = 8;
    const ICON: &'static str = "icon_seed";
    const ICON_CORNER: Vec2 = Vec2::new(8.0, 26.0);
    const DIGITS: Vec2 = Vec2::new(28.0, 27.0);
    fn new(number: u32) -> Self {
        Seeds(number)
    }
    fn number(&self) -> u32 {
        self.0
    }
}

/// How many crops the mage carries.
#[derive(Resource)]
pub struct Crops(pub u32);

impl Count for Crops {
    const FIRST: u32 = 0;
    const ICON: &'static str = "icon_crop";
    const ICON_CORNER: Vec2 = Vec2::new(72.0, 26.0);
    const DIGITS: Vec2 = Vec2::new(92.0, 27.0);
    fn new(number: u32) -> Self {
        Crops(number)
    }
    fn number(&self) -> u32 {
        self.0
    }
}

/// How many coins the mage has.
#[derive(Resource)]
pub struct Coins(pub u32);

impl Count for Coins {
    const FIRST: u32 = 0;
    const ICON: &'static str = "icon_coin";
    const ICON_CORNER: Vec2 = Vec2::new(136.0, 26.0);
    const DIGITS: Vec2 = Vec2::new(156.0, 27.0);
    fn new(number: u32) -> Self {
        Coins(number)
    }
    fn number(&self) -> u32 {
        self.0
    }
}

/// Marks the digits that write one count.
#[derive(Component)]
struct Digit<C>(PhantomData<C>);

pub fn plugin(app: &mut App) {
    count::<Seeds>(app);
    count::<Crops>(app);
    count::<Coins>(app);
}

fn count<C: Count>(app: &mut App) {
    app.insert_resource(C::new(C::FIRST))
        .add_systems(Startup, draw_icon::<C>)
        .add_systems(OnEnter(Screen::Playing), fill::<C>.in_set(Start::New))
        // After everything that changes the count in the frame: the casts,
        // the picking and selling before them, and what the mage steps on
        // below. In Update, not later in the frame: Bevy finishes setting up
        // a new sprite later in the same frame, and one drawn after that is
        // only finished in the next frame, too late if it is taken away again
        // then (step 10 found this).
        .add_systems(
            Update,
            show::<C>
                .after(cast)
                .after(SteppingOn)
                .run_if(resource_changed::<C>),
        );
}

/// A piece of the controls' art, placed by its top-left corner.
pub fn piece(controls: &Controls, name: &str, corner: Vec2, z: f32) -> impl Bundle {
    (controls.sprite(name), Anchor::TOP_LEFT, at(corner.x, corner.y, z))
}

fn draw_icon<C: Count>(mut commands: Commands, controls: Res<Controls>) {
    commands.spawn(piece(&controls, C::ICON, C::ICON_CORNER, Z_CONTROL));
}

fn fill<C: Count>(mut count: ResMut<C>) {
    *count = C::new(C::FIRST);
}

/// Writes the number again, with no zeros in front.
fn show<C: Count>(
    mut commands: Commands,
    count: Res<C>,
    controls: Res<Controls>,
    old: Query<Entity, With<Digit<C>>>,
) {
    for digit in &old {
        commands.entity(digit).despawn();
    }
    for (i, digit) in count.number().to_string().chars().enumerate() {
        let corner = C::DIGITS + Vec2::new(i as f32 * DIGIT_STEP, 0.0);
        commands.spawn((
            Digit::<C>(PhantomData),
            piece(&controls, &format!("digit_{digit}"), corner, Z_CONTROL),
        ));
    }
}
