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
    "paper": ((0.55, 0.55, 0.52), 0.9, 0.0, None, 0),
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

    def extruded(self, outline, thickness, x=0, y=0, z=0, material="fabric", rot=(0, 0, 0)):
        """A flat shape from a 2D outline (x, y pairs, counter-clockwise), `thickness` deep along z."""
        m = C @ trs((x, y, z), rot)  # the outline is in three.js space, so only convert the result

        def create(bm):
            front = [bm.verts.new(m @ Vector((px, py, thickness / 2))) for px, py in outline]
            back = [bm.verts.new(m @ Vector((px, py, -thickness / 2))) for px, py in outline]
            bm.faces.new(front)
            bm.faces.new(list(reversed(back)))
            n = len(outline)
            for i in range(n):
                j = (i + 1) % n
                bm.faces.new((front[i], back[i], back[j], front[j]))
            return {"verts": front + back}

        self._add(create, material)

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
    # Wooden counter; an LED strip lights the inside (each booth adds its own interior)
    bar.box(W - 0.2, 0.06, 0.55, 0, 1.0, front - 0.05, "wood", bevel=0.01)
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



# --- Booth interiors -------------------------------------------------------------------------
# Every booth uses the container above plus one of these. The board on the back wall is drawn by
# the site (menu, tap list, …); the models only contain its frame. Board: centre y 1.85, z -1.06,
# 3.2 x 1.25 m (Merch: 1.9 m wide, with shirts left and right of it).

BOARD_Y, BOARD_Z = 1.85, -1.06


def board_frame(part: Part, width=3.2, height=1.25):
    part.box(width + 0.12, height + 0.12, 0.03, 0, BOARD_Y, BOARD_Z - 0.03, "black", centered=True)


def build_booth_projects():
    """Food truck: the projects are the menu. Griddle and fryer below the menu board."""
    part = Part("booth_projects", new_collection("booth_projects"))
    board_frame(part)
    # Steel back counter with a griddle and a fryer
    part.box(3.8, 0.95, 0.55, 0, 0.16, -0.8, "steel", bevel=0.01)
    part.box(1.4, 0.04, 0.45, -0.9, 1.11, -0.8, "black")
    part.box(0.7, 0.08, 0.45, 0.9, 1.11, -0.8, "steel", bevel=0.01)
    for x in (0.72, 1.08):
        part.box(0.25, 0.02, 0.3, x, 1.19, -0.8, "black")
    # Sauce bottles, a napkin holder and an order bell on the front counter
    for x, material in ((-1.5, "accent"), (-1.38, "black"), (-1.26, "accent")):
        part.cylinder(0.04, 0.2, x, 1.06, 1.1, material, segments=8)
        part.cylinder(0.012, 0.05, x, 1.26, 1.1, "black", segments=6)
    part.box(0.16, 0.12, 0.08, -0.95, 1.06, 1.1, "steel")
    part.box(0.14, 0.1, 0.06, -0.95, 1.06, 1.1, "paper")
    part.cylinder(0.07, 0.05, -0.55, 1.06, 1.1, "steel", segments=10, radius_top=0.01)
    # Serving tray for the project item (placed by the site at x 1.15)
    part.cylinder(0.3, 0.02, 1.15, 1.03, 1.02, "steel", segments=16)
    part.build()


def build_booth_lab():
    """Drinks stand: experiments are what's on tap. Tap tower on the counter, kegs inside."""
    part = Part("booth_lab", new_collection("booth_lab"))
    board_frame(part)
    # Tap tower: a T of chrome with four taps and handles, over a drip tray
    part.box(1.1, 0.02, 0.2, 0, 1.06, 1.05, "steel")
    part.cylinder(0.04, 0.4, 0, 1.06, 1.05, "metal", segments=10)
    part.cylinder(0.04, 1.0, 0, 1.48, 1.05, "metal", segments=10, rot=(0, 0, math.pi / 2), centered=True)
    for i, x in enumerate((-0.36, -0.12, 0.12, 0.36)):
        part.cylinder(0.018, 0.08, x, 1.38, 1.1, "metal", segments=6)
        part.box(0.035, 0.2, 0.035, x, 1.5, 1.09, "accent" if i % 2 == 0 else "black", bevel=0.005)
    # Glasses and kegs
    for x in (-1.3, -1.12):
        part.cylinder(0.035, 0.12, x, 1.06, 1.1, "paper", segments=8, radius_top=0.042)
    # Coaster for the lab item (placed by the site at x 1.0)
    part.cylinder(0.28, 0.02, 1.0, 1.03, 1.02, "wood_dark", segments=16)
    for x in (-1.2, -0.6, 0.9):
        part.cylinder(0.2, 0.6, x, 0.16, -0.75, "steel", segments=12)
        for y in (0.24, 0.66):
            part.cylinder(0.215, 0.04, x, y, -0.75, "metal", segments=12)
    part.build()


