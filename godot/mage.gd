extends Sprite2D
## The mage. It walks the way the stick points (or the keys, for testing), faces the
## way it walks, and can't go into what the lot keeps it out of or off the lot.
## Its position is the top-left corner of its sprite, in the lot's pixels.
## It also holds the mana, which comes back by itself, and the seeds and crops it carries.

const SPEED := 96.0  # pixels a second, which is 3 tiles
const BODY := Rect2(6, 6, 20, 20)  # the box that bumps into things, in the middle of the sprite
const HOP := 8.0  # it moves in hops no longer than this, so a slow frame can't jump over a tile
const EVEN := 0.001  # a slant this close to even counts as even; a thumb's place is never exact
const MANA_MAX := 100.0
const MANA_BACK := 6.5  # mana that comes back each second
const SPRITES := {Vector2i.DOWN: "mage_down", Vector2i.UP: "mage_up", Vector2i.LEFT: "mage_left", Vector2i.RIGHT: "mage_right"}

var mana := MANA_MAX
var seeds := 8
var crops := 0
var facing := Vector2i.DOWN  # the way the mage faces, as one step on the lot's tiles

@onready var lot = get_parent()
@onready var stick = %Stick


func _ready() -> void:
	texture = Sheet.texture
	_face(Vector2.DOWN)


func _process(delta: float) -> void:
	mana = minf(mana + MANA_BACK * delta, MANA_MAX)
	var way: Vector2 = stick.way()
	if way == Vector2.ZERO:
		way = _keys()
	if way == Vector2.ZERO:
		return
	_face(way)
	# Across first, then down. When one is stopped the other still goes, so the mage slides along things.
	var step := way * SPEED * delta
	_walk(0, step.x)
	_walk(1, step.y)


## The mage's tile: the tile under the middle of its sprite.
func tile() -> Vector2i:
	return Vector2i((position / Sheet.tile + Vector2(0.5, 0.5)).floor())


## The way the arrow keys or W, A, S and D point, one pixel long, or nothing.
func _keys() -> Vector2:
	var left := Input.is_key_pressed(KEY_LEFT) or Input.is_key_pressed(KEY_A)
	var right := Input.is_key_pressed(KEY_RIGHT) or Input.is_key_pressed(KEY_D)
	var up := Input.is_key_pressed(KEY_UP) or Input.is_key_pressed(KEY_W)
	var down := Input.is_key_pressed(KEY_DOWN) or Input.is_key_pressed(KEY_S)
	return Vector2(int(right) - int(left), int(down) - int(up)).normalized()


## Turns the mage to face the way it walks. At a slant the bigger part wins, and an even slant is left or right.
func _face(way: Vector2) -> void:
	if absf(way.x) + EVEN >= absf(way.y):
		facing = Vector2i.RIGHT if way.x > 0.0 else Vector2i.LEFT
	else:
		facing = Vector2i.DOWN if way.y > 0.0 else Vector2i.UP
	region_rect = Sheet.region(SPRITES[facing])


## Walks a distance along one axis (0 is across, 1 is down), stopping flush against
## the lot's edge or a tile it can't cross.
func _walk(axis: int, dist: float) -> void:
	var tile := float(Sheet.tile)
	while dist != 0.0:
		var hop := clampf(dist, -HOP, HOP)
		dist -= hop
		var to := position
		to[axis] = clampf(to[axis] + hop, 0.0, lot.size[axis] - tile)  # the whole sprite stays on the lot
		var box := Rect2(to + BODY.position, BODY.size)
		if lot.blocks(box):
			# Back to the line between tiles that the front of the box just crossed.
			if hop > 0.0:
				to[axis] = floorf(box.end[axis] / tile) * tile - BODY.end[axis]
			else:
				to[axis] = ceilf(box.position[axis] / tile) * tile - BODY.position[axis]
			dist = 0.0
		position = to
