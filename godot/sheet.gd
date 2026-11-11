extends Node
## The shared sprite sheet, loaded once and reached from anywhere as "Sheet".
## sprites.json says where each named sprite is on sprites.png.

const DIR := "res://shared/"  # build.sh copies ../shared here

var tile: int  # the side of one tile, in pixels
var texture: Texture2D
var tile_set := TileSet.new()  # for TileMapLayers; the sheet is its source 0
var _cells := {}  # sprite name -> its column and row on the sheet


func _ready() -> void:
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(DIR + "sprites.json"))
	tile = int(data.tile)
	texture = load(DIR + data.image)

	var source := TileSetAtlasSource.new()
	source.texture = texture
	source.texture_region_size = Vector2i(tile, tile)
	for sprite: String in data.sprites:
		var at: Dictionary = data.sprites[sprite]
		var c := Vector2i(int(at.x), int(at.y)) / tile
		source.create_tile(c)
		_cells[sprite] = c
	tile_set.tile_size = Vector2i(tile, tile)
	tile_set.add_source(source, 0)


## Where a sprite is on the sheet, as a TileMapLayer wants it.
func cell(sprite: String) -> Vector2i:
	return _cells[sprite]


## Where a sprite is on the sheet in pixels, as a Sprite2D's region wants it.
func region(sprite: String) -> Rect2:
	return Rect2(_cells[sprite] * tile, Vector2(tile, tile))
