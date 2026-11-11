extends Node2D
## The farm lot, drawn from lot.json: the ground, the things on top of it, then the mage.
## It also says what the mage can't cross, and does each spell's work on a tile.
## A planted seed goes on the things layer, over the soil. A watered crop grows by the
## clock, and every so often weeds come back on the bare grass farthest from the mage.

const SOLID := ["house_nw", "house_n", "house_ne", "house_sw", "house_s", "house_se", "crate"]  # the sprites the mage can't cross

var size: Vector2  # the lot's size, in pixels
var tiles: Vector2i  # the lot's size, in tiles
var _solid: Array  # where the SOLID sprites are on the sheet

## A watered crop shows each sprite from this many seconds after it was watered.
const GROWTH := [[0.0, "crop_seed"], [10.0, "crop_sprout"], [25.0, "crop_grown"], [40.0, "crop_ripe"]]
const WEEDS_EVERY := 45.0  # seconds between weeds coming back, from when the cover goes

## The lot's clock: seconds of real time while the game runs, from when the cover went.
## It goes by the real time between frames, so it is the same on a fast phone and a slow one.
var clock := 0.0
var _ticks := -1  # the real time at the last frame, in microseconds; -1 before the first
var _watered := {}  # tile -> the clock when its crop was watered
var _next_weeds := WEEDS_EVERY

@onready var ground: TileMapLayer = $Ground
@onready var things: TileMapLayer = $Things
@onready var mage: Sprite2D = $Mage


func _ready() -> void:
	var lot := Sheet.read("lot.json")
	_fill(ground, lot.ground, lot.ground_legend)
	_fill(things, lot.things, lot.things_legend)
	tiles = Vector2i(lot.width, lot.height)
	size = tiles * Sheet.tile
	_solid = SOLID.map(Sheet.cell)
	mage.position = Vector2(lot.start.x, lot.start.y) * Sheet.tile


## The clock stops while the game stands still (under the cover, or the skills panel).
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


## Whether a box, in the lot's pixels, reaches into a tile the mage can't cross.
## It asks the layers what is on each tile now, so it stays right when tiles change.
func blocks(box: Rect2) -> bool:
	var tile := float(Sheet.tile)
	for y in range(floori(box.position.y / tile), ceili(box.end.y / tile)):
		for x in range(floori(box.position.x / tile), ceili(box.end.x / tile)):
			var at := Vector2i(x, y)
			if ground.get_cell_atlas_coords(at) in _solid or things.get_cell_atlas_coords(at) in _solid:
				return true
	return false


## Whether a tile is on the lot.
func has_tile(at: Vector2i) -> bool:
	return Rect2i(Vector2i.ZERO, tiles).has_point(at)


## The spell Gust: blows the rubble or weeds off a tile, so the ground under them shows.
## Says whether there were any. (A spell's button calls the function with the spell's name.)
func gust(at: Vector2i) -> bool:
	if things.get_cell_atlas_coords(at) not in [Sheet.cell("rubble"), Sheet.cell("weeds")]:
		return false
	things.erase_cell(at)
	return true


## The spell Break Ground: turns grass (plain or with flowers) with nothing on it to soil.
## Says whether it did.
func break_ground(at: Vector2i) -> bool:
	if ground.get_cell_atlas_coords(at) not in [Sheet.cell("grass"), Sheet.cell("grass_flowers")] or _has_thing(at):
		return false
	ground.set_cell(at, 0, Sheet.cell("soil"))
	return true


## The spell Sprout: plants one of the mage's seeds in soil with nothing on it.
## Says whether it did.
func sprout(at: Vector2i) -> bool:
	if ground.get_cell_atlas_coords(at) != Sheet.cell("soil") or _has_thing(at) or mage.seeds < 1:
		return false
	things.set_cell(at, 0, Sheet.cell("crop_seed"))
	mage.seeds -= 1
	return true


## The spell Draw: waters a planted seed that has not been watered, so it starts to grow.
## Says whether it did.
func draw(at: Vector2i) -> bool:
	if ground.get_cell_atlas_coords(at) != Sheet.cell("soil") or things.get_cell_atlas_coords(at) != Sheet.cell("crop_seed"):
		return false
	ground.set_cell(at, 0, Sheet.cell("soil_wet"))
	_watered[at] = clock
	return true


## Picks the crop on a tile if it is ripe: the tile goes back to bare grass, and the mage
## has one crop more. (A touch on a tile in reach calls this.)
func pick(at: Vector2i) -> void:
	if not _watered.has(at) or things.get_cell_atlas_coords(at) != Sheet.cell("crop_ripe"):
		return
	_watered.erase(at)
	things.erase_cell(at)
	ground.set_cell(at, 0, Sheet.cell("grass"))
	mage.crops += 1
	Sounds.play("pick")


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


## Puts one layer's tiles down. Each row is a line of letters; the legend names each letter's sprite.
func _fill(layer: TileMapLayer, rows: Array, legend: Dictionary) -> void:
	layer.tile_set = Sheet.tile_set
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			var sprite = legend.get(row[x])  # null where there is nothing
			if sprite != null:
				layer.set_cell(Vector2i(x, y), 0, Sheet.cell(sprite))
