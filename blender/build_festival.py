"""
Builds the low-poly festival models from scratch and saves them to blender/festival.blend,
then exports them to public/models/ (via export_models.py).

    blender -b --python blender/build_festival.py            # only if festival.blend doesn't exist yet
    blender -b --python blender/build_festival.py -- --force # overwrite festival.blend (loses manual edits!)

After the first build, edit festival.blend in Blender and export with export_models.py instead.

Conventions (match src/world/greybox.ts, which keeps signs, click areas and focus points):
- One collection per model: booth, stage, foh, entrance. Each model sits at the world origin.
- Measurements below are written in three.js space (x right, y up, z towards the visitor) and
  converted to Blender's z-up space, so the numbers can be compared with greybox.ts directly.
  In Blender the front of every model therefore faces -Y.
- Signs (canvas text) are added by the site; the models only contain their frames.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(HERE, "festival.blend")

# three.js space → Blender space: (x, y, z) → (x, -z, y)
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
C_INV = C.inverted()


def to_blender(m3: Matrix) -> Matrix:
    return C @ m3 @ C_INV


def trs(loc, rot=(0, 0, 0), scale=(1, 1, 1)) -> Matrix:
    return (
        Matrix.Translation(Vector(loc))
        @ Euler(rot, "XYZ").to_matrix().to_4x4()
        @ Matrix.Diagonal(Vector((*scale, 1)))
    )


# --- Materials -------------------------------------------------------------------------------

MATERIALS = {
    # name: (base colour (linear), roughness, metallic, emission colour, emission strength)
    "wood": ((0.23, 0.14, 0.08), 0.85, 0.0, None, 0),
    "container": ((0.07, 0.075, 0.08), 0.55, 0.35, None, 0),
    "steel": ((0.16, 0.165, 0.17), 0.5, 0.8, None, 0),
    "wood_dark": ((0.10, 0.065, 0.04), 0.9, 0.0, None, 0),
    "metal": ((0.40, 0.41, 0.43), 0.45, 0.85, None, 0),
    "black": ((0.025, 0.025, 0.028), 0.7, 0.0, None, 0),
    "fabric": ((0.055, 0.055, 0.06), 1.0, 0.0, None, 0),
    "deck": ((0.09, 0.09, 0.095), 0.8, 0.0, None, 0),
    "accent": ((0.45, 0.02, 0.02), 0.8, 0.0, None, 0),
    "bulb": ((1.0, 0.8, 0.55), 0.5, 0.0, (1.0, 0.72, 0.42), 6.0),
    "lens": ((0.8, 0.05, 0.05), 0.3, 0.0, (1.0, 0.08, 0.06), 3.0),
    "screen": ((0.02, 0.02, 0.025), 0.3, 0.0, (0.2, 0.24, 0.34), 0.35),
}


def get_material(name: str) -> bpy.types.Material:
    material = bpy.data.materials.get(name)
    if material:
        return material
    color, roughness, metallic, emission, strength = MATERIALS[name]
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    material.diffuse_color = (*color, 1)
    return material


# --- Mesh building ---------------------------------------------------------------------------


class Part:
    """One Blender object, built with bmesh from primitives placed in three.js space."""

    def __init__(self, name: str, collection: bpy.types.Collection):
        self.name = name
        self.collection = collection
        self.bm = bmesh.new()
        self.materials: list[str] = []

    def _index(self, material: str) -> int:
        if material not in self.materials:
            self.materials.append(material)
        return self.materials.index(material)

    def _add(self, create, material: str, bevel: float = 0.0):
        """Builds one primitive in its own bmesh (so bevelling can't touch other pieces) and appends it."""
        piece = bmesh.new()
        verts = create(piece)["verts"]
        if bevel > 0:
            edges = list({e for v in verts for e in v.link_edges})
            bmesh.ops.bevel(piece, geom=list(verts) + edges, offset=bevel, segments=1, affect="EDGES", profile=0.5)
        index = self._index(material)
        for face in piece.faces:
            face.material_index = index
            face.smooth = False
        mesh = bpy.data.meshes.new("tmp")
        piece.to_mesh(mesh)
        piece.free()
        self.bm.from_mesh(mesh)
        bpy.data.meshes.remove(mesh)

    def box(self, w, h, d, x=0, y=0, z=0, material="wood", rot=(0, 0, 0), bevel=0.0, centered=False):
        """Box of w×h×d. By default (x, y, z) is the centre of its base, like standing on the ground."""
        cy = y if centered else y + h / 2
        m = to_blender(trs((x, cy, z), rot, (w, h, d)))
        self._add(lambda bm: bmesh.ops.create_cube(bm, size=1, matrix=m), material, bevel)

    def cylinder(self, radius, h, x=0, y=0, z=0, material="metal", segments=8, rot=(0, 0, 0), radius_top=None, centered=False):
        cy = y if centered else y + h / 2
        m = to_blender(trs((x, cy, z), rot))
        top = radius if radius_top is None else radius_top
        self._add(
            lambda bm: bmesh.ops.create_cone(
                bm, cap_ends=True, segments=segments, radius1=radius, radius2=top, depth=h, matrix=m
            ),
            material,
        )

    def sphere(self, radius, x, y, z, material="bulb", subdivisions=1):
        m = to_blender(trs((x, y, z)))
        self._add(lambda bm: bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius, matrix=m), material)

    def beam(self, a, b, thickness, material="metal", round_=False, segments=6, caps=True):
        """A bar from point a to point b (three.js space). Round bars can skip their end caps
        (invisible on thin truss tubes) to keep the file small."""
        a, b = Vector(a), Vector(b)
        direction = b - a
        rotation = Vector((0, 1, 0)).rotation_difference(direction.normalized()).to_matrix().to_4x4()
        m3 = Matrix.Translation((a + b) / 2) @ rotation
        if round_:
            m = to_blender(m3)
            r, length = thickness / 2, direction.length
            self._add(
                lambda bm: bmesh.ops.create_cone(bm, cap_ends=caps, segments=segments, radius1=r, radius2=r, depth=length, matrix=m),
                material,
            )
        else:
            m = to_blender(m3 @ Matrix.Diagonal(Vector((thickness, direction.length, thickness, 1))))
            self._add(lambda bm: bmesh.ops.create_cube(bm, size=1, matrix=m), material)

    def build(self) -> bpy.types.Object:
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for material in self.materials:
            mesh.materials.append(get_material(material))
        obj = bpy.data.objects.new(self.name, mesh)
        self.collection.objects.link(obj)
        return obj


