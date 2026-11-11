extends Node
## The shared sounds, reached from anywhere as "Sounds". sounds.json names each one's file.
## A sound is loaded the first time it is played. Every play starts it from its
## beginning, and plays may overlap, the same sound's included.

const OVERLAP := 8  # how many plays of one sound can run at once

var _files := {}  # sound name -> its file
var _players := {}  # sound name -> the player that plays it


func _ready() -> void:
	var data := Sheet.read("sounds.json")
	for sound: String in data.sounds:
		_files[sound] = data.sounds[sound].file


func play(sound: String) -> void:
	if not _players.has(sound):
		var player := AudioStreamPlayer.new()
		player.stream = load(Sheet.DIR + _files[sound])
		player.max_polyphony = OVERLAP
		add_child(player)
		_players[sound] = player
	_players[sound].play()
