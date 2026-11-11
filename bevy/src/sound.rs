//! The game's sounds. The .wav files are read from `../shared/` when the game
//! is built and travel inside the game's one .wasm file.
//!
//! A browser keeps a page silent until the player has touched it; the page
//! (`index.html`) switches the sound on at the first touch.

use std::collections::HashMap;
use std::time::Duration;

use bevy::audio::{AddAudioSource, Source};
use bevy::prelude::*;

/// The sounds the game uses so far, by their names in `sounds.json`.
const FILES: [(&str, &[u8]); 6] = [
    ("gust", include_bytes!("../../shared/gust.wav")),
    ("break_ground", include_bytes!("../../shared/break_ground.wav")),
    ("sprout", include_bytes!("../../shared/sprout.wav")),
    ("draw", include_bytes!("../../shared/draw.wav")),
    ("pick", include_bytes!("../../shared/pick.wav")),
    ("no", include_bytes!("../../shared/no.wav")),
];

/// A short silence put before every sound. The engine plays the first 512
/// samples of anything it starts as if they were at 48,000 samples a second,
/// whatever the file says, so a sound that began at once would begin too fast
/// and too high. The files have 22,050 samples a second, so this is a little
/// more than 512 samples, and what is played wrong is silence.
const LEAD_IN: Duration = Duration::from_millis(24);

/// One sound: a .wav file, played after the lead-in.
#[derive(Asset, TypePath)]
struct Sound(AudioSource);

impl Decodable for Sound {
    type Decoder = Box<dyn Source + Send>;

    fn decoder(&self) -> Self::Decoder {
        Box::new(self.0.decoder().delay(LEAD_IN))
    }
}

#[derive(Resource)]
pub struct Sounds(HashMap<&'static str, Handle<Sound>>);

impl Sounds {
    /// Plays the sound with this name once, from its start. Sounds that are
    /// already playing carry on.
    pub fn play(&self, commands: &mut Commands, name: &str) {
        let Some(sound) = self.0.get(name) else {
            panic!("there is no sound called {name:?}");
        };
        // Its player goes away by itself when the sound has ended.
        commands.spawn((AudioPlayer(sound.clone()), PlaybackSettings::DESPAWN));
    }
}

impl FromWorld for Sounds {
    fn from_world(world: &mut World) -> Self {
        let mut sounds = world.resource_mut::<Assets<Sound>>();
        Sounds(
            FILES
                .into_iter()
                .map(|(name, wav)| (name, sounds.add(Sound(AudioSource { bytes: wav.into() }))))
                .collect(),
        )
    }
}

pub fn plugin(app: &mut App) {
    app.add_audio_source::<Sound>().init_resource::<Sounds>();
}