def truss(part: Part, start, axis: str, length: float, size=0.4, bay=0.6):
    """Box truss (four round chords + zigzag diagonals) from `start` along an axis, with an end
    plate at both ends like the connection flanges of real truss."""
    axes = {"x": 0, "y": 1, "z": 2}
    along = axes[axis]
    across = [i for i in range(3) if i != along]
    half = size / 2
    corners = [(-half, -half), (half, -half), (half, half), (-half, half)]

    def point(corner, t):
        p = list(start)
        p[along] += t
        p[across[0]] += corner[0]
        p[across[1]] += corner[1]
        return p

    for corner in corners:
        part.beam(point(corner, 0), point(corner, length), 0.06, "metal", round_=True, segments=8)
    bays = max(1, round(length / bay))
    step = length / bays
    for face in range(4):
        c1, c2 = corners[face], corners[(face + 1) % 4]
        for i in range(bays):
            a, b = (c1, c2) if i % 2 == 0 else (c2, c1)
            part.beam(point(a, i * step), point(b, (i + 1) * step), 0.03, "metal", round_=True, segments=3, caps=False)
    plate = [size + 0.06] * 3
    plate[along] = 0.03
    for t in (0.015, length - 0.015):
        centre = list(start)
        centre[along] += t
        part.box(plate[0], plate[1], plate[2], *centre, "metal", centered=True)


def truss_node(part: Part, centre, size=0.4):
    """Corner block where truss pieces meet (real truss systems use a cube connector here)."""
    edge = size + 0.1
    part.box(edge, edge, edge, *centre, "steel", centered=True, bevel=0.015)


