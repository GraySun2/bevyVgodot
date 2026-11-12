extends Place
## The dungeon floor under the lot, drawn from dungeon.json: the ground, the things on top
## of it. Its stairs go up to the lot. Each trip down starts it fresh (Places calls reset()).
## The mage can't cross the walls, or a gate while it is there. Each gate opens to one spell,
## which dungeon.json names; every other spell changes nothing here. Stepping onto coins or
## the cache takes them.
## Four creatures live here too (Creatures, which draws them over the floor). Gust and Draw on
## a creature's tile hit the creatures there, and the other two spells do nothing to them.

const SOLID := ["wall", "gate_rubble", "gate_dirt", "gate_vine", "gate_basin"]  # the sprites the mage can't cross

var _data: Dictionary  # dungeon.json
var _opens := {}  # the sheet cell of each gate -> the name of the spell that opens it, as a button calls it
var _keep_out: Array  # where the sprites a creature can't cross are on the sheet

@onready var creatures = %Creatures


func _ready() -> void:
	_data = Sheet.read("dungeon.json")
	for gate: String in _data.opens:
		_opens[Sheet.cell(gate)] = str(_data.opens[gate]).to_lower().replace(" ", "_")  # "Break Ground" -> break_ground
	_keep_out = (SOLID + ["stairs_up"]).map(Sheet.cell)
	reset()


## Puts the floor back as dungeon.json has it: all the gates shut, the coins and the cache
## back, and the four creatures on their starting tiles with full nerve.
func reset() -> void:
	lay(_data, SOLID, "stairs_up")
	creatures.reset(_data.creatures)


## Whether a creature's box, in the place's pixels, reaches into a tile it can't cross:
## a wall, a gate while it is there, or the stairs.
func creature_blocks(box: Rect2) -> bool:
	return reaches(box, _keep_out)


## A creature's tile is never a gate's tile (its box can't go there), so a cast hits one or the other.
func gust(at: Vector2i) -> bool:
	return creatures.gust(at) or _open("gust", at)


func break_ground(at: Vector2i) -> bool:
	return _open("break_ground", at)


func sprout(at: Vector2i) -> bool:
	return _open("sprout", at)  # the vine opens without a seed, and uses none


func draw(at: Vector2i) -> bool:
	return creatures.draw(at) or _open("draw", at)


## Coins go to the mage's coins, and the cache's seeds to its seeds.
func stepped(at: Vector2i) -> void:
	var thing := things.get_cell_atlas_coords(at)
	if thing == Sheet.cell("coins"):
		things.erase_cell(at)
		mage.coins += int(_data.coins_in_each_pile)
		Sounds.play("sell")
	elif thing == Sheet.cell("cache"):
		things.erase_cell(at)
		mage.seeds += int(_data.seeds_in_the_cache)
		Sounds.play("pick")


## Opens the gate on a tile if this spell is the one it opens to: the gate is gone, and the
## floor under it shows. Says whether it did.
func _open(spell: String, at: Vector2i) -> bool:
	if _opens.get(things.get_cell_atlas_coords(at)) != spell:
		return false
	things.erase_cell(at)
	return true
