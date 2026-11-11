extends Sprite2D
## A spell's button. A touch that starts on it casts the spell once on the aimed tile,
## and so does the spell's key. Holding either down does nothing more.
## Set in the scene: the spell's name, what it costs in mana, and its key. The name picks
## the art ("spell_<name>" and "spell_<name>_off" in controls.json), the sound, and the
## lot's function of that name, which does the spell's work on a tile and says whether
## anything changed.

@export var spell := ""
@export var cost := 0.0
@export var key := KEY_NONE

@onready var mage = %Mage
@onready var aim = %Aim
@onready var lot = %Lot


func _ready() -> void:
	texture = Sheet.controls
	_show()


func _process(_delta: float) -> void:
	_show()


func _unhandled_input(event: InputEvent) -> void:
	var touched: bool = event is InputEventScreenTouch and event.pressed and get_rect().has_point(make_input_local(event).position)
	var keyed: bool = event is InputEventKey and event.pressed and not event.echo and event.keycode == key
	if touched or keyed:
		get_viewport().set_input_as_handled()
		cast()


## Casts the spell on the aimed tile.
func cast() -> void:
	if mage.mana < cost:
		return  # not enough mana: nothing at all happens
	if lot.call(spell, aim.tile()):
		mage.mana -= cost
		Sounds.play(spell)
	else:
		Sounds.play("no")  # nothing to change there, so the mana stays


## Shows the button lit while the mage has the mana for it, and dim while not.
func _show() -> void:
	region_rect = Sheet.piece("spell_" + spell + ("" if mage.mana >= cost else "_off"))
