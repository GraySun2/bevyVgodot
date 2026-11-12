extends Node
## Saves the game in the browser's own storage (localStorage, which keeps it after the page
## is closed): every 30 seconds while the game runs, when the page is hidden (pause.gd calls
## save()), and when the page is closed. A saved game is read back when the page opens,
## under the cover, so when the cover goes the game is as it was saved. The mage starts on
## its starting tile facing down, as always; no time has passed while the page was closed.
## Each saved game says its version, and anything a later version adds is read with a
## default, so a game saved now still opens after later steps. The pause panel can also
## erase the saved game (erase()).

const KEY := "godot-farm-save"
const VERSION := 2  # 2 added the six things done once and the sound setting
const EVERY := 30.0  # seconds of play between saves

var started := false  # whether the cover has gone (before that there is nothing to save)
var _since := 0.0
var _on_close: JavaScriptObject  # kept, so the page can call it

@onready var lot = %Lot
@onready var mage = %Mage
@onready var skills = %Skills
@onready var hint = %Hint


func _ready() -> void:
	if not OS.has_feature("web"):
		return
	_on_close = JavaScriptBridge.create_callback(func(_args): save())
	JavaScriptBridge.get_interface("window").addEventListener("pagehide", _on_close)
	var text = JavaScriptBridge.eval("(function () { try { return localStorage.getItem('%s') || ''; } catch (e) { return ''; } })()" % KEY)
	var reader := JSON.new()  # parse() says when a save is broken without printing an error, unlike parse_string()
	if str(text) != "" and reader.parse(str(text)) == OK and reader.data is Dictionary:
		_restore(reader.data)


func _exit_tree() -> void:
	if _on_close:
		JavaScriptBridge.get_interface("window").removeEventListener("pagehide", _on_close)


func _notification(what: int) -> void:
	if what == NOTIFICATION_UNPAUSED:
		started = true  # the first time is the cover going


func _process(delta: float) -> void:
	_since += delta
	if _since >= EVERY:
		_since = 0.0
		save()


func save() -> void:
	if not started or not OS.has_feature("web"):
		return
	var saved := {
		"version": VERSION,
		"lot": lot.state(),
		"mana": mage.mana,
		"seeds": mage.seeds,
		"crops": mage.crops,
		"coins": mage.coins,
		"schools": skills.state(),
		"done": hint.state(),
		"sound": Sounds.on,
	}
	JavaScriptBridge.eval("(function () { try { localStorage.setItem('%s', %s); } catch (e) {} })()" % [KEY, JSON.stringify(JSON.stringify(saved))])


func _restore(saved: Dictionary) -> void:
	lot.restore(saved.get("lot", {}))
	mage.mana = clampf(float(saved.get("mana", mage.MANA_MAX)), 0.0, mage.MANA_MAX)
	mage.seeds = maxi(0, int(saved.get("seeds", mage.seeds)))
	mage.crops = maxi(0, int(saved.get("crops", mage.crops)))
	mage.coins = maxi(0, int(saved.get("coins", mage.coins)))
	skills.restore(saved.get("schools", {}))
	hint.restore(saved.get("done", []))
	Sounds.set_on(saved.get("sound", true) != false)


## Forgets the saved game for good, and the sound goes back on, as at the very first time.
## Nothing more is saved until the cover goes again.
func erase() -> void:
	started = false
	Sounds.set_on(true)
	if OS.has_feature("web"):
		JavaScriptBridge.eval("(function () { try { localStorage.removeItem('%s'); } catch (e) {} })()" % KEY)
