#!/bin/sh
# Makes the game as the folder ./web, which a plain web host can serve as it is.
# Run it from anywhere:  sh build.sh
set -e
cd "$(dirname "$0")"

# The art and the map have one source, ../shared. Take a fresh copy each build.
rm -rf shared web
mkdir shared web
cp ../shared/lot.json ../shared/sprites.json ../shared/sprites.png shared/

# Tells the Godot editor that web/ is not part of the project.
touch web/.gdignore

godot --headless --import
godot --headless --export-release Web web/index.html

du -sh web
