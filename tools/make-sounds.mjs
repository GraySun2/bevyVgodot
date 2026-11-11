// Makes the shared sounds, the same for both builds: short WAV files, drawn in code like the sprite sheet.
// Shared sound counts for neither build. Loading and playing it is each build's own work.
//
//   node tools/make-sounds.mjs
//
// Writes shared/*.wav (one channel, 16 bits, 22,050 samples a second) and shared/sounds.json.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "shared");
const RATE = 22050, TAU = Math.PI * 2;

// The same "random" hiss every time, so the files don't change from run to run.
function hiss(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2147483648 - 1; }; }
const buf = (secs) => new Float64Array(Math.round(secs * RATE));
// A tone whose pitch can glide, with a soft start and a fading tail.
function tone(out, at, secs, f0, f1, vol, { attack = 0.008, curve = 3, over = 0 } = {}) {
  let ph = 0; const n = Math.round(secs * RATE), start = Math.round(at * RATE);
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE, u = i / n, f = f0 * Math.pow(f1 / f0, u); ph += (TAU * f) / RATE;
    const env = Math.min(1, t / attack) * Math.pow(1 - u, curve);
    out[start + i] += vol * env * (Math.sin(ph) + over * Math.sin(2 * ph));
  }
}
// Hiss through a band that sweeps, for wind and for crumbling earth.
function sweep(out, at, secs, f0, f1, f2, vol, seed, { q = 2.5, attack = 0.08, curve = 2 } = {}) {
  const rnd = hiss(seed), n = Math.round(secs * RATE), start = Math.round(at * RATE); let lo = 0, band = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE, u = i / n, fc = u < 0.4 ? f0 * Math.pow(f1 / f0, u / 0.4) : f1 * Math.pow(f2 / f1, (u - 0.4) / 0.6);
    const k = 2 * Math.sin((Math.PI * fc) / RATE), hi = rnd() - lo - band / q; band += k * hi; lo += k * band;
    const a = Math.min(1, t / attack), env = Math.sin((Math.PI / 2) * a) ** 2 * Math.pow(1 - u, curve);
    out[start + i] += vol * env * band;
  }
}

const SOUNDS = {
  // Gust: a breath of wind that rises and falls away.
  gust: { about: "Gust is cast and clears a tile", make() { const o = buf(0.45); sweep(o, 0, 0.45, 350, 1900, 600, 0.9, 11); return o; } },
  // Break Ground: a low thump with a crumble on top.
  break_ground: { about: "Break Ground is cast and turns a tile to soil", make() { const o = buf(0.36); tone(o, 0, 0.3, 120, 50, 0.8, { curve: 2.5 }); sweep(o, 0.02, 0.3, 900, 400, 200, 0.5, 23, { q: 1.2, attack: 0.01, curve: 3 }); return o; } },
  // Sprout: a small rising chirp.
  sprout: { about: "Sprout is cast and plants a seed", make() { const o = buf(0.3); tone(o, 0, 0.26, 520, 1040, 0.55, { attack: 0.015, curve: 2, over: 0.2 }); return o; } },
  // Draw: two drops of water.
  draw: { about: "Draw is cast and waters a tile", make() { const o = buf(0.42); tone(o, 0, 0.16, 620, 1250, 0.6, { curve: 2.5 }); tone(o, 0.17, 0.22, 760, 1500, 0.5, { curve: 2.5 }); return o; } },
  // Picking a ripe crop: a soft pluck.
  pick: { about: "a ripe crop is picked", make() { const o = buf(0.2); tone(o, 0, 0.18, 880, 860, 0.6, { attack: 0.003, curve: 4, over: 0.3 }); return o; } },
  // Selling at the crate: two bright coin notes.
  sell: { about: "the crops are sold at the crate", make() { const o = buf(0.5); tone(o, 0, 0.2, 1319, 1319, 0.45, { attack: 0.003, curve: 4, over: 0.25 }); tone(o, 0.09, 0.4, 1760, 1760, 0.45, { attack: 0.003, curve: 4, over: 0.25 }); return o; } },
  // A level gained: four notes going up, the last one ringing.
  level_up: { about: "a school of magic gains a level", make() { const o = buf(0.8); [523.25, 659.25, 783.99, 1046.5].forEach((f, n) => tone(o, n * 0.11, n === 3 ? 0.45 : 0.16, f, f, 0.45, { attack: 0.005, curve: n === 3 ? 3 : 2.5, over: 0.2 })); return o; } },
  // The soft "no": two low notes stepping down, quiet.
  no: { about: "a cast changes nothing", make() { const o = buf(0.22); tone(o, 0, 0.09, 196, 196, 0.4, { attack: 0.01, curve: 1.5 }); tone(o, 0.1, 0.12, 147, 147, 0.4, { attack: 0.01, curve: 2 }); return o; } },
};

function wav(samples) {
  const n = samples.length, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return b;
}

const list = {};
for (const [name, s] of Object.entries(SOUNDS)) {
  const o = s.make(); let peak = 0; for (const v of o) peak = Math.max(peak, Math.abs(v));
  // Every sound is brought to the same loudest point, a little under full, and ends on silence.
  const top = name === "no" ? 0.45 : 0.8; for (let i = 0; i < o.length; i++) o[i] *= top / peak;
  for (let i = 0; i < 64; i++) o[o.length - 1 - i] *= i / 64;
  fs.writeFileSync(path.join(OUT, name + ".wav"), wav(o));
  list[name] = { file: name + ".wav", seconds: +(o.length / RATE).toFixed(3), plays_when: s.about };
}
fs.writeFileSync(path.join(OUT, "sounds.json"), JSON.stringify({ about: "The sounds, the same for both builds. Each is a short WAV file: one channel, 16 bits, 22,050 samples a second. Play a sound once, from its start, each time its moment comes. Sounds may overlap.", sounds: list }, null, 2) + "\n");
console.log("wrote", Object.keys(list).length, "sounds:", Object.entries(list).map(([k, v]) => k + " " + v.seconds + "s").join(", "));
