class_name Place
extends Node2D
## One place the mage can be in: the lot, or the dungeon floor under it. Each is drawn from
## its own JSON file the same way: the ground of every tile, then the things on the tiles,
## on two layers. Places sits them all in the same spot, and shows one at a time.
## The mage, the aim mark and the spells use whichever place shows, through the same few
## things: its size, which tiles it has and which ones block the mage, its stairs, what
## each spell does on a tile, what a touch on a tile does, and what stepping onto a tile does.
## Here each of those does nothing; the lot and the dungeon say what they do.

const BODY := Rect2(6, 6, 20, 20)  # the box that bumps into things, in the middle of a sprite (the mage's, a creature's)
const HOP := 8.0  # a move goes in hops no longer than this, so a slow frame or a throw can't jump over a tile

var size: Vector2  # the place's size, in pixels
var tiles: Vector2i  # the place's size, in tiles
var stairs: Vector2i  # the tile of the stairs to the other place
var _solid: Array  # where the sprites the mage can't cross are on the sheet

@onready var ground: TileMapLayer = $Ground
@onready var things: TileMapLayer = $Things
@onready var mage = %Mage


## Puts every tile down as the place's JSON file has it. Also takes the names of the
## sprites the mage can't cross, and of the sprite of the stairs.
func lay(data: Dictionary, solid: Array, stairs_sprite: String) -> void:
	ground.clear()
	things.clear()
	_fill(ground, data.ground, data.ground_legend)
	_fill(things, data.things, data.things_legend)
	tiles = Vector2i(data.width, data.height)
	size = tiles * Sheet.tile
	_solid = solid.map(Sheet.cell)
	stairs = _find(stairs_sprite)


## Whether a box, in the place's pixels, reaches into a tile the mage can't cross.
func blocks(box: Rect2) -> bool:
	return reaches(box, _solid)


## Whether a box reaches into a tile with one of these sprites (sheet cells) on it.
## It asks the layers what is on each tile now, so it stays right when tiles change.
func reaches(box: Rect2, cells: Array) -> bool:
	var tile := float(Sheet.tile)
	for y in range(floori(box.position.y / tile), ceili(box.end.y / tile)):
		for x in range(floori(box.position.x / tile), ceili(box.end.x / tile)):
			var at := Vector2i(x, y)
			if ground.get_cell_atlas_coords(at) in cells or things.get_cell_atlas_coords(at) in cells:
				return true
	return false


## The box of a sprite whose top-left corner is here.
static func body(at: Vector2) -> Rect2:
	return Rect2(at + BODY.position, BODY.size)


## Where a sprite whose top-left corner is at `from` gets to, going `dist` pixels along one axis
## (0 is across, 1 is down): in hops, stopping flush against the place's edge or a tile that
## `blocked` (a function of a box) says its box can't go into. Moved across and then down this
## way, a sprite stopped one way still goes the other, so it slides along what stops it.
func slide(from: Vector2, axis: int, dist: float, blocked: Callable) -> Vector2:
	var tile := float(Sheet.tile)
	var to := from
	while dist != 0.0:
		var hop := clampf(dist, -HOP, HOP)
		dist -= hop
		to[axis] = clampf(to[axis] + hop, 0.0, size[axis] - tile)  # the whole sprite stays on the place
		var box := body(to)
		if blocked.call(box):
			# Back to the line between tiles that the front of the box just crossed.
			if hop > 0.0:
				to[axis] = floorf(box.end[axis] / tile) * tile - BODY.end[axis]
			else:
				to[axis] = ceilf(box.position[axis] / tile) * tile - BODY.position[axis]
			dist = 0.0
	return to


## Whether a tile is in the place.
func has_tile(at: Vector2i) -> bool:
	return Rect2i(Vector2i.ZERO, tiles).has_point(at)


## The four spells. A spell's button calls the function with the spell's name on the aimed
## tile; it does the spell's work there and says whether anything changed.
func gust(_at: Vector2i) -> bool:
	return false


func break_ground(_at: Vector2i) -> bool:
	return false


func sprout(_at: Vector2i) -> bool:
	return false


func draw(_at: Vector2i) -> bool:
	return false


## A touch on a tile in reach, which the aim mark has just moved to.
func touched(_at: Vector2i) -> void:
	pass


## The mage's tile has just become this tile, by walking (the stairs are Places' job).
func stepped(_at: Vector2i) -> void:
	pass


## Puts one layer's tiles down. Each row is a line of letters; the legend names each letter's sprite.
func _fill(layer: TileMapLayer, rows: Array, legend: Dictionary) -> void:
	layer.tile_set = Sheet.tile_set
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			var sprite = legend.get(row[x])  # null where there is nothing
			if sprite != null:
				layer.set_cell(Vector2i(x, y), 0, Sheet.cell(sprite))


## The first tile with this sprite on it, on either layer.
func _find(sprite: String) -> Vector2i:
	for y in tiles.y:
		for x in tiles.x:
			var at := Vector2i(x, y)
			if Sheet.cell(sprite) in [ground.get_cell_atlas_coords(at), things.get_cell_atlas_coords(at)]:
				return at
	return Vector2i(-1, -1)
