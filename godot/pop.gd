extends Sprite2D
## The level-up pop: shows for a while when a school gains a level. Its time stands still
## while the game does (it is paused with the rest), and a new level-up starts it over.

const SHOW_FOR := 1.5  # seconds

var _left := 0.0


func _ready() -> void:
	texture = Sheet.controls
	region_rect = Sheet.piece("pop_level_up")
	visible = false


func pop() -> void:
	_left = SHOW_FOR
	visible = true


func _process(delta: float) -> void:
	if visible:
		_left -= delta
		visible = _left > 0.0
