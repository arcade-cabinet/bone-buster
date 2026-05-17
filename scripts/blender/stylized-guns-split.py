"""
Scene-split the Stylized Guns PRO .blend file: export each top-level
mesh object as its own .glb under /tmp/stylized-guns/split/.

The .blend ships all gun models laid out side-by-side in one scene.
Each gun is its own top-level Object with hierarchical mesh data.
We iterate mesh objects, select them in isolation, recenter at world
origin, and export via gltf2.
"""
import bpy
import os
import re
from mathutils import Vector

OUT_DIR = "/tmp/stylized-guns/split"
os.makedirs(OUT_DIR, exist_ok=True)


def slugify(name: str) -> str:
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def export_one(obj):
    """Isolate `obj` (+ children), recenter, export GLB, restore."""
    # Deselect everything.
    bpy.ops.object.select_all(action="DESELECT")
    # Select obj + its hierarchy.
    obj.select_set(True)
    for child in obj.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = obj

    # Snapshot original location so we restore after export.
    original_loc = obj.location.copy()

    # Recenter at world origin so each exported GLB sits at (0,0,0).
    # Use bounding box center, not just transform origin.
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

    # Restore.
    obj.location = original_loc


def main():
    # Walk all MESH objects that are TOP-LEVEL (no parent or top of a
    # hierarchy). For nested rigs, just use root-level mesh-or-armature.
    top_level = [
        o
        for o in bpy.context.scene.objects
        if o.parent is None and o.type in ("MESH", "ARMATURE", "EMPTY")
    ]
    print(f"Found {len(top_level)} top-level objects to consider:")
    for o in top_level:
        print(f"  - {o.name} ({o.type})")

    for o in top_level:
        # Skip cameras, lights, empties that aren't gun roots.
        if o.type == "EMPTY" and not o.children:
            continue
        export_one(o)


main()
