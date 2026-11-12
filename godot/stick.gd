extends Node2D
## The thumb stick. This node sits on the base's center, so everything here is
## measured from there, in the picture's pixels.
## A touch that starts in the left half of the bottom strip takes hold of the stick,
## and the knob follows that touch until it lifts. A mouse press arrives as a touch
## too (project.godot turns that on), so there is one kind of input to handle.
## While the game stands still (the skills panel), the stick stands still too: it runs
## anyway only to notice its touch lifting, and lets go once the game goes on.

const ZONE := Rect2(-72, -72, 144, 144)  # the left half of the bottom strip
const REACH := 28.0  # the farthest the knob's center goes from the base's center
const REST := 8.0  # at this far or nearer, the stick asks for nothing

var _held := false  # whether a touch has hold of the stick
var _finger := 0  # which touch that is
var _lifted := false  # its touch lifted while the game stood still

@onready var base: Sprite2D = $Base
@onready var knob: Sprite2D = $Knob


func _ready() -> void:
	base.texture = Sheet.controls
	base.region_rect = Sheet.piece("stick_base")
	knob.texture = Sheet.controls
	knob.region_rect = Sheet.piece("stick_knob")


func _process(_delta: float) -> void:
	if _lifted and not get_tree().paused:
		_lifted = false
		_held = false
		knob.position = Vector2.ZERO


func _unhandled_input(event: InputEvent) -> void:
	if get_tree().paused:
		if event is InputEventScreenTouch and not event.pressed and _held and event.index == _finger:
			_lifted = true
		return
	if event is InputEventScreenTouch:
		var at: Vector2 = make_input_local(event).position
		if event.pressed and not _held and ZONE.has_point(at):
			_held = true
			_finger = event.index
			_put_knob(at)
		elif not event.pressed and _held and event.index == _finger:
			_held = false
			_put_knob(Vector2.ZERO)
	elif event is InputEventScreenDrag and _held and event.index == _finger:
		_put_knob(make_input_local(event).position)


## The way the stick points, one pixel long, or nothing while the knob is near the middle.
func way() -> Vector2:
	return knob.position.normalized() if knob.position.length() > REST else Vector2.ZERO


## Puts the knob where the stick's own touch is, as far as it can reach (or back on the
## center when that touch lifts). No other node gets that touch.
func _put_knob(at: Vector2) -> void:
	knob.position = at.limit_length(REACH)
	get_viewport().set_input_as_handled()
