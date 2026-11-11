extends Node2D
## The farm lot, drawn from lot.json: the ground, the things on top of it, then the mage.
## It also says what the mage can't cross.

const SOLID := ["house_nw", "house_n", "house_ne", "house_sw", "house_s", "house_se", "crate"]  # the sprites the mage can't cross

var size: Vector2  # the lot's size, in pixels
var _solid: Array  # where the SOLID sprites are on the sheet

@onready var ground: TileMapLayer = $Ground
@onready var things: TileMapLayer = $Things
@onready var mage: Sprite2D = $Mage


func _ready() -> void:
	var lot := Sheet.read("lot.json")
	_fill(ground, lot.ground, lot.ground_legend)
	_fill(things, lot.things, lot.things_legend)
	size = Vector2(lot.width, lot.height) * Sheet.tile
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


## Puts one layer's tiles down. Each row is a line of letters; the legend names each letter's sprite.
func _fill(layer: TileMapLayer, rows: Array, legend: Dictionary) -> void:
	layer.tile_set = Sheet.tile_set
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			var sprite = legend.get(row[x])  # null where there is nothing
			if sprite != null:
				layer.set_cell(Vector2i(x, y), 0, Sheet.cell(sprite))
