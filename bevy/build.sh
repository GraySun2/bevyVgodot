#!/bin/sh
# Makes the game as the folder ./web, which a plain web host can serve as it is.
#
#   ./build.sh
#
# Needs cargo with the wasm32-unknown-unknown target, and wasm-opt
# (npm install -g binaryen). wasm-bindgen is installed here if it is missing
# or is not the version in Cargo.lock.
set -eu
cd "$(dirname "$0")"

command -v wasm-opt >/dev/null || {
    echo "wasm-opt is missing. Get it with: npm install -g binaryen" >&2
    exit 1
}

# The shared art and map in ../shared/ are read by the compiler (see
# src/sheet.rs and src/lot.rs) and end up inside the .wasm file.
#
# --ignore-rust-version: Bevy 0.20.1 asks for Rust 1.97.1 and this machine has
# 1.97.0, which builds it all the same.
cargo build --release --target wasm32-unknown-unknown --ignore-rust-version

want=$(sed -n '/^name = "wasm-bindgen"$/{n;s/^version = "\(.*\)"$/\1/p;}' Cargo.lock)
have=$(wasm-bindgen --version 2>/dev/null | cut -d' ' -f2 || true)
if [ "$have" != "$want" ]; then
    cargo install wasm-bindgen-cli --version "$want" --locked
fi

rm -rf web
mkdir web
wasm-bindgen --target web --no-typescript --out-dir web --out-name game \
    target/wasm32-unknown-unknown/release/game.wasm

# Make the .wasm file smaller.
wasm-opt -Oz web/game_bg.wasm -o web/game_bg.wasm

cp index.html web/

echo
echo "The web folder, in bytes:"
du -ab web | sort -n
