extends Sprite2D
## Shows one piece from controls.png that never changes, named in the scene.

@export var piece := ""


func _ready() -> void:
	texture = Sheet.controls
	region_rect = Sheet.piece(piece)
