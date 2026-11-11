extends Node2D
## The farm lot, drawn from lot.json: the ground, the things on top of it, then the mage.
## It also says what the mage can't cross, and does each spell's work on a tile.
## A planted seed goes on the things layer, over the soil.

const SOLID := ["house_nw", "house_n", "house_ne", "house_sw", "house_s", "house_se", "crate"]  # the sprites the mage can't cross

var size: Vector2  # the lot's size, in pixels
var tiles: Vector2i  # the lot's size, in tiles
var _solid: Array  # where the SOLID sprites are on the sheet

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


## Whether anything stands on a tile: rubble, weeds, the crate, a seed.
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
