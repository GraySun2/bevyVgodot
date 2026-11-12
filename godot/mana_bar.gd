extends Node2D
## The mana bar in the top strip: a box with a 1 pixel border, filled from the left
## for the mana the mage has. This node sits on the box's top-left corner.

const SIZE := Vector2(120, 12)
const INSIDE := Rect2(1, 1, 118, 10)
const BORDER := Color("fff4d8")
const FULL := Color("5ac8e8")
const EMPTY := Color("1f3a36")

var _shown := -1  # how many pixels of FULL are drawn now

@onready var mage = %Mage


func _process(_delta: float) -> void:
	if _filled() != _shown:
		queue_redraw()


func _draw() -> void:
	_shown = _filled()
	draw_rect(Rect2(Vector2.ZERO, SIZE), BORDER)
	draw_rect(INSIDE, EMPTY)
	draw_rect(Rect2(INSIDE.position, Vector2(_shown, INSIDE.size.y)), FULL)


## How many pixels across are filled: in proportion to the mana, to the nearest pixel.
func _filled() -> int:
	return roundi(INSIDE.size.x * mage.mana / mage.MANA_MAX)
