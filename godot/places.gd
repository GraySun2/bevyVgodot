extends Node2D
## The two places, the lot and the dungeon floor under it, one showing at a time, then the
## aim mark, the dungeon's creatures, and the mage, which is in whichever place shows.
## Everything here is in the places' own pixels, which start at the top-left corner of the place.
## When the mage's tile becomes the stairs of the place it is in, by walking onto them from
## another tile, the mage goes to the other place: onto the middle of that place's stairs,
## facing down. The trip takes half a second. The place darkens evenly to the dark over the
## first half, then the other place comes out of the dark over the second. Meanwhile nothing
## moves or changes: the mage, the aim mark, the creatures and both places are switched off (so the mana
## and the lot's clock stand still), and no spell can be cast. The place that doesn't show
## stays switched off, so the lot waits while the mage is below. The creatures show and run
## only while the dungeon shows.
## A trip is timed with this node's own frame time, so the pause and the skills panel hold
## it where it is, as they hold everything else.

const TRIP := 0.5  # seconds: darkening for the first half, coming out of the dark for the second

var here: Place  # the place that shows, which the mage is in
var fading := false  # whether a trip is going on
var _to: Place  # where the trip goes
var _time := 0.0  # how far the trip has gone, in seconds

@onready var lot: Place = $Lot
@onready var dungeon: Place = $Dungeon
@onready var aim = $Aim
@onready var creatures = $Creatures
@onready var mage = $Mage
@onready var dark: ColorRect = $Dark


func _ready() -> void:
	here = lot
	dungeon.visible = false
	for node: CanvasItem in [dungeon, creatures]:
		node.visible = false
		node.process_mode = PROCESS_MODE_DISABLED
	dark.visible = false
	mage.stepped.connect(_stepped)


func _process(delta: float) -> void:
	if not fading:
		return
	_time += delta
	if _to != here and _time >= TRIP / 2.0:
		_arrive()
	if _time >= TRIP:
		fading = false
		dark.visible = false
		for node: Node in _moving():
			node.process_mode = PROCESS_MODE_INHERIT
	else:
		dark.color.a = clampf(1.0 - absf(_time - TRIP / 2.0) / (TRIP / 2.0), 0.0, 1.0)


## The mage's tile has just become this tile, by walking.
func _stepped(at: Vector2i) -> void:
	if at == here.stairs:
		_go(dungeon if here == lot else lot)
	else:
		here.stepped(at)


## Starts a trip to the other place.
func _go(to: Place) -> void:
	aim.put_mark()  # the mark stands still in front of the mage on the stairs
	for node: Node in _moving():
		node.process_mode = PROCESS_MODE_DISABLED
	_to = to
	_time = 0.0
	fading = true
	dark.color.a = 0.0
	dark.visible = true


## Halfway through a trip, in the dark: the other place shows, with the mage on its stairs.
## A trip down finds the dungeon as dungeon.json has it.
func _arrive() -> void:
	here.visible = false
	here = _to
	if here == dungeon:
		dungeon.reset()
	here.visible = true
	creatures.visible = here == dungeon
	mage.put(here.stairs)
	aim.put_mark()


## What runs in the place that shows: the place, the aim mark and the mage, and below, the creatures.
func _moving() -> Array:
	return [here, aim, mage, creatures] if here == dungeon else [here, aim, mage]
