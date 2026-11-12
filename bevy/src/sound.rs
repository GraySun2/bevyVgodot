//! The game's sounds. The .wav files are read from `../shared/` when the game
//! is built and travel inside the game's one .wasm file.
//!
//! A browser keeps a page silent until the player has touched it; the page
//! (`index.html`) switches the sound on at the first touch.
//!
//! The sound setting under the pause panel (see `pause`) switches all of the
//! game's sound off and on again.

use std::collections::HashMap;
use std::time::Duration;

use bevy::audio::{AddAudioSource, AudioSinkPlayback, Source};
use bevy::prelude::*;

/// The sounds the game uses so far, by their names in `sounds.json`.
const FILES: [(&str, &[u8]); 8] = [
    ("gust", include_bytes!("../../shared/gust.wav")),
    ("break_ground", include_bytes!("../../shared/break_ground.wav")),
    ("sprout", include_bytes!("../../shared/sprout.wav")),
    ("draw", include_bytes!("../../shared/draw.wav")),
    ("pick", include_bytes!("../../shared/pick.wav")),
    ("sell", include_bytes!("../../shared/sell.wav")),
    ("level_up", include_bytes!("../../shared/level_up.wav")),
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

/// The game's sounds, and whether the sound is on. It starts on.
#[derive(Resource)]
pub struct Sounds {
    files: HashMap<&'static str, Handle<Sound>>,
    on: bool,
}

impl Sounds {
    /// Plays the sound with this name once, from its start, if the sound is
    /// on. Sounds that are already playing carry on.
    pub fn play(&self, commands: &mut Commands, name: &str) {
        let Some(sound) = self.files.get(name) else {
            panic!("there is no sound called {name:?}");
        };
        if !self.on {
            return;
        }
        // Its player goes away by itself when the sound has ended.
        commands.spawn((AudioPlayer(sound.clone()), PlaybackSettings::DESPAWN));
    }

    pub fn is_on(&self) -> bool {
        self.on
    }

    /// Switches the sound on or off. Off, any sound still playing stops at
    /// once (`hush`).
    pub fn set_on(&mut self, on: bool) {
        self.on = on;
    }
}

impl FromWorld for Sounds {
    fn from_world(world: &mut World) -> Self {
        let mut sounds = world.resource_mut::<Assets<Sound>>();
        Sounds {
            files: FILES
                .into_iter()
                .map(|(name, wav)| (name, sounds.add(Sound(AudioSource { bytes: wav.into() }))))
                .collect(),
            on: true,
        }
    }
}

pub fn plugin(app: &mut App) {
    app.add_audio_source::<Sound>()
        .init_resource::<Sounds>()
        .add_systems(PostUpdate, hush.run_if(resource_changed::<Sounds>));
}

/// While the sound is off, no sound plays at all: any still playing is
/// stopped at once. (Its player then goes away by itself, as when a sound
/// ends. Stopping it, rather than taking the player away here, can't clash
/// with the engine's own work on the player in the same frame.)
fn hush(sounds: Res<Sounds>, playing: Query<&AudioSink, With<AudioPlayer<Sound>>>) {
    if sounds.on {
        return;
    }
    for sink in &playing {
        sink.stop();
    }
}
