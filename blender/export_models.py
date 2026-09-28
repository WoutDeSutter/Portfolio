"""
Exports every model collection in festival.blend to public/models/<collection>.glb, and every
project item (collection `item_<slug>`) with its animation to public/models/items/<slug>.glb.

From the command line:
    blender -b blender/festival.blend --python blender/export_models.py

Or inside Blender: open this file in the Scripting workspace and press Run Script.
"""

import os

import bpy

MODELS = (
    "booth",
    "booth_projects",
    "booth_lab",
    "booth_merch",
    "booth_contact",
    "booth_links",
    "stage",
    "foh",
    "entrance",
)


def output_dir() -> str:
    blend_dir = os.path.dirname(bpy.data.filepath) or os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(blend_dir, "..", "public", "models"))


def export_collection(collection, path, animated=False):
    view_layer = bpy.context.view_layer
    for obj in view_layer.objects:
        obj.select_set(False)
    for obj in collection.all_objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_extras=False,
        export_cameras=False,
        export_lights=False,
        export_animations=animated,
    )
    print(f"Exported {path} ({os.path.getsize(path) // 1024} kB)")


def export_all():
    target = output_dir()
    os.makedirs(os.path.join(target, "items"), exist_ok=True)
    # Items are exported in their rest pose (frame 1); the animation is stored separately.
    bpy.context.scene.frame_set(1)
    for name in MODELS:
        collection = bpy.data.collections.get(name)
        if collection is None:
            print(f"Skipping {name}: no collection with that name")
            continue
        export_collection(collection, os.path.join(target, f"{name}.glb"))
    for collection in bpy.data.collections:
        if collection.name.startswith("item_"):
            slug = collection.name[len("item_"):]
            export_collection(collection, os.path.join(target, "items", f"{slug}.glb"), animated=True)


if __name__ == "__main__":
    export_all()
