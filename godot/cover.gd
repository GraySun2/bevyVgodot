extends ColorRect
## The cover the page opens on. One tap or click anywhere takes it away for good.
## Until then the game is paused, so nothing under the cover runs; the cover
## itself is set to run always.
## (In the scene, Words sits 3 pixels above the middle of the cover. That centers
## the letters themselves, tails of the p and y included.)


func _ready() -> void:
	get_tree().paused = true


func _input(event: InputEvent) -> void:
	var tap: bool = event is InputEventScreenTouch and event.pressed
	var click: bool = event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT
	if tap or click:
		get_viewport().set_input_as_handled()  # this tap is the cover's alone
		get_tree().paused = false
		queue_free()
