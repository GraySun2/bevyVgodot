extends Node2D
## The creatures on the dungeon floor. Each trip down, Dungeon calls reset() with the starting
## tiles from dungeon.json, and the four of them stand on the middle of those tiles, each with
## its full nerve. In the scene this node comes after the aim mark and before the mage, so
## creatures are drawn over the floor and the mark and under the mage. Places shows it and lets
## it run only while the dungeon shows and no trip is going on; the pause and the panels stop
## it as they stop everything else, so then nothing moves and no slow seconds run.
##
## A creature whose tile is no more than NEAR tiles across and NEAR up or down from the mage's
## tile walks straight toward the middle of the mage. It slides along what it can't cross
## (Dungeon.creature_blocks) the way the mage does, and passes through other creatures.
## When its box overlaps the mage's box, that is a touch: the mage loses half its mana and is
## put on the stairs, and every creature still on the floor goes back to its starting tile.
## Gust and Draw on a creature's tile take nerve from every creature there; at 0 it is gone.

const NERVE := 3  # each creature's nerve at the start
const NEAR := 4  # tiles across, and tiles up or down, within which a creature comes for the mage
const SPEED := 57.6  # pixels a second
const SLOW_SPEED := 28.8  # pixels a second, for SLOW_FOR seconds after a Draw
const SLOW_FOR := 2.0  # seconds
const THROW := 64.0  # pixels a Gust throws a creature

@onready var dungeon = %Dungeon
@onready var mage = %Mage


## A creature on the middle of each of these tiles ({x, y}, as dungeon.json has them), with
## full nerve, and no others.
func reset(starts: Array) -> void:
	for c: Node in get_children():
		remove_child(c)
		c.queue_free()
	for at: Dictionary in starts:
		add_child(Creature.new(Vector2i(int(at.x), int(at.y)), NERVE))


func _process(delta: float) -> void:
	var to_mage: Vector2i = mage.tile()
	for c: Creature in get_children():
		var slow := minf(c.slow_left, delta)  # the part of this frame it still walks at half speed
		c.slow_left -= slow
		var from := c.tile()
		if absi(to_mage.x - from.x) > NEAR or absi(to_mage.y - from.y) > NEAR:
			continue
		var way: Vector2 = mage.position - c.position  # from the middle of the creature to the middle of the mage
		var step := minf(SLOW_SPEED * slow + SPEED * (delta - slow), way.length())
		var move := way.normalized() * step
		# Across first, then down, so a creature stopped one way still goes the other.
		c.position = dungeon.slide(c.position, 0, move.x, dungeon.creature_blocks)
		c.position = dungeon.slide(c.position, 1, move.y, dungeon.creature_blocks)
	for c: Creature in get_children():
		if c.box().intersects(mage.box()):
			_touch()
			return


## Gust on a tile: every creature on it loses 1 nerve and is thrown straight away from the
## mage. Says whether there was any.
func gust(at: Vector2i) -> bool:
	var hit := _on(at)
	var away := _away(at) * THROW
	for c in hit:
		if _hurt(c):
			c.position = dungeon.slide(c.position, 0, away.x, dungeon.creature_blocks)
			c.position = dungeon.slide(c.position, 1, away.y, dungeon.creature_blocks)
	return not hit.is_empty()


## Draw on a tile: every creature on it loses 1 nerve and walks at half speed for a while.
## Says whether there was any.
func draw(at: Vector2i) -> bool:
	var hit := _on(at)
	for c in hit:
		if _hurt(c):
			c.slow_left = SLOW_FOR
	return not hit.is_empty()


## The creatures whose tile is this tile.
func _on(at: Vector2i) -> Array[Creature]:
	var hit: Array[Creature] = []
	for c: Creature in get_children():
		if c.tile() == at:
			hit.append(c)
	return hit


## Takes 1 nerve. At 0 the creature is gone at once; says whether it is still there.
func _hurt(c: Creature) -> bool:
	c.nerve -= 1
	if c.nerve > 0:
		return true
	remove_child(c)
	c.queue_free()
	return false


## The way a Gust on this tile throws: the way the tile lies from the mage's tile, along the
## bigger part of a slant, and left or right for an even one. The mage's own tile: the way it faces.
func _away(at: Vector2i) -> Vector2:
	var d: Vector2i = at - mage.tile()
	if d == Vector2i.ZERO:
		return Vector2(mage.facing)
	if absi(d.x) >= absi(d.y):
		return Vector2(signi(d.x), 0)
	return Vector2(0, signi(d.y))


## A creature touched the mage.
func _touch() -> void:
	mage.mana *= 0.5
	mage.put(dungeon.stairs)  # put there, not stepped onto, so it stays below
	Sounds.play("no")
	for c: Creature in get_children():
		c.position = c.start * Sheet.tile
