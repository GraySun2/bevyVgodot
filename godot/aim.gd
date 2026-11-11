extends Sprite2D
## The mark on the aimed tile, which is the tile a spell lands on, in the place that shows.
## The aimed tile is the next tile from the mage's tile, the way the mage faces.
## A touch that starts on a tile of the place, no more than REACH tiles from the mage's
## tile, aims there instead, until the mage's tile changes or the mage turns. That touch
## also does what the place does with a touch: on the lot, it picks a ripe crop on the
## tile, or sells at the crate.
## In the scene this node comes before the mage, so it is drawn under it, and it is
## set to run after the mage each frame, so the mark never lags a frame behind.

const NONE := Vector2i(-1, -1)  # what tile() says when no tile is aimed
const REACH := 2  # how many tiles away a touch can aim, across and up or down

var _picked := NONE  # the tile a touch picked, while it holds
var _picked_from := NONE  # the mage's tile when it was picked
var _picked_facing := Vector2i.ZERO  # and the way the mage faced

@onready var places = get_parent()
@onready var mage = %Mage


func _ready() -> void:
	texture = Sheet.controls
	region_rect = Sheet.piece("aim")


func _process(_delta: float) -> void:
	put_mark()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		var place: Place = places.here
		var at := Vector2i((place.make_input_local(event).position / Sheet.tile).floor())
		var from: Vector2i = mage.tile()
		if place.has_tile(at) and absi(at.x - from.x) <= REACH and absi(at.y - from.y) <= REACH:
			_picked = at
			_picked_from = from
			_picked_facing = mage.facing
			put_mark()
			place.touched(at)  # on the lot a ripe crop there is picked as well, and at the crate the crops are sold
			get_viewport().set_input_as_handled()


## The aimed tile, or NONE when the tile in front would be off the place.
func tile() -> Vector2i:
	if _picked != NONE and (mage.tile() != _picked_from or mage.facing != _picked_facing):
		_picked = NONE
	if _picked != NONE:
		return _picked
	var front: Vector2i = mage.tile() + mage.facing
	return front if places.here.has_tile(front) else NONE


## Puts the mark on the aimed tile, or hides it when there is none.
func put_mark() -> void:
	var at := tile()
	visible = at != NONE
	position = at * Sheet.tile