SHIRT = [(-0.28, 0.0), (0.28, 0.0), (0.28, 0.42), (0.42, 0.34), (0.5, 0.48), (0.2, 0.62), (0.08, 0.58),
         (-0.08, 0.58), (-0.2, 0.62), (-0.5, 0.48), (-0.42, 0.34), (-0.28, 0.42)]


def build_booth_merch():
    """Merch stand: shirts on the back wall around a small board (the CV is the merch)."""
    part = Part("booth_merch", new_collection("booth_merch"))
    board_frame(part, width=1.9)
    shirt = [(px * 0.8, py * 0.8) for px, py in SHIRT]
    for x, material in ((-1.47, "accent"), (1.47, "black")):
        part.extruded(shirt, 0.03, x, 1.4, BOARD_Z + 0.03, material)
        part.cylinder(0.01, 0.1, x, 1.9, BOARD_Z + 0.02, "steel", segments=6)
    # Folded shirts on the counter and a clothes rail at the side
    for i, material in enumerate(("black", "accent", "fabric", "black")):
        part.box(0.4, 0.05, 0.32, 1.2, 1.06 + i * 0.05, 1.05, material)
    for i, material in enumerate(("fabric", "black", "fabric")):
        part.box(0.4, 0.05, 0.32, -1.2, 1.06 + i * 0.05, 1.05, material)
    part.build()


def build_booth_contact():
    """Info point: leaflets and a desk bell on the counter, a stool behind it."""
    part = Part("booth_contact", new_collection("booth_contact"))
    board_frame(part)
    for i in range(3):
        part.box(0.26, 0.34, 0.03, -1.3 + i * 0.3, 1.06, 1.05, "paper", rot=(-0.25, 0, 0))
        part.box(0.28, 0.1, 0.05, -1.3 + i * 0.3, 1.06, 1.08, "black")
    part.cylinder(0.08, 0.06, 1.3, 1.06, 1.1, "steel", segments=10, radius_top=0.02)
    part.cylinder(0.02, 0.02, 1.3, 1.12, 1.1, "black", segments=6)
    part.cylinder(0.2, 0.05, 0.3, 0.75, 0.2, "black", segments=10)
    part.cylinder(0.03, 0.6, 0.3, 0.16, 0.2, "steel", segments=6)
    part.build()


def build_booth_links():
    """Links stand: a laptop and a phone on a stand on the counter."""
    part = Part("booth_links", new_collection("booth_links"))
    board_frame(part)
    part.box(0.5, 0.02, 0.34, -1.1, 1.06, 1.05, "steel")
    part.box(0.5, 0.33, 0.02, -1.1, 1.07, 0.88, "steel", rot=(-0.25, 0, 0))
    part.box(0.46, 0.29, 0.01, -1.1, 1.09, 0.895, "screen", rot=(-0.25, 0, 0))
    part.box(0.12, 0.02, 0.1, 1.2, 1.06, 1.1, "black")
    part.box(0.09, 0.17, 0.012, 1.2, 1.08, 1.08, "black", rot=(-0.3, 0, 0))
    part.box(0.08, 0.15, 0.005, 1.2, 1.09, 1.087, "screen", rot=(-0.3, 0, 0))
    part.build()


# --- Project items ---------------------------------------------------------------------------
# One small animated model per project ("the dish on the menu"), shown on the booth counter.
# Collection `item_<slug>` → public/models/items/<slug>.glb. At most ~0.5 m wide and 0.45 m tall
# (taller would hide the menu board), standing on y = 0. These are placeholders based only on the
# project names; replace them with real ones in festival.blend.
#
# Animation: keyframes on objects (location / rotation / scale), looping from frame 1 to LOOP + 1
# with the last key equal to the first. Every object pivots around its own origin, so parts are
# modelled around (0, 0, 0) and then placed with `place()`.

FPS = 24
LOOP = 48  # frames per loop (2 seconds)