def truss_span(part: Part, a, b, axis: str, size=0.4):
    """Truss between two corner blocks, stopping at their faces instead of running through them."""
    along = {"x": 0, "y": 1, "z": 2}[axis]
    gap = (size + 0.1) / 2
    start = list(a)
    start[along] += gap
    truss(part, start, axis, b[along] - a[along] - 2 * gap, size)


def new_collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


# --- Models ----------------------------------------------------------------------------------


def build_booth():
    """Pop-up container bar, 4.2 x 2.6 x 2.44 m, with the front wall hinged up as an awning.
    Sign (3.2 x 0.8) is added by the site on the roof at y 3.75, z 0.7."""
    col = new_collection("booth")
    W, H, D = 4.2, 2.6, 2.44
    base = 0.12  # the container stands on four feet
    top = base + H
    front, back = D / 2, -D / 2

    shell = Part("booth_container", col)
    for x in (-W / 2 + 0.2, W / 2 - 0.2):
        for z in (back + 0.2, front - 0.2):
            shell.box(0.3, base, 0.3, x, 0, z, "black")
    # Frame: corner posts, top and bottom rails, corner castings
    for x in (-W / 2 + 0.08, W / 2 - 0.08):
        for z in (back + 0.08, front - 0.08):
            shell.box(0.16, H, 0.16, x, base, z, "container", bevel=0.01)
            for y in (base, top - 0.18):
                shell.box(0.2, 0.18, 0.2, x, y, z, "steel", bevel=0.01)
    for y in (base, top - 0.14):
        for z in (back + 0.07, front - 0.07):
            shell.box(W - 0.4, 0.14, 0.14, 0, y, z, "container")
        for x in (-W / 2 + 0.07, W / 2 - 0.07):
            shell.box(0.14, 0.14, D - 0.4, x, y, 0, "container")
    shell.box(W - 0.1, 0.05, D - 0.1, 0, top - 0.06, 0, "container")  # roof
    shell.box(W - 0.2, 0.04, D - 0.2, 0, base + 0.1, 0, "wood_dark")  # floor

    # Corrugated walls: a flat panel with vertical ribs on the outside
    def ribbed_wall(x0, x1, z, y0, y1, outward):
        shell.box(abs(x1 - x0), y1 - y0, 0.04, (x0 + x1) / 2, y0, z, "container")
        count = int(abs(x1 - x0) / 0.3)
        for i in range(count):
            x = x0 + (i + 0.5) * (x1 - x0) / count
            shell.box(0.13, y1 - y0, 0.05, x, y0, z + outward * 0.04, "container")

    ribbed_wall(-W / 2 + 0.16, W / 2 - 0.16, back + 0.08, base + 0.14, top - 0.14, -1)
    ribbed_wall(-W / 2 + 0.16, W / 2 - 0.16, front - 0.08, base + 0.14, 1.0, 1)  # counter front

    for side in (-1, 1):
        x = side * (W / 2 - 0.08)
        shell.box(0.04, H - 0.28, D - 0.32, x, base + 0.14, 0, "container")
        for i in range(7):
            z = back + 0.3 + i * (D - 0.6) / 6
            shell.box(0.05, H - 0.28, 0.13, x + side * 0.04, base + 0.14, z, "container")
    # Cargo doors on the right end: four lock bars
    for z in (-0.75, -0.3, 0.3, 0.75):
        shell.beam((W / 2 + 0.1, base + 0.3, z), (W / 2 + 0.1, top - 0.3, z), 0.04, "steel", round_=True)
    shell.build()

    bar = Part("booth_bar", col)
    # Wooden counter and back shelf; an LED strip lights the inside
    bar.box(W - 0.2, 0.06, 0.55, 0, 1.0, front - 0.05, "wood", bevel=0.01)
    bar.box(W - 0.5, 0.05, 0.3, 0, 1.65, back + 0.3, "wood")
    for x, w, h in ((-1.3, 0.4, 0.3), (-0.8, 0.3, 0.45), (0.9, 0.45, 0.35), (1.35, 0.3, 0.25)):
        bar.box(w, h, 0.25, x, 1.7, back + 0.3, "wood_dark" if w > 0.35 else "black")
    bar.box(W - 0.6, 0.03, 0.05, 0, top - 0.2, front - 0.35, "bulb")
    bar.build()

    flap = Part("booth_awning", col)
    # The upper front wall, hinged at the roof edge and propped up as an awning
    angle = math.radians(12)
    length = 1.5
    hinge = (top - 0.05, front)
    direction = (math.sin(angle), math.cos(angle))  # (y, z)

    def along(t, lift=0.0):
        return hinge[0] + direction[0] * t + lift, hinge[1] + direction[1] * t

    y, z = along(length / 2)
    flap.box(W - 0.2, 0.05, length, 0, y, z, "container", rot=(-angle, 0, 0), centered=True)
    for i in range(12):
        x = -W / 2 + 0.3 + i * (W - 0.6) / 11
        y, z = along(length / 2, 0.035)
        flap.box(0.1, 0.03, length - 0.1, x, y, z, "container", rot=(-angle, 0, 0), centered=True)
    y, z = along(length)
    flap.box(W - 0.2, 0.12, 0.03, 0, y - 0.06, z, "accent", rot=(-angle, 0, 0), centered=True)
    # Gas struts from the wall to the awning
    for x in (-W / 2 + 0.3, W / 2 - 0.3):
        y2, z2 = along(length * 0.7)
        flap.beam((x, 1.9, front), (x, y2 - 0.03, z2), 0.035, "steel", round_=True)
    # A string of bulbs hanging under the awning edge
    y, z = along(length - 0.05)
    count = 11
    for i in range(count):
        t = i / (count - 1)
        x = -W / 2 + 0.25 + t * (W - 0.5)
        sag = 0.12 * (1 - (2 * t - 1) ** 2)
        flap.sphere(0.05, x, y - 0.1 - sag, z, "bulb")
    flap.build()

    sign = Part("booth_sign", col)
    # Frame for the sign on the roof (the text is drawn by the site)
    sign.box(3.34, 0.94, 0.06, 0, 3.75, 0.66, "black", centered=True)
    for x in (-1.2, 1.2):
        sign.box(0.06, 0.6, 0.06, x, top, 0.6, "steel")
    sign.build()


