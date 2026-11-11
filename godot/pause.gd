extends Node2D
## The pause button and the pause panel. A touch on the button (or the P key) pauses the
## game; the game also pauses by itself when the page is hidden (another app or tab, or
## the screen goes off), closing the skills panel if it was open. While paused the game
## stands still the same way it does for the skills panel: the tree is paused, and this
## node runs anyway. The next touch, wherever it starts, ends the pause and does nothing else.

const BUTTON := Rect2(246, 6, 36, 36)  # the pause button, in the top strip
const PANEL := Vector2(48, 212)  # the panel's top-left corner

var is_open := false
var _on_hidden: JavaScriptObject  # kept, so the page can call it

@onready var skills = %Skills
@onready var saver = %Save


func _ready() -> void:
	visible = false
	if OS.has_feature("web"):
		_on_hidden = JavaScriptBridge.create_callback(_page_hidden)
		JavaScriptBridge.get_interface("document").addEventListener("visibilitychange", _on_hidden)


func _input(event: InputEvent) -> void:
	if is_open and (_is_press(event) or _is_p(event)):
		get_viewport().set_input_as_handled()  # this touch only ends the pause
		_open(false)
	elif _is_p(event) and skills.is_open:
		get_viewport().set_input_as_handled()
		_open(true)


func _unhandled_input(event: InputEvent) -> void:
	if get_tree().paused:
		return  # the cover is still up
	if _is_p(event) or (_is_press(event) and BUTTON.has_point(make_input_local(event).position)):
		get_viewport().set_input_as_handled()
		_open(true)


## The page was hidden, or shown again. Hidden: pause (if the game is running at all) and save.
func _page_hidden(_args: Array) -> void:
	if JavaScriptBridge.get_interface("document").visibilityState != "hidden" or not saver.started:
		return
	if not is_open:
		_open(true)
	saver.save()


func _open(open: bool) -> void:
	if open and skills.is_open:
		skills.close_for_pause()
	is_open = open
	visible = open
	get_tree().paused = open


func _draw() -> void:
	var art: Rect2 = Sheet.piece("panel_pause")
	draw_texture_rect_region(Sheet.controls, Rect2(PANEL, art.size), art)


func _is_press(event: InputEvent) -> bool:
	return event is InputEventScreenTouch and event.pressed


func _is_p(event: InputEvent) -> bool:
	return event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_P