def place(obj, x=0.0, y=0.0, z=0.0, parent=None):
    """Position an object in three.js space (relative to its parent)."""
    obj.location = (x, -z, y)
    if parent is not None:
        obj.parent = parent
    return obj


def key(obj, frame, loc=None, rot=None, scale=None):
    """Keyframe in three.js space: loc (x, y, z), rot (x, y, z) radians around three.js axes, uniform scale."""
    if loc is not None:
        obj.location = (loc[0], -loc[2], loc[1])
        obj.keyframe_insert("location", frame=frame)
    if rot is not None:
        obj.rotation_euler = (rot[0], -rot[2], rot[1])
        obj.keyframe_insert("rotation_euler", frame=frame)
    if scale is not None:
        obj.scale = (scale, scale, scale)
        obj.keyframe_insert("scale", frame=frame)


def sampled(obj, fn, loop=LOOP, step=3):
    """Keyframes every `step` frames from fn(t), t in 0..1 over one loop; fn returns key() kwargs."""
    for frame in range(1, loop + 2, step):
        key(obj, frame, **fn((frame - 1) / loop))
    key(obj, loop + 1, **fn(1.0))


def wave(t, cycles=1):
    return math.sin(t * cycles * math.tau)


def item_tagrun(col):
    """TagRun: a running shoe that bobs heel-to-toe."""
    shoe = Part("tagrun_shoe", col)
    shoe.box(0.36, 0.05, 0.14, 0, 0, 0, "black", bevel=0.01)
    shoe.box(0.24, 0.12, 0.13, -0.04, 0.05, 0, "accent", bevel=0.02)
    shoe.box(0.12, 0.07, 0.13, 0.12, 0.05, 0, "accent", rot=(0, 0, -0.35), bevel=0.02)
    shoe.box(0.05, 0.1, 0.12, -0.15, 0.14, 0, "black")
    for i in range(3):
        shoe.box(0.015, 0.012, 0.1, 0.0 + i * 0.045, 0.172, 0, "paper")
    obj = place(shoe.build(), 0, 0.02, 0)
    sampled(obj, lambda t: {
        "loc": (0, 0.02 + 0.07 * abs(wave(t, 2)), 0),
        "rot": (0, 0, 0.22 * wave(t, 2)),
    })


def item_xr_posture_checker(col):
    """XR Posture Checker: a spine that straightens up, with a VR headset floating above it."""
    base = Part("posture_base", col)
    base.cylinder(0.12, 0.03, 0, 0, 0, "black", segments=12)
    parent = place(base.build())
    count = 7
    for i in range(count):
        vertebra = Part(f"posture_vertebra_{i}", col)
        vertebra.cylinder(0.045 - i * 0.003, 0.03, 0, 0, 0, "paper", segments=8)
        vertebra.box(0.02, 0.02, 0.04, 0, 0.005, -0.045, "paper")
        obj = place(vertebra.build(), 0, 0.03 if i == 0 else 0.042, 0, parent)
        # Slouched → straight → slouched; the bend adds up along the chain
        sampled(obj, lambda t: {"rot": (0.16 * (0.5 + 0.5 * math.cos(t * math.tau)), 0, 0)})
        parent = obj
    headset = Part("posture_headset", col)
    headset.box(0.16, 0.07, 0.08, 0, 0, 0, "black", bevel=0.015)
    headset.box(0.14, 0.05, 0.005, 0, 0.01, 0.042, "lens")
    headset.box(0.18, 0.02, 0.02, 0, 0.03, -0.05, "fabric")
    obj = place(headset.build(), 0, 0.1, 0, parent)
    sampled(obj, lambda t: {"loc": (0, 0.1 + 0.015 * wave(t, 2), 0)})


