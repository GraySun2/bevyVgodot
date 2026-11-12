extends Place
## The farm lot, drawn from lot.json: the ground, the things on top of it. Its stairwell
## goes down to the dungeon.
## It says what the mage can't cross, and does each spell's work on a tile. It tells the hint
## when one of the six things a new player does once is done.
## A planted seed goes on the things layer, over the soil. A watered crop grows by the
## clock, and every so often weeds come back on the bare grass farthest from the mage.

const SOLID := ["house_nw", "house_n", "house_ne", "house_sw", "house_s", "house_se", "crate"]  # the sprites the mage can't cross

## A watered crop shows each sprite from this many seconds after it was watered.
const GROWTH := [[0.0, "crop_seed"], [10.0, "crop_sprout"], [25.0, "crop_grown"], [40.0, "crop_ripe"]]
const WEEDS_EVERY := 45.0  # seconds between weeds coming back, from when the cover goes
const PRICE := 5  # coins for each crop sold at the crate

## The lot's clock: seconds of real time while the game runs and the mage is on the lot,
## from when the cover went. It goes by the real time between frames, so it is the same on
## a fast phone and a slow one.
var clock := 0.0
var _ticks := -1  # the real time at the last frame, in microseconds; -1 before the first
var _watered := {}  # tile -> the clock when its crop was watered
var _next_weeds := WEEDS_EVERY

@onready var hint = %Hint  # told when one of the six things is done here


func _ready() -> void:
	var lot := Sheet.read("lot.json")
	lay(lot, SOLID, "stairs_down")
	mage.position = Vector2(lot.start.x, lot.start.y) * Sheet.tile


## The clock stops while the game stands still (under the cover, or a panel), and while
## the lot is switched off: on the stairs and below (Places does that). Godot tells the
## lot both ways with these two notifications.
func _notification(what: int) -> void:
	if what == NOTIFICATION_PAUSED and _ticks >= 0:
		clock += (Time.get_ticks_usec() - _ticks) / 1000000.0
		_ticks = -1
	elif what == NOTIFICATION_UNPAUSED:
		_ticks = Time.get_ticks_usec()


func _process(_delta: float) -> void:
	var now := Time.get_ticks_usec()
	if _ticks >= 0:
		clock += (now - _ticks) / 1000000.0
	_ticks = now
	for at: Vector2i in _watered:
		var sprite := _growth(clock - _watered[at])
		if things.get_cell_atlas_coords(at) != Sheet.cell(sprite):
			things.set_cell(at, 0, Sheet.cell(sprite))
	while clock >= _next_weeds:
		_next_weeds += WEEDS_EVERY
		_grow_weeds()


## The spell Gust: blows the rubble or weeds off a tile, so the ground under them shows.
## Says whether there were any.
func gust(at: Vector2i) -> bool:
	if things.get_cell_atlas_coords(at) not in [Sheet.cell("rubble"), Sheet.cell("weeds")]:
		return false
	things.erase_cell(at)
	hint.did(Hint.CLEARED)
	return true


## The spell Break Ground: turns grass (plain or with flowers) with nothing on it to soil.
## Says whether it did.
func break_ground(at: Vector2i) -> bool:
	if ground.get_cell_atlas_coords(at) not in [Sheet.cell("grass"), Sheet.cell("grass_flowers")] or _has_thing(at):
		return false
	ground.set_cell(at, 0, Sheet.cell("soil"))
	hint.did(Hint.SOIL)
	return true


## The spell Sprout: plants one of the mage's seeds in soil with nothing on it.
## Says whether it did.
func sprout(at: Vector2i) -> bool:
	if ground.get_cell_atlas_coords(at) != Sheet.cell("soil") or _has_thing(at) or mage.seeds < 1:
		return false
	things.set_cell(at, 0, Sheet.cell("crop_seed"))
	mage.seeds -= 1
	hint.did(Hint.PLANTED)
	return true


## The spell Draw: waters a planted seed that has not been watered, so it starts to grow.
## Says whether it did.
func draw(at: Vector2i) -> bool:
	if ground.get_cell_atlas_coords(at) != Sheet.cell("soil") or things.get_cell_atlas_coords(at) != Sheet.cell("crop_seed"):
		return false
	ground.set_cell(at, 0, Sheet.cell("soil_wet"))
	_watered[at] = clock
	hint.did(Hint.WATERED)
	return true


