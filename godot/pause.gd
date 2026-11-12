extends Node2D
## The pause button and the pause panel. A touch on the button (or the P key) pauses the
## game; the game also pauses by itself when the page is hidden (another app or tab, or
## the screen goes off), closing the skills panel if it was open. While paused the game
## stands still the same way it does for the skills panel: the tree is paused, and this
## node runs anyway.
##
## Under the panel are two settings. A touch that starts on the sound setting switches the
## sound. A touch that starts on the erase setting asks first ("set_erase_sure"); a second
## one there erases the saved game and starts the game over, cover and all. Either way the
## game stays paused. Any other touch ends the pause and does nothing else, and so does P.
## A touch anywhere but the erase setting, or the end of the pause, takes the question back.

const BUTTON := Rect2(246, 6, 36, 36)  # the pause button, in the top strip
const PANEL := Vector2(48, 212)  # the panel's top-left corner
const SOUND := Rect2(48, 272, 192, 28)  # the sound setting
const ERASE := Rect2(48, 304, 192, 28)  # the erase setting

var is_open := false
var _sure := false  # whether the erase setting has asked and waits for a second touch
var _on_hidden: JavaScriptObject  # kept, so the page can call it

@onready var skills = %Skills
@onready var saver = %Save


func _ready() -> void:
	visible = false
	if OS.has_feature("web"):
		_on_hidden = JavaScriptBridge.create_callback(_page_hidden)
		JavaScriptBridge.get_interface("document").addEventListener("visibilitychange", _on_hidden)


func _exit_tree() -> void:
	if _on_hidden:
		JavaScriptBridge.get_interface("document").removeEventListener("visibilitychange", _on_hidden)


func _input(event: InputEvent) -> void:
	if is_open and _is_press(event):
		get_viewport().set_input_as_handled()  # this touch is the panel's alone
		_touched(make_input_local(event).position)
	elif is_open and _is_p(event):
		get_viewport().set_input_as_handled()
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


## A touch while paused, starting here.
func _touched(at: Vector2) -> void:
	if ERASE.has_point(at):
		if _sure:
			_erase()
			return
		_sure = true
	else:
		_sure = false
		if SOUND.has_point(at):
			Sounds.set_on(not Sounds.on)
		else:
			_open(false)
	queue_redraw()


## Erases the saved game, then starts the game again from its scene, as when the page opens:
## the cover shows, and behind it the game is as new.
func _erase() -> void:
	saver.erase()
	get_tree().reload_current_scene()


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
	_sure = false
	queue_redraw()
	get_tree().paused = open


func _draw() -> void:
	_piece("panel_pause", PANEL)
	_piece("set_sound_on" if Sounds.on else "set_sound_off", SOUND.position)
	_piece("set_erase_sure" if _sure else "set_erase", ERASE.position)


func _piece(piece: String, at: Vector2) -> void:
	var art: Rect2 = Sheet.piece(piece)
	draw_texture_rect_region(Sheet.controls, Rect2(at, art.size), art)


func _is_press(event: InputEvent) -> bool:
	return event is InputEventScreenTouch and event.pressed


func _is_p(event: InputEvent) -> bool:
	return event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_P
