extends Node2D
## Fits the upright picture to the screen: as big as fits, the same shape, centered.
## Everything in the game goes under Picture and works in the picture's own
## pixels (288 by 576), whatever the size of the screen. The rest of the screen
## shows the project's clear color.

const PICTURE := Vector2(288, 576)  # 9 by 18 tiles of 32 pixels

@onready var picture: Node2D = $Picture


func _ready() -> void:
	get_window().size_changed.connect(_fit)
	_fit()


func _fit() -> void:
	var window := get_window()
	var screen := Vector2(window.size)
	if screen.x < 1 or screen.y < 1:
		return
	var zoom := minf(screen.x / PICTURE.x, screen.y / PICTURE.y)
	# The window draws everything this many times bigger, text included.
	window.content_scale_factor = zoom
	# The picture's corner sits on a whole screen pixel, so sprite pixels stay even.
	var corner := ((screen - PICTURE * zoom) / 2.0).round()
	picture.position = corner / zoom
