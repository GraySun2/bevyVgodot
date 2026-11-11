extends Node2D
## A count in the top strip: a small picture, then a number written with the digit
## pieces from controls.png, with no zeros in front. This node sits on the picture's
## top-left corner. Set in the scene: the picture's piece and which of the mage's
## numbers it shows.

const DIGITS := Vector2(20, 1)  # where the first digit starts, from the picture's corner
const STEP := 12.0  # how much further right each next digit starts

@export var icon := ""
@export var counts := ""  # the name of the mage's number, such as "seeds"

var _shown := -1  # the number drawn now

@onready var mage = %Mage


func _process(_delta: float) -> void:
	if mage.get(counts) != _shown:
		queue_redraw()


func _draw() -> void:
	_shown = mage.get(counts)
	var art: Rect2 = Sheet.piece(icon)
	draw_texture_rect_region(Sheet.controls, Rect2(Vector2.ZERO, art.size), art)
	var text := str(_shown)
	for i in text.length():
		var digit: Rect2 = Sheet.piece("digit_" + text[i])
		draw_texture_rect_region(Sheet.controls, Rect2(DIGITS + Vector2(STEP * i, 0), digit.size), digit)