def build_stage():
    """Main stage: deck 16 × 1.4 × 8, LED wall (sign 11 × 4.4 at y 4.3, z −3.6), truss, PA, lights."""
    col = new_collection("stage")
    deck_w, deck_h, deck_d = 16, 1.4, 8

    deck = Part("stage_deck", col)
    deck.box(deck_w, deck_h - 0.08, deck_d, material="black")
    deck.box(deck_w, 0.08, deck_d, 0, deck_h - 0.08, 0, "deck")
    # Front edge highlight and stairs on the right side
    deck.box(deck_w + 0.02, 0.05, 0.05, 0, deck_h - 0.06, deck_d / 2, "metal")
    for i in range(4):
        h = deck_h * (i + 1) / 4
        deck.box(0.35, h, 1.4, deck_w / 2 + 1.4 - i * 0.35, 0, -2.2, "deck")
    # Black backdrop behind the LED wall
    deck.box(15.2, 7.4, 0.08, 0, deck_h, -3.95, "fabric")
    deck.build()

    wall = Part("stage_ledwall", col)
    wall.box(11.5, 4.9, 0.24, 0, 4.3, -3.74, "black", centered=True, bevel=0.02)
    for x in (-5, 5):
        wall.box(0.2, 1.65, 0.2, x, deck_h, -3.74, "metal")
    wall.build()

    frame = Part("stage_truss", col)
    top = 9
    gap = 0.25  # half a corner block
    for x in (-7.6, 7.6):
        for z in (-3.6, 3.6):
            truss(frame, (x, 0.05, z), "y", top - gap - 0.05)
            frame.box(0.8, 0.05, 0.8, x, 0, z, "steel")  # base plate
            truss_node(frame, (x, top, z))
        truss_span(frame, (x, top, -3.6), (x, top, 3.6), "z")
    for z in (-3.6, 3.6):
        truss_span(frame, (-7.6, top, z), (7.6, top, z), "x")
    frame.build()

    pa = Part("stage_pa", col)
    for side in (-1, 1):
        x = side * 9.2
        # Hanging bumper, suspended from the top truss
        pa.box(1.0, 0.1, 0.8, x, 7.35, 3.6, "metal")
        pa.beam((x, 7.45, 3.6), (side * 7.6, top, 3.6), 0.02, "black")
        # Line array: eight cabinets curving towards the audience (a "J" shape)
        y, z, tilt = 7.35, 3.6, 0.0
        for i in range(8):
            tilt += math.radians(1.2 + i * 1.4)
            y -= 0.37 * math.cos(tilt)
            z += 0.37 * math.sin(tilt) * 0.5
            pa.box(0.95, 0.35, 0.62, x, y, z, "black", rot=(tilt, 0, 0), centered=True, bevel=0.015)
            pa.box(0.8, 0.22, 0.02, x, y, z + 0.31 * math.cos(tilt), "deck", rot=(tilt, 0, 0), centered=True)
    # Subwoofers on the ground in front of the stage
    for x in (-5.5, -4.4, 4.4, 5.5):
        pa.box(1.05, 0.75, 0.9, x, 0, 4.7, "black", bevel=0.02)
        pa.box(0.85, 0.55, 0.02, x, 0.1, 5.16, "deck")
    pa.build()

    lights = Part("stage_lights", col)
    # Moving heads hanging under the front and back truss
    for z in (3.6, -3.2):
        for i in range(6):
            x = -6.25 + i * 2.5
            lights.box(0.34, 0.14, 0.3, x, top - 0.36, z, "black")
            lights.cylinder(0.02, 0.1, x, top - 0.22, z, "black", segments=6)
            lights.cylinder(0.14, 0.3, x, top - 0.62, z, "black", segments=8, rot=(0.5, 0, 0), centered=True)
            lights.cylinder(0.1, 0.02, x, top - 0.78, z + 0.08, "lens", segments=8, rot=(0.5, 0, 0), centered=True)
    lights.build()

    barrier = Part("stage_barrier", col)
    # Crowd barrier in front of the subs
    z = 6.0
    for i in range(14):
        x = -7 + i + 0.5
        barrier.box(0.96, 1.1, 0.06, x, 0.02, z, "metal", bevel=0.01)
        barrier.box(0.96, 0.03, 0.8, x, 0, z - 0.35, "metal")
    barrier.build()