def item_puzzle_roulette(col):
    """Puzzle Roulette: a roulette wheel spinning, with a puzzle piece bobbing in the middle."""
    stand = Part("roulette_stand", col)
    stand.cylinder(0.2, 0.06, 0, 0, 0, "wood_dark", segments=16, radius_top=0.22)
    place(stand.build())
    wheel = Part("roulette_wheel", col)
    segments = 12
    for i in range(segments):
        a0, a1 = i / segments * math.tau, (i + 1) / segments * math.tau
        wedge = [(0, 0), (0.19 * math.cos(a0), 0.19 * math.sin(a0)), (0.19 * math.cos(a1), 0.19 * math.sin(a1))]
        wheel.extruded(wedge, 0.02, 0, 0, 0, "accent" if i % 2 else "black", rot=(-math.pi / 2, 0, 0))
    wheel.cylinder(0.03, 0.06, 0, 0, 0, "metal", segments=8)
    obj = place(wheel.build(), 0, 0.07, 0)
    sampled(obj, lambda t: {"rot": (0, t * math.tau, 0)}, step=4)
    piece = Part("roulette_piece", col)
    outline = []
    for k in range(4):  # a square with a round knob on every side
        cx, cy = [(0, -1), (1, 0), (0, 1), (-1, 0)][k]
        tx, ty = -cy, cx
        outline.append((0.05 * (cx - tx), 0.05 * (cy - ty)))
        for j in range(5):
            a = math.pi * j / 4
            ox, oy = 0.05 * cx + 0.02 * cx * math.sin(a), 0.05 * cy + 0.02 * cy * math.sin(a)
            outline.append((ox - 0.02 * tx * math.cos(a), oy - 0.02 * ty * math.cos(a)))
    piece.extruded(outline, 0.025, 0, 0, 0, "paper")
    obj = place(piece.build(), 0, 0.18, 0)
    sampled(obj, lambda t: {"loc": (0, 0.18 + 0.03 * wave(t, 2), 0), "rot": (0, -t * math.tau, 0)}, step=4)


def item_kitchenapp(col):
    """KitchenApp: a pan that flips a pancake."""
    pan = Part("kitchen_pan", col)
    pan.cylinder(0.13, 0.03, 0, 0, 0, "black", segments=14, radius_top=0.15)
    pan.box(0.2, 0.02, 0.03, 0.23, 0.02, 0, "wood_dark")
    obj = place(pan.build(), -0.03, 0.02, 0)
    sampled(obj, lambda t: {"rot": (0, 0, 0.18 * max(0.0, wave(t)) if t < 0.5 else 0)})
    cake = Part("kitchen_pancake", col)
    cake.cylinder(0.1, 0.018, 0, -0.009, 0, "wood", segments=12)
    obj = place(cake.build(), -0.03, 0.05, 0)

    def flip(t):
        jump = max(0.0, math.sin(min(t / 0.6, 1.0) * math.pi))  # up and down during the first 60 %
        turn = min(t / 0.6, 1.0) * math.pi
        return {"loc": (-0.03, 0.05 + 0.25 * jump, 0), "rot": (turn, 0, 0)}

    sampled(obj, flip, step=2)


def item_post_it_machine(col):
    """Post-It Machine: a small machine that pushes out notes."""
    machine = Part("postit_machine", col)
    machine.box(0.26, 0.2, 0.2, 0, 0, 0, "steel", bevel=0.015)
    machine.box(0.18, 0.012, 0.02, 0, 0.12, 0.1, "black")
    machine.cylinder(0.02, 0.02, 0.09, 0.2, 0.05, "accent", segments=8)
    place(machine.build())
    note = Part("postit_note", col)
    note.box(0.14, 0.004, 0.14, 0, -0.002, 0, "paper", centered=True)
    obj = place(note.build(), 0, 0.126, 0.1)

    def out(t):
        if t < 0.4:  # slides out of the slot
            return {"loc": (0, 0.126, 0.03 + 0.18 * t / 0.4), "rot": (0, 0, 0), "scale": 1.0}
        if t < 0.85:  # floats up and turns
            u = (t - 0.4) / 0.45
            return {"loc": (0.04 * u, 0.126 + 0.2 * u, 0.21 + 0.05 * u), "rot": (-0.6 * u, 0.8 * u, 0), "scale": 1.0}
        u = (t - 0.85) / 0.15  # shrinks away, back into the slot for the next loop
        return {"loc": (0.04, 0.326, 0.26), "rot": (-0.6, 0.8, 0), "scale": max(0.001, 1 - u)}

    sampled(obj, out, step=2)
    key(obj, LOOP + 1, loc=(0, 0.126, 0.03), rot=(0, 0, 0), scale=1.0)


ITEM_BUILDERS = {
    "tagrun": item_tagrun,
    "xr-posture-checker": item_xr_posture_checker,
    "puzzle-roulette": item_puzzle_roulette,
    "kitchenapp": item_kitchenapp,
    "post-it-machine": item_post_it_machine,
}