## A touch on a tile in reach: picks a ripe crop there, or sells at the crate.
func touched(at: Vector2i) -> void:
	if things.get_cell_atlas_coords(at) == Sheet.cell("crate"):
		sell()
	else:
		pick(at)


## Sells every crop the mage carries, or says no when it has none.
func sell() -> void:
	if mage.crops < 1:
		Sounds.play("no")
		return
	mage.coins += PRICE * mage.crops
	mage.crops = 0
	Sounds.play("sell")
	hint.did(Hint.SOLD)


## Picks the crop on a tile if it is ripe: the tile goes back to bare grass, and the mage
## has one crop more.
func pick(at: Vector2i) -> void:
	if not _watered.has(at) or things.get_cell_atlas_coords(at) != Sheet.cell("crop_ripe"):
		return
	_watered.erase(at)
	things.erase_cell(at)
	ground.set_cell(at, 0, Sheet.cell("grass"))
	mage.crops += 1
	Sounds.play("pick")
	hint.did(Hint.PICKED)


## The clock as of now, the part of a frame since the last one included.
func now() -> float:
	return clock + ((Time.get_ticks_usec() - _ticks) / 1000000.0 if _ticks >= 0 else 0.0)


## What a saved game keeps of the lot: each tile's ground and thing (row by row, "" for no
## thing), how long each watered crop has grown, and how far the weeds' clock has come.
func state() -> Dictionary:
	var at_now := now()
	var ground_names := []
	var thing_names := []
	for y in tiles.y:
		for x in tiles.x:
			ground_names.append(Sheet.sprite_at(ground.get_cell_atlas_coords(Vector2i(x, y))))
			thing_names.append(Sheet.sprite_at(things.get_cell_atlas_coords(Vector2i(x, y))))
	var grown := []
	for at: Vector2i in _watered:
		grown.append([at.x, at.y, at_now - _watered[at]])
	return {"ground": ground_names, "things": thing_names, "grown": grown, "weeds_in": _next_weeds - at_now}


## Puts the lot back as a saved game had it. Anything missing or unknown keeps what is there.
func restore(saved: Dictionary) -> void:
	var ground_names: Array = saved.get("ground", [])
	var thing_names: Array = saved.get("things", [])
	if ground_names.size() == tiles.x * tiles.y and thing_names.size() == tiles.x * tiles.y:
		for i in ground_names.size():
			var at := Vector2i(i % tiles.x, i / tiles.x)
			if Sheet.has_sprite(str(ground_names[i])):
				ground.set_cell(at, 0, Sheet.cell(ground_names[i]))
			if str(thing_names[i]) == "":
				things.erase_cell(at)
			elif Sheet.has_sprite(str(thing_names[i])):
				things.set_cell(at, 0, Sheet.cell(thing_names[i]))
	_watered.clear()
	for crop in saved.get("grown", []):
		_watered[Vector2i(int(crop[0]), int(crop[1]))] = clock - float(crop[2])
	_next_weeds = clock + clampf(float(saved.get("weeds_in", WEEDS_EVERY)), 0.0, WEEDS_EVERY)


## Which sprite a watered crop shows this long after it was watered.
func _growth(age: float) -> String:
	var sprite: String = GROWTH[0][1]
	for stage in GROWTH:
		if age >= stage[0]:
			sprite = stage[1]
	return sprite


## Weeds grow on the bare grass tile farthest from the mage's tile (tiles across plus
## tiles up or down); of those as far, the highest up, then the one most to the left.
## With no bare grass, nothing grows.
func _grow_weeds() -> void:
	var from: Vector2i = mage.tile()
	var grass := [Sheet.cell("grass"), Sheet.cell("grass_flowers")]
	var best := Vector2i(-1, -1)
	var best_far := -1
	for y in tiles.y:  # top row first, left first, so the first of the farthest wins
		for x in tiles.x:
			var at := Vector2i(x, y)
			var far := absi(x - from.x) + absi(y - from.y)
			if far > best_far and ground.get_cell_atlas_coords(at) in grass and not _has_thing(at):
				best = at
				best_far = far
	if best_far >= 0:
		things.set_cell(best, 0, Sheet.cell("weeds"))


## Whether anything stands on a tile: rubble, weeds, the crate, a crop.
func _has_thing(at: Vector2i) -> bool:
	return things.get_cell_source_id(at) != -1
