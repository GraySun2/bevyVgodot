extends Node2D
## The four schools of magic and the skills panel that shows them.
## Each spell trains a school. A cast that changes something gives its school XP, and a
## school gains a level when its XP reaches what the level needs; the XP over is kept.
## A touch on the skills button (or the K key) opens the panel. While it is open the game
## stands still: the tree is paused, and this node runs anyway. The next touch, wherever
## it starts, closes the panel and does nothing else.

const SCHOOLS := ["air", "earth", "growth", "water"]  # top to bottom on the panel
const XP_PER_CAST := 10
const FIRST_NEED := 100  # XP to go from level 1 to level 2
const MORE := 1.12  # each level after that needs 12% more than the one before, to the nearest whole number
const BUTTON := Rect2(204, 6, 36, 36)  # the skills button, in the top strip
const PANEL := Vector2(16, 112)  # the panel's top-left corner
const LEVEL_X := 228.0  # where each school's first level digit starts
const BAR_X := 30.0  # where each school's bar starts
const TOP := {"air": [148, 168], "earth": [190, 210], "growth": [232, 252], "water": [274, 294]}  # each row's level digits and bar, from the top
const BAR_SIZE := Vector2(228, 8)
const BAR := Color("ffd25a")
const DIGIT_STEP := 12.0

var level := {}  # school -> its level
var xp := {}  # school -> its XP toward the next level
var is_open := false

@onready var pop = %LevelUp


func _ready() -> void:
	for school in SCHOOLS:
		level[school] = 1
		xp[school] = 0
	visible = false


## How much XP a school at this level needs to reach the next one.
func need(at_level: int) -> int:
	var n := FIRST_NEED
	for i in at_level - 1:
		n = roundi(n * MORE)
	return n


## Gives a school the XP for one cast that changed something, and a level if that is enough.
func train(school: String) -> void:
	xp[school] += XP_PER_CAST
	if xp[school] >= need(level[school]):
		xp[school] -= need(level[school])
		level[school] += 1
		Sounds.play("level_up")
		pop.pop()
	queue_redraw()


func _input(event: InputEvent) -> void:
	if is_open and (_is_press(event) or _is_k(event)):
		get_viewport().set_input_as_handled()  # this touch only closes the panel
		_open(false)


func _unhandled_input(event: InputEvent) -> void:
	if get_tree().paused:
		return  # the cover is still up
	if _is_k(event) or (_is_press(event) and BUTTON.has_point(make_input_local(event).position)):
		get_viewport().set_input_as_handled()
		_open(true)


func _open(open: bool) -> void:
	is_open = open
	visible = open
	get_tree().paused = open
	queue_redraw()


func _draw() -> void:
	var art: Rect2 = Sheet.piece("panel_skills")
	draw_texture_rect_region(Sheet.controls, Rect2(PANEL, art.size), art)
	for school: String in SCHOOLS:
		var text := str(level[school])
		for i in text.length():
			var digit: Rect2 = Sheet.piece("digit_" + text[i])
			draw_texture_rect_region(Sheet.controls, Rect2(Vector2(LEVEL_X + DIGIT_STEP * i, TOP[school][0]), digit.size), digit)
		var filled := roundi(BAR_SIZE.x * xp[school] / need(level[school]))
		draw_rect(Rect2(Vector2(BAR_X, TOP[school][1]), Vector2(filled, BAR_SIZE.y)), BAR)


func _is_press(event: InputEvent) -> bool:
	return event is InputEventScreenTouch and event.pressed


func _is_k(event: InputEvent) -> bool:
	return event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_K