def build_items():
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, LOOP + 1
    # Keys are sampled densely, so straight lines between them keep loops and spins even
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    for slug, build in ITEM_BUILDERS.items():
        build(new_collection(f"item_{slug}"))
    scene.frame_set(1)


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
            base.cylinder(0.05, 3.6, x, 0.3, z, "metal", segments=8)
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
    roof.cylinder(3.6, 1.6, 0, 3.9, 0, "fabric", segments=4, rot=(0, math.pi / 4, 0), radius_top=0.05)
    # Red band around the edge of the tent roof
    for x, z, w, d in ((0, 2.55, 5.1, 0.04), (0, -2.55, 5.1, 0.04), (2.55, 0, 0.04, 5.1), (-2.55, 0, 0.04, 5.1)):
        roof.box(w, 0.28, d, x, 3.62, z, "accent")
    roof.build()

    desk = Part("foh_desk", col)
    # Audio desk, facing the engineer (+z): the control surface rises towards the stage, faders at
    # the front, knobs behind them, and a meter bridge at the back carrying two screens.
    # The screens themselves are drawn by the site (src/world/fohDesk.ts, SCREENS); keep the bezels
    # below in the same place.
    depth, near, far, width = 1.05, 0.78, 0.98, 2.3
    desk.extruded([(0, 0), (depth, 0), (depth, far), (0, near)], width, 0, 0.3, -0.25, "black", rot=(0, math.pi / 2, 0))
    slope = math.atan2(far - near, depth)

    def surface(u):  # (y, z) on the control surface, u metres from the engineer's edge
        return 0.3 + near + u * (far - near) / depth, -0.25 - u

    y, z = surface(depth / 2)
    desk.box(width - 0.08, 0.02, depth - 0.04, 0, y + 0.01, z, "deck", rot=(slope, 0, 0), centered=True)
    channels = 20
    for i in range(channels):
        x = -1.0 + i * 2.0 / (channels - 1)
        y, z = surface(0.2)
        desk.box(0.012, 0.012, 0.26, x, y + 0.02, z, "black", rot=(slope, 0, 0), centered=True)  # fader slot
        # The fader caps are added by the site (fohDesk.ts), so they can follow the volume.
        for row, u in enumerate((0.45, 0.56, 0.67)):
            y, z = surface(u)
            desk.cylinder(0.016, 0.025, x, y + 0.01, z, "metal" if row else "accent", segments=6)
    y, _ = surface(depth)
    desk.box(width, 0.14, 0.16, 0, y - 0.02, -1.22, "black", bevel=0.01)  # meter bridge
    for x in (-0.55, 0.55):
        desk.box(1.06, 0.64, 0.04, x, 1.695, -1.195, "black", rot=(-0.2, 0, 0), centered=True, bevel=0.008)
        desk.box(0.12, 0.08, 0.06, x, y + 0.12, -1.21, "black")

    # Lighting desk on a table on the right: a flat console with its screen behind it
    table_top = 1.06
    desk.box(0.9, 0.04, 0.75, 1.8, table_top, -0.875, "wood_dark", bevel=0.005)
    for x in (1.39, 2.21):
        for z in (-1.21, -0.54):
            desk.box(0.04, table_top - 0.3, 0.04, x, 0.3, z, "metal")
    top = table_top + 0.04
    desk.extruded([(0, 0), (0.5, 0), (0.5, 0.12), (0, 0.06)], 0.85, 1.8, top, -0.55, "black", rot=(0, math.pi / 2, 0))
    light_slope = math.atan2(0.06, 0.5)
    for i in range(10):
        x = 1.44 + i * 0.08
        u = 0.12 + 0.12 * ((i * 3) % 5) / 5
        desk.box(0.03, 0.025, 0.03, x, top + 0.06 + u * 0.12 + 0.012, -0.55 - u, "accent" if i % 5 == 0 else "metal", rot=(light_slope, 0, 0), centered=True)
    desk.box(0.86, 0.54, 0.04, 1.8, 1.554, -1.104, "black", rot=(-0.25, 0, 0), centered=True, bevel=0.008)
    desk.box(0.1, 0.2, 0.05, 1.8, top + 0.1, -1.1, "black")
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
    build_booth_projects()
    build_booth_lab()
    build_booth_merch()
    build_booth_contact()
    build_booth_links()
    build_stage()
    build_foh()
    build_entrance()
    build_items()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print(f"Saved {BLEND_PATH}")

    sys.path.insert(0, HERE)
    import export_models

    export_models.export_all()


main()
