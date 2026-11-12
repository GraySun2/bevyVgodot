class_name Hint
extends Sprite2D
## The six things a new player does once, on the lot, in this order, and the hint in the top
## strip for the first of them not done yet. The lot says when one is done; what is done in the
## dungeon doesn't count. A thing done early counts too, so the hint can skip ahead. Once
## there has been a sale, no hint shows ever again.

const CLEARED := 1  # a Gust that cleared a tile
const SOIL := 2  # a Break Ground that made soil
const PLANTED := 3  # a Sprout that planted a seed
const WATERED := 4  # a Draw that watered a seed
const PICKED := 5  # a ripe crop picked
const SOLD := 6  # a sale at the crate

var done := [false, false, false, false, false, false]  # one for each thing, CLEARED first


func _ready() -> void:
	texture = Sheet.controls
	_show()


## The player has done this thing (one of the numbers above).
func did(thing: int) -> void:
	done[thing - 1] = true
	_show()


## Shows the hint ("hint_1" to "hint_6") for the first thing not done yet, or none after a sale.
func _show() -> void:
	visible = not done[SOLD - 1]
	if visible:
		region_rect = Sheet.piece("hint_%d" % (done.find(false) + 1))


## What a saved game keeps: which of the six are done.
func state() -> Array:
	return done.duplicate()


## Puts back what a saved game kept. A game saved before there were six things has none done.
func restore(saved) -> void:
	if saved is Array and saved.size() == done.size():
		for i in done.size():
			done[i] = saved[i] == true
	_show()
