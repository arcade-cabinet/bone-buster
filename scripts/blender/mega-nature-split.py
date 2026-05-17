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
  # OR with explicit source/output:
  /opt/homebrew/bin/blender -b "" --python scripts/blender/mega-nature-split.py -- \
    --source path/to/Mega_Nature.glb --out path/to/output/dir

  Env vars (lower priority than --argv flags):
    MEGA_NATURE_SOURCE  — path to source GLB
    MEGA_NATURE_OUT     — output directory

  Default source resolves relative to the repo root
  (`public/assets/models/props/nature/Mega_Nature.glb`); default
  output is `references/_split/mega-nature/` so the result lives
  alongside other reference work products instead of in /tmp.
"""
import argparse
import os
import re
import sys

import bpy
from mathutils import Vector

# Repo root resolves from this script's location (scripts/blender/<this>).
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_SOURCE = os.path.join(REPO_ROOT, "public/assets/models/props/nature/Mega_Nature.glb")
DEFAULT_OUT = os.path.join(REPO_ROOT, "references/_split/mega-nature")


def parse_args() -> argparse.Namespace:
    """Parse args after the `--` separator that Blender passes through."""
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        default=os.environ.get("MEGA_NATURE_SOURCE", DEFAULT_SOURCE),
        help="Source GLB path (default: %(default)s)",
    )
    parser.add_argument(
        "--out",
        default=os.environ.get("MEGA_NATURE_OUT", DEFAULT_OUT),
        help="Output directory (default: %(default)s)",
    )
    return parser.parse_args(argv)


def slugify(name: str) -> str:
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def world_bbox_center(obj) -> Vector:
    """Compute the world-space bbox center across an object and all its
    descendant meshes. Works for MESH, ARMATURE, and EMPTY roots — the
    plain obj.bound_box is only valid for MESH, and misses transformed
    child geometry, which produces wrong centering for armature-rooted
    plants (the common case in Mega_Nature.glb).
    """
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mins = Vector((float("inf"),) * 3)
    maxs = Vector((float("-inf"),) * 3)
    found = False
    candidates = [obj, *obj.children_recursive]
    for o in candidates:
        if o.type != "MESH":
            continue
        eval_obj = o.evaluated_get(depsgraph)
        mesh = eval_obj.to_mesh()
        try:
            for v in mesh.vertices:
                world = eval_obj.matrix_world @ v.co
                mins.x = min(mins.x, world.x)
                mins.y = min(mins.y, world.y)
                mins.z = min(mins.z, world.z)
                maxs.x = max(maxs.x, world.x)
                maxs.y = max(maxs.y, world.y)
                maxs.z = max(maxs.z, world.z)
                found = True
        finally:
            eval_obj.to_mesh_clear()
    if not found:
        return obj.matrix_world.translation.copy()
    return (mins + maxs) * 0.5


def export_one(obj, out_dir: str):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    for child in obj.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = obj

    original_loc = obj.location.copy()
    bbox_center = world_bbox_center(obj)
    obj.location = obj.location - bbox_center

    slug = slugify(obj.name)
    path = os.path.join(out_dir, f"{slug}.glb")
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
    args = parse_args()
    source = os.path.expanduser(args.source)
    out_dir = os.path.expanduser(args.out)
    os.makedirs(out_dir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)

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
        export_one(o, out_dir)


main()
