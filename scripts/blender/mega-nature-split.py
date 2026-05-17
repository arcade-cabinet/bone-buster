"""
PT2 prerequisite — split Mega_Nature.glb into per-plant GLBs.

The bundled GLB is a scene-aggregate of N nature meshes laid out
side-by-side. NatureField currently clones the full pack at every
NatureInstance position (wasteful + visually piles the whole pack
into each spawn slot). Scene-splitting produces one GLB per plant
silhouette so NatureField can pick a single plant per instance
(and migrate to InstancedMultiGltfField in the PT2 code slice
that follows).

Usage:
  /opt/homebrew/bin/blender -b "" --python scripts/blender/mega-nature-split.py

Loads Mega_Nature.glb from public/assets/models/props/nature/ and
writes per-plant GLBs to /tmp/mega-nature/split/.
"""
import bpy
import os
import re
from mathutils import Vector

SOURCE = "/Users/jbogaty/src/objexiv/objexoom/public/assets/models/props/nature/Mega_Nature.glb"
OUT_DIR = "/tmp/mega-nature/split"
os.makedirs(OUT_DIR, exist_ok=True)


def slugify(name: str) -> str:
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def export_one(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    for child in obj.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = obj

    original_loc = obj.location.copy()

    bbox_corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    bbox_center = sum(bbox_corners, Vector()) / 8.0
    delta = -bbox_center
    obj.location = obj.location + delta

    slug = slugify(obj.name)
    path = os.path.join(OUT_DIR, f"{slug}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        use_selection=True,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )
    print(f"EXPORTED: {slug}.glb")

    obj.location = original_loc


def main():
    # Start from a blank scene.
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Import the bundled GLB.
    bpy.ops.import_scene.gltf(filepath=SOURCE)

    top_level = [
        o
        for o in bpy.context.scene.objects
        if o.parent is None and o.type in ("MESH", "ARMATURE", "EMPTY")
    ]
    print(f"Found {len(top_level)} top-level objects to consider:")
    for o in top_level:
        print(f"  - {o.name} ({o.type})")

    for o in top_level:
        if o.type == "EMPTY" and not o.children:
            continue
        export_one(o)


main()