def build_foh():
    """FOH tent: platform 5 × 0.3 × 4, poles, pyramid roof, mixing desk facing the stage (−z)."""
    col = new_collection("foh")

    base = Part("foh_base", col)
    base.box(5, 0.3, 4, material="wood_dark", bevel=0.02)
    for i in range(2):
        base.box(1.2, 0.15 * (i + 1), 0.3, 0, 0, 2.3 - i * 0.3, "wood_dark")
    for x in (-2.3, 2.3):
        for z in (-1.8, 1.8):
            base.cylinder(0.05, 3.0, x, 0.3, z, "metal", segments=8)
    # Bike-rack barriers around the sides and the stage side (open at the back for the steps)
    for x0, z0, x1, z1 in ((-3.2, -2.7, 3.2, -2.7), (-3.2, -2.7, -3.2, 2.7), (3.2, -2.7, 3.2, 2.7)):
        base.beam((x0, 1.0, z0), (x1, 1.0, z1), 0.04, "metal", round_=True)
        base.beam((x0, 0.2, z0), (x1, 0.2, z1), 0.04, "metal", round_=True)
        steps = max(1, round(math.hypot(x1 - x0, z1 - z0) / 1.1))
        for i in range(steps + 1):
            t = i / steps
            x, z = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
            base.beam((x, 0.0, z), (x, 1.0, z), 0.04, "metal", round_=True)
    base.build()

    roof = Part("foh_roof", col)
    roof.cylinder(3.6, 1.6, 0, 3.3, 0, "fabric", segments=4, rot=(0, math.pi / 4, 0), radius_top=0.05)
    # Red band around the edge of the tent roof
    for x, z, w, d in ((0, 2.55, 5.1, 0.04), (0, -2.55, 5.1, 0.04), (2.55, 0, 0.04, 5.1), (-2.55, 0, 0.04, 5.1)):
        roof.box(w, 0.28, d, x, 3.02, z, "accent")
    roof.build()

    desk = Part("foh_desk", col)
    # Mixing desk: body, sloped control surface with faders, two screens facing the engineer (+z)
    desk.box(2.6, 0.9, 1.0, 0, 0.3, -0.7, "black", bevel=0.02)
    tilt = -0.2
    desk.box(2.6, 0.06, 1.1, 0, 1.23, -0.7, "deck", rot=(tilt, 0, 0), centered=True)
    for row in range(2):
        for i in range(16):
            x = -1.12 + i * 0.15
            z = -0.4 - row * 0.45
            y = 1.28 + (z + 0.7) * -math.tan(tilt)
            desk.box(0.04, 0.03, 0.08, x, y, z, "metal" if i % 4 else "accent", rot=(tilt, 0, 0))
    for x in (-0.65, 0.65):
        desk.box(0.9, 0.55, 0.05, x, 1.45, -1.2, "black", rot=(-0.25, 0, 0))
        desk.box(0.82, 0.47, 0.01, x, 1.49, -1.17, "screen", rot=(-0.25, 0, 0))
    # A small lighting desk on a side table
    desk.box(1.0, 0.9, 0.7, 1.85, 0.3, -1.0, "wood")
    desk.box(0.9, 0.12, 0.55, 1.85, 1.2, -1.0, "black", bevel=0.01)
    desk.box(0.5, 0.3, 0.02, 1.85, 1.35, -1.25, "screen", rot=(-0.3, 0, 0))
    desk.build()


