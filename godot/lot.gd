extends Node2D
## The farm lot, drawn from lot.json: the ground, the things on top of it, then the mage.

@onready var ground: TileMapLayer = $Ground
@onready var things: TileMapLayer = $Things
@onready var mage: Sprite2D = $Mage


func _ready() -> void:
	var lot: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(Sheet.DIR + "lot.json"))
	_fill(ground, lot.ground, lot.ground_legend)
	_fill(things, lot.things, lot.things_legend)
	mage.texture = Sheet.texture
	mage.region_rect = Sheet.region("mage_down")
	mage.position = Vector2(lot.start.x, lot.start.y) * Sheet.tile


## Puts one layer's tiles down. Each row is a line of letters; the legend names each letter's sprite.
func _fill(layer: TileMapLayer, rows: Array, legend: Dictionary) -> void:
	layer.tile_set = Sheet.tile_set
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			var sprite = legend.get(row[x])  # null where there is nothing
			if sprite != null:
				layer.set_cell(Vector2i(x, y), 0, Sheet.cell(sprite))
