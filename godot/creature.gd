class_name Creature
extends Sprite2D
## One creature on the dungeon floor. Creatures moves it; this holds what one creature has.
## Its position is the top-left corner of its sprite, in the places' pixels, as the mage's is.

var start: Vector2i  # the tile it starts on, and goes back to after a touch
var nerve := 3  # at 0 it is gone
var slow_left := 0.0  # seconds it still walks at half speed, after a Draw


func _init(at: Vector2i, nerve_at_start: int) -> void:
	start = at
	nerve = nerve_at_start
	position = at * Sheet.tile
	texture = Sheet.texture
	region_enabled = true
	region_filter_clip_enabled = true
	region_rect = Sheet.region("creature")
	centered = false


## The creature's tile: the tile under the middle of its sprite.
func tile() -> Vector2i:
	return Vector2i((position / Sheet.tile + Vector2(0.5, 0.5)).floor())


## The box that bumps into things, the same size as the mage's, in the places' pixels.
func box() -> Rect2:
	return Place.body(position)