def build_entrance():
    """Entrance arch: two truss towers, a truss beam and a banner frame (sign 10.2 × 1.5 at y 4.4, z 0.52)."""
    col = new_collection("entrance")

    arch = Part("entrance_arch", col)
    for x in (-5.6, 5.6):
        arch.box(1.0, 0.06, 1.0, x, 0, 0, "steel")
        arch.box(0.9, 0.35, 0.9, x, 0.06, 0, "black", bevel=0.02)  # ballast block
        truss(arch, (x, 0.41, 0), "y", 5.4 - 0.3 - 0.41, size=0.5)
        truss_node(arch, (x, 5.4, 0), size=0.5)
    truss_span(arch, (-5.6, 5.4, 0), (5.6, 5.4, 0), "x", size=0.5)
    arch.box(10.46, 1.76, 0.06, 0, 4.4, 0.46, "black", centered=True)
    for x in (-4, 0, 4):
        arch.beam((x, 5.28, 0.46), (x, 5.15, 0.46), 0.02, "black")
    arch.build()

    fence = Part("entrance_fence", col)
    # Construction fences (Heras) running sideways from both towers
    for side in (-1, 1):
        for i in range(4):
            x0 = side * (6.2 + i * 2.2)
            x1 = side * (6.2 + (i + 1) * 2.2 - 0.05)
            for y in (0.15, 2.0):
                fence.beam((x0, y, 0), (x1, y, 0), 0.04, "metal", round_=True)
            for x in (x0, x1):
                fence.beam((x, 0.15, 0), (x, 2.0, 0), 0.04, "metal", round_=True)
            for k in range(1, 8):
                x = x0 + (x1 - x0) * k / 8
                fence.beam((x, 0.15, 0), (x, 2.0, 0), 0.008, "metal")
            fence.box(0.6, 0.14, 0.2, x0, 0, 0, "black")
    fence.build()


def main():
    force = "--force" in sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else False
    if os.path.exists(BLEND_PATH) and not force:
        print(f"{BLEND_PATH} exists; pass -- --force to rebuild it (this discards manual edits).")
        return

    bpy.ops.wm.read_factory_settings(use_empty=True)
    build_booth()
    build_stage()
    build_foh()
    build_entrance()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print(f"Saved {BLEND_PATH}")

    sys.path.insert(0, HERE)
    import export_models

    export_models.export_all()


main()
