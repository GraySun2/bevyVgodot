//! Spells, cast on the aimed tile with their buttons in the bottom strip:
//! - Gust clears rubble and weeds off a tile;
//! - Break Ground turns bare grass to soil;
//! - Sprout plants a seed in bare soil.

use bevy::prelude::*;
use bevy::sprite::Anchor;

use crate::Screen;
use crate::aim::{Aim, take_aim};
use crate::counts::Seeds;
use crate::lot::Field;
use crate::mana::{Mana, regain};
use crate::picture::{CONTROLS_TOP, Presses, Z_CONTROL, at};
use crate::sheet::{Controls, Sheet};
use crate::sound::Sounds;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Spell {
    Gust,
    BreakGround,
    Sprout,
}

/// Every button is this big, in picture pixels.
const BUTTON_SIZE: Vec2 = Vec2::splat(56.0);

impl Spell {
    const ALL: [Spell; 3] = [Spell::Gust, Spell::BreakGround, Spell::Sprout];

    /// What a cast costs when it works. With less mana than this, a cast does
    /// nothing at all.
    fn cost(self) -> f32 {
        match self {
            Spell::Gust => 8.0,
            Spell::BreakGround => 14.0,
            Spell::Sprout => 10.0,
        }
    }

    /// Its name: the button's piece is `spell_<name>`, and the sound a cast
    /// that works plays is `<name>.wav`.
    fn name(self) -> &'static str {
        match self {
            Spell::Gust => "gust",
            Spell::BreakGround => "break_ground",
            Spell::Sprout => "sprout",
        }
    }

    /// The button's top-left corner, in picture pixels.
    fn corner(self) -> Vec2 {
        match self {
            Spell::Gust => Vec2::new(156.0, CONTROLS_TOP + 12.0),
            Spell::BreakGround => Vec2::new(220.0, CONTROLS_TOP + 12.0),
            Spell::Sprout => Vec2::new(156.0, CONTROLS_TOP + 76.0),
        }
    }

    /// The key that casts it, for testing.
    fn key(self) -> KeyCode {
        match self {
            Spell::Gust => KeyCode::Digit1,
            Spell::BreakGround => KeyCode::Digit2,
            Spell::Sprout => KeyCode::Digit3,
        }
    }

    /// The button's piece: lit when there is the mana for a cast.
    fn piece(self, lit: bool) -> String {
        let off = if lit { "" } else { "_off" };
        format!("spell_{}{off}", self.name())
    }

    /// Whether a press at this place in the picture is on the button.
    fn under(self, press: Vec2) -> bool {
        let from_corner = press - self.corner();
        from_corner.cmpge(Vec2::ZERO).all() && from_corner.cmplt(BUTTON_SIZE).all()
    }
}

/// A spell's button. `lit` is whether it shows that there is mana for a cast.
#[derive(Component)]
struct SpellButton {
    spell: Spell,
    lit: bool,
}

pub fn plugin(app: &mut App) {
    app.add_systems(Startup, draw_buttons).add_systems(
        Update,
        (cast, light_buttons)
            .chain()
            .after(take_aim)
            .after(regain)
            .run_if(in_state(Screen::Playing)),
    );
}

fn draw_buttons(mut commands: Commands, controls: Res<Controls>) {
    for spell in Spell::ALL {
        let corner = spell.corner();
        commands.spawn((
            SpellButton { spell, lit: true },
            controls.sprite(&spell.piece(true)),
            Anchor::TOP_LEFT,
            at(corner.x, corner.y, Z_CONTROL),
        ));
    }
}

/// A press that starts on a button, or the spell's key, casts it once.
fn cast(
    mut commands: Commands,
    presses: Res<Presses>,
    keys: Res<ButtonInput<KeyCode>>,
    aim: Res<Aim>,
    mut mana: ResMut<Mana>,
    mut seeds: ResMut<Seeds>,
    mut field: ResMut<Field>,
    sheet: Res<Sheet>,
    sounds: Res<Sounds>,
) {
    let pressed = presses
        .0
        .iter()
        .filter_map(|&press| Spell::ALL.into_iter().find(|spell| spell.under(press)));
    let keyed = Spell::ALL
        .into_iter()
        .filter(|spell| keys.just_pressed(spell.key()));
    let casts: Vec<Spell> = pressed.chain(keyed).collect();

    for spell in casts {
        // Without the mana for it nothing happens at all, not even a sound.
        if mana.0 < spell.cost() {
            continue;
        }
        let worked = aim.tile.is_some_and(|tile| {
            let ground = field.ground(tile).unwrap_or_default().to_string();
            let thing = field.thing(tile).map(str::to_string);
            match spell {
                Spell::Gust => match thing.as_deref() {
                    Some("rubble" | "weeds") => {
                        // Gone, and the ground under it shows.
                        field.take_thing(&mut commands, tile);
                        true
                    }
                    _ => false,
                },
                Spell::BreakGround => match (ground.as_str(), thing.as_deref()) {
                    ("grass" | "grass_flowers", None) => {
                        field.set_ground(&mut commands, &sheet, tile, "soil");
                        true
                    }
                    _ => false,
                },
                Spell::Sprout => match (ground.as_str(), thing.as_deref()) {
                    ("soil", None) if seeds.0 > 0 => {
                        field.put_thing(&mut commands, &sheet, tile, "crop_seed");
                        seeds.0 -= 1;
                        true
                    }
                    _ => false,
                },
            }
        });
        if worked {
            mana.0 -= spell.cost();
            sounds.play(&mut commands, spell.name());
        } else {
            sounds.play(&mut commands, "no");
        }
    }
}

/// Each button shows whether the mage has the mana for a cast.
fn light_buttons(
    mana: Res<Mana>,
    controls: Res<Controls>,
    mut buttons: Query<(&mut SpellButton, &mut Sprite)>,
) {
    for (mut button, mut sprite) in &mut buttons {
        let lit = mana.0 >= button.spell.cost();
        if button.lit != lit {
            button.lit = lit;
            *sprite = controls.sprite(&button.spell.piece(lit));
        }
    }
}
