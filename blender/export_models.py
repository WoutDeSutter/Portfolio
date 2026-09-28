"""
Exports every model collection in festival.blend to public/models/<collection>.glb.

From the command line:
    blender -b blender/festival.blend --python blender/export_models.py

Or inside Blender: open this file in the Scripting workspace and press Run Script.
"""

import os

import bpy

MODELS = ("booth", "stage", "foh", "entrance")


def output_dir() -> str:
    blend_dir = os.path.dirname(bpy.data.filepath) or os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(blend_dir, "..", "public", "models"))


def export_all():
    target = output_dir()
    os.makedirs(target, exist_ok=True)
    view_layer = bpy.context.view_layer
    for name in MODELS:
        collection = bpy.data.collections.get(name)
        if collection is None:
            print(f"Skipping {name}: no collection with that name")
            continue
        for obj in view_layer.objects:
            obj.select_set(False)
        for obj in collection.all_objects:
            obj.select_set(True)
        path = os.path.join(target, f"{name}.glb")
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
        )
        print(f"Exported {path} ({os.path.getsize(path) // 1024} kB)")


if __name__ == "__main__":
    export_all()
