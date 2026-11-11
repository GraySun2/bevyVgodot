//! Spells, cast on the aimed tile with a button in the bottom strip. So far
//! there is one: Gust, which clears rubble and weeds off a tile.

use bevy::prelude::*;

use crate::Screen;
use crate::aim::{Aim, take_aim};
use crate::lot::Thing;
use crate::mana::{Mana, regain};
use crate::picture::{CONTROLS_TOP, Presses, Z_CONTROL, at};
use crate::sheet::Controls;
use crate::sound::Sounds;

/// What a cast of Gust costs, when it clears something.
const GUST_COST: f32 = 8.0;

/// The Gust button's top-left corner and its size, in picture pixels.
const GUST_CORNER: Vec2 = Vec2::new(156.0, CONTROLS_TOP + 12.0);
const BUTTON_SIZE: Vec2 = Vec2::splat(56.0);

/// The Gust button. `lit` is whether it shows that there is mana for a cast.
#[derive(Component)]
struct GustButton {
    lit: bool,
}

pub fn plugin(app: &mut App) {
    app.add_systems(Startup, draw_button).add_systems(
        Update,
        (cast_gust, light_button)
            .chain()
            .after(take_aim)
            .after(regain)
            .run_if(in_state(Screen::Playing)),
    );
}

fn draw_button(mut commands: Commands, controls: Res<Controls>) {
    let middle = GUST_CORNER + BUTTON_SIZE / 2.0;
    commands.spawn((
        GustButton { lit: true },
        controls.sprite("spell_gust"),
        at(middle.x, middle.y, Z_CONTROL),
    ));
}

/// A press that starts on the button, or the 1 key, casts Gust once.
fn cast_gust(
    mut commands: Commands,
    presses: Res<Presses>,
    keys: Res<ButtonInput<KeyCode>>,
    aim: Res<Aim>,
    mut mana: ResMut<Mana>,
    things: Query<(Entity, &Thing)>,
    sounds: Res<Sounds>,
) {
    let on_button = |press: &&Vec2| {
        let from_corner = **press - GUST_CORNER;
        from_corner.cmpge(Vec2::ZERO).all() && from_corner.cmplt(BUTTON_SIZE).all()
    };
    let casts = presses.0.iter().filter(on_button).count()
        + usize::from(keys.just_pressed(KeyCode::Digit1));

    // What this frame's casts have cleared: it is gone for the next cast,
    // though its sprite is only taken away after this system.
    let mut cleared = Vec::new();
    for _ in 0..casts {
        // Without the mana for it nothing happens at all, not even a sound.
        if mana.0 < GUST_COST {
            continue;
        }
        let in_the_way = things.iter().find(|(entity, thing)| {
            Some(thing.tile) == aim.tile
                && matches!(thing.name.as_str(), "rubble" | "weeds")
                && !cleared.contains(entity)
        });
        match in_the_way {
            Some((entity, _)) => {
                // Gone, and the ground under it shows.
                commands.entity(entity).despawn();
                cleared.push(entity);
                mana.0 -= GUST_COST;
                sounds.play(&mut commands, "gust");
            }
            None => sounds.play(&mut commands, "no"),
        }
    }
}

/// The button shows whether the mage has the mana for a cast.
fn light_button(
    mana: Res<Mana>,
    controls: Res<Controls>,
    button: Single<(&mut GustButton, &mut Sprite)>,
) {
    let (mut button, mut sprite) = button.into_inner();
    let lit = mana.0 >= GUST_COST;
    if button.lit != lit {
        button.lit = lit;
        *sprite = controls.sprite(if lit { "spell_gust" } else { "spell_gust_off" });
    }
}
