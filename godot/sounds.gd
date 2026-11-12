extends Node
## The shared sounds, reached from anywhere as "Sounds". sounds.json names each one's file.
## A sound is loaded the first time it is played. Every play starts it from its
## beginning, and plays may overlap, the same sound's included. While the sound setting
## is off, nothing plays at all.

const OVERLAP := 8  # how many plays of one sound can run at once

var on := true  # the sound setting
var _files := {}  # sound name -> its file
var _players := {}  # sound name -> the player that plays it


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS  # a sound already playing finishes, even while the game stands still
	var data := Sheet.read("sounds.json")
	for sound: String in data.sounds:
		_files[sound] = data.sounds[sound].file


## Turns the sound on or off. Off, any sound still playing stops too.
func set_on(value: bool) -> void:
	on = value
	if not on:
		for player: AudioStreamPlayer in _players.values():
			player.stop()


func play(sound: String) -> void:
	if not on:
		return
	if not _players.has(sound):
		var player := AudioStreamPlayer.new()
		player.stream = load(Sheet.DIR + _files[sound])
		player.max_polyphony = OVERLAP
		add_child(player)
		_players[sound] = player
	_players[sound].play()
