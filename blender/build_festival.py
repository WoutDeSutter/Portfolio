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
    "grass": ((0.018, 0.028, 0.02), 1.0, 0.0, None, 0),
    "trackway": ((0.026, 0.028, 0.031), 0.9, 0.0, None, 0),
    "pine": ((0.01, 0.022, 0.015), 0.95, 0.0, None, 0),
    "crowd": ((0.03, 0.032, 0.042), 0.9, 0.0, None, 0),
    "ui_tile": ((0.3, 0.31, 0.33), 0.5, 0.0, (0.62, 0.64, 0.68), 0.9),
    "ui_green": ((0.1, 0.5, 0.2), 0.5, 0.0, (0.25, 0.95, 0.45), 2.0),
    "ui_amber": ((0.5, 0.35, 0.05), 0.5, 0.0, (1.0, 0.65, 0.1), 2.0),
    "ui_blue": ((0.05, 0.1, 0.5), 0.5, 0.0, (0.2, 0.4, 1.0), 2.0),
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

    def _add(self, create, material: str, bevel: float = 0.0, smooth: bool = False):
        """Builds one primitive in its own bmesh (so bevelling can't touch other pieces) and appends it."""
        piece = bmesh.new()
        verts = create(piece)["verts"]
        if bevel > 0:
            edges = list({e for v in verts for e in v.link_edges})
            bmesh.ops.bevel(piece, geom=list(verts) + edges, offset=bevel, segments=1, affect="EDGES", profile=0.5)
        index = self._index(material)
        for face in piece.faces:
            face.material_index = index
            face.smooth = smooth
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

    def cylinder(self, radius, h, x=0, y=0, z=0, material="metal", segments=8, rot=(0, 0, 0), radius_top=None, centered=False, caps=True):
        cy = y if centered else y + h / 2
        m = to_blender(trs((x, cy, z), rot))
        top = radius if radius_top is None else radius_top
        self._add(
            lambda bm: bmesh.ops.create_cone(
                bm, cap_ends=caps, segments=segments, radius1=radius, radius2=top, depth=h, matrix=m
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
    # Sauce bottles, a napkin holder and an order bell on the front counter. They are also the
    # obstacles of the TagRun runner (item_tagrun: `fixed`); the left end of the counter stays
    # free for his backflip.
    for x, material in ((-1.05, "accent"), (-0.93, "black"), (-0.81, "accent")):
        part.cylinder(0.04, 0.2, x, 1.06, 1.1, material, segments=8)
        part.cylinder(0.012, 0.05, x, 1.26, 1.1, "black", segments=6)
    part.box(0.16, 0.12, 0.08, -0.55, 1.06, 1.1, "steel")
    part.box(0.14, 0.1, 0.06, -0.55, 1.06, 1.1, "paper")
    part.cylinder(0.07, 0.05, -0.25, 1.06, 1.1, "steel", segments=10, radius_top=0.01)
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


# Seven-segment digits, for the bomb timer and the TagRun clock. A digit is 7 objects that are
# shown (scale 1) or hidden (scale ~0) per frame.
SEGMENTS = {  # (x, y, w, h) in a 0.03 × 0.05 cell
    "a": (0.0, 0.024, 0.022, 0.005), "b": (0.012, 0.012, 0.005, 0.021), "c": (0.012, -0.012, 0.005, 0.021),
    "d": (0.0, -0.024, 0.022, 0.005), "e": (-0.012, -0.012, 0.005, 0.021), "f": (-0.012, 0.012, 0.005, 0.021),
    "g": (0.0, 0.0, 0.022, 0.005),
}
DIGITS = {0: "abcdef", 1: "bc", 2: "abdeg", 3: "abcdg", 4: "bcfg", 5: "acdfg", 6: "acdefg", 7: "abc", 8: "abcdefg", 9: "abcdfg"}


def visible(obj, fn, loop):
    """Show/hide an object over the loop with scale 1 / ~0 (glTF can't animate visibility)."""
    sampled(obj, lambda t: {"scale": 1.0 if fn(t) else 0.0001}, loop, 1)


def seven_segment(col, name, parent, x, y, z, digit_at, loop, scale=1.0):
    """One digit whose value over time is digit_at(t) (0…9)."""
    for segment, (sx, sy, sw, sh) in SEGMENTS.items():
        part = Part(f"{name}_{segment}", col)
        part.box(sw * scale, sh * scale, 0.004, 0, -sh * scale / 2, 0, "lens")
        obj = place(part.build(), x + sx * scale, y + sy * scale, z, parent)
        visible(obj, lambda t, segment=segment: segment in DIGITS[digit_at(t)], loop)


def item_tagrun(col):
    """TagRun: a free runner doing a timed parkour run along the counter. He slaps the start
    button, obstacles rise out of the counter, he runs over them and the things already on the
    counter (bell, napkin holder, sauce bottles), backflips at the end, runs back and slaps the
    button again: the clock stops and the obstacles sink away. Positions are relative to the
    serving tray, in metres: this item is shown at its real size and does not turn."""
    loop = 192  # 8 seconds
    ground = 0.02
    lane = 0.08  # the obstacles stand a little towards the front of the counter
    right, left = 0.4, -2.7  # the backflip at the left end stays clear of the wall and the bottles
    button_x, clock_x = 0.58, 0.58  # inside the container's corner post
    start_t, stop_t = 0.03, 0.955  # the clock runs between the two button presses

    # Obstacles: (x, half width, height). The first three rise out of the counter for the run.
    popups = [(-0.4, 0.04, 0.09), (-0.73, 0.02, 0.16), (-1.05, 0.05, 0.1)]
    fixed = [(-1.40, 0.07, 0.06), (-1.70, 0.09, 0.13), (-2.08, 0.17, 0.27)]  # bell, napkins, bottles
    obstacles = popups + fixed

    def rise(t):
        """How far the pop-up obstacles are out of the counter (0…1)."""
        if t < start_t + 0.005:
            return 0.0001
        if t < start_t + 0.04:
            return max(0.0001, (t - start_t - 0.005) / 0.035)
        if t < stop_t + 0.005:
            return 1.0
        if t < stop_t + 0.035:
            return max(0.0001, 1 - (t - stop_t - 0.005) / 0.03)
        return 0.0001

    for index, (ox, half, height) in enumerate(popups):
        part = Part(f"tagrun_popup_{index}", col)
        if index == 2:  # a hurdle: two posts and a bar
            for dz in (-0.07, 0.07):
                part.box(0.012, height, 0.012, 0, 0, dz, "paper")
            part.box(0.012, 0.015, 0.16, 0, height - 0.015, 0, "accent")
        else:  # a block and a wall, with a red top edge
            part.box(half * 2, height - 0.012, 0.14, 0, 0, 0, "paper", bevel=0.003)
            part.box(half * 2, 0.012, 0.14, 0, height - 0.012, 0, "accent")
        obj = place(part.build(), ox, ground, lane)
        for frame in range(1, loop + 2):
            t = (frame - 1) / loop
            obj.scale = (1, rise(t), 1)
            obj.keyframe_insert("scale", frame=frame)

    # The start/stop button and the clock, at the start line
    stand = Part("tagrun_button_stand", col)
    stand.cylinder(0.025, 0.07, 0, 0, 0, "black", segments=10)
    stand.cylinder(0.034, 0.012, 0, 0.07, 0, "steel", segments=12)
    place(stand.build(), button_x, ground, lane)
    cap_part = Part("tagrun_button", col)
    cap_part.cylinder(0.03, 0.02, 0, 0, 0, "accent", segments=14, radius_top=0.024)
    cap = place(cap_part.build(), button_x, ground + 0.082, lane)

    def pressed(t):
        return abs(t - (start_t - 0.008)) < 0.008 or abs(t - (stop_t - 0.008)) < 0.008

    sampled(cap, lambda t: {"loc": (button_x, ground + 0.082 - (0.01 if pressed(t) else 0.0), lane)}, loop, 1)

    clock = Part("tagrun_clock", col)
    clock.box(0.014, 0.17, 0.014, 0, 0, 0, "black")  # pole
    clock.box(0.18, 0.1, 0.035, 0, 0.17, 0, "steel", bevel=0.005)  # housing
    clock.box(0.164, 0.084, 0.004, 0, 0.178, 0.018, "black")  # display
    clock.box(0.008, 0.008, 0.004, 0.006, 0.19, 0.021, "lens")  # decimal point
    clock_obj = place(clock.build(), clock_x, ground, lane - 0.12)

    def elapsed(t):
        return max(0.0, min(t, stop_t) - start_t) * loop / 24  # seconds

    seven_segment(col, "tagrun_clock_units", clock_obj, -0.03, 0.22, 0.021, lambda t: int(elapsed(t)) % 10, loop, 1.4)
    seven_segment(col, "tagrun_clock_tenths", clock_obj, 0.042, 0.22, 0.021, lambda t: int(elapsed(t) * 10) % 10, loop, 1.4)

    # --- The rig: root (position, turning) → body (lean, flips) → pelvis → limbs --------------
    root = place(bpy.data.objects.new("runner_root", None), 0, 0, 0)
    col.objects.link(root)
    # The body pivots around its middle (hip height), so flips and leaning turn around the centre
    # of the runner instead of around his feet.
    size = 1.35  # the runner's size (about 46 cm): big enough to follow from the camera
    centre = 0.23
    body = place(bpy.data.objects.new("runner_body", None), 0, centre, 0, root)
    body.scale = (size, size, size)
    col.objects.link(body)

    def limb(name, parent, at, size, material):
        part = Part(name, col)
        w, h, d = size
        part.box(w, h, d, 0, -h, 0, material, bevel=0.004)
        return place(part.build(), *at, parent)

    pelvis_part = Part("runner_pelvis", col)
    pelvis_part.box(0.075, 0.05, 0.05, 0, -0.025, 0, "black", bevel=0.005)
    pelvis = place(pelvis_part.build(), 0, 0.18 - centre / size, 0, body)
    torso_part = Part("runner_torso", col)
    torso_part.box(0.085, 0.11, 0.05, 0, 0.0, 0, "accent", bevel=0.008)
    torso_part.box(0.07, 0.03, 0.055, 0, 0.1, -0.012, "accent", bevel=0.008)  # hood
    torso = place(torso_part.build(), 0, 0.0, 0, pelvis)
    head_part = Part("runner_head", col)
    head_part.sphere(0.03, 0, 0.03, 0, "paper", subdivisions=2)
    place(head_part.build(), 0, 0.12, 0, torso)
    arms, legs = [], []
    for side in (-1, 1):
        upper = limb(f"runner_arm_{side}", torso, (side * 0.055, 0.1, 0), (0.022, 0.06, 0.024), "accent")
        lower = limb(f"runner_forearm_{side}", upper, (0, -0.06, 0), (0.02, 0.055, 0.022), "paper")
        thigh = limb(f"runner_thigh_{side}", pelvis, (side * 0.022, -0.04, 0), (0.03, 0.065, 0.032), "black")
        shin = limb(f"runner_shin_{side}", thigh, (0, -0.065, 0), (0.026, 0.06, 0.028), "black")
        foot_part = Part(f"runner_foot_{side}", col)
        foot_part.box(0.028, 0.014, 0.045, 0, -0.014, 0.01, "paper", bevel=0.003)
        place(foot_part.build(), 0, -0.06, 0, shin)
        arms.append((side, upper, lower))
        legs.append((side, thigh, shin))

    # --- The run -----------------------------------------------------------------------------
    def smooth(t):
        return t * t * (3 - 2 * t)

    def hop(x):
        """Height of the jump at x and how deep in a jump the runner is (0…1); the highest wins."""
        best = (0.0, 0.0)
        for ox, half, height in obstacles:
            reach = half + 0.1 + height * 0.5
            if abs(x - ox) < reach:
                u = (x - (ox - reach)) / (2 * reach)
                arc = (height + 0.04) * math.sin(math.pi * u)
                if arc > best[0]:
                    best = (arc, math.sin(math.pi * u))
        return best

    def press_amount(t):
        """0…1: the right hand reaching for the button around each press."""
        return max(0.0, 1 - abs(t - (start_t - 0.008)) / 0.022, 1 - abs(t - (stop_t - 0.008)) / 0.022)

    def pose(t):
        yaw_left, yaw_right = -math.pi / 2, math.pi / 2
        p = {"x": right, "y": ground, "yaw": yaw_right, "flip": 0.0, "lean": 0.0, "stride": 0.0, "tuck": 0.0, "run": 0.0}
        p["lean"] = 0.35 * press_amount(t)
        if t < 0.045:  # at the start line, slapping the button
            pass
        elif t < 0.075:  # turn to face the course
            p["yaw"] = yaw_right + (yaw_left - yaw_right) * smooth((t - 0.045) / 0.03)
        elif t < 0.45:  # run left
            u = (t - 0.075) / 0.375
            p["x"] = right + (left - right) * u
            p["yaw"] = yaw_left
            p["run"] = 1.0
        elif t < 0.58:  # backflip at the end of the counter, turning around the middle of the body
            u = (t - 0.45) / 0.13
            p["x"] = left
            p["yaw"] = yaw_left
            p["y"] = ground + 0.28 * math.sin(math.pi * u)
            spin = min(1.0, max(0.0, (u - 0.12) / 0.76))  # take off first, rotate in the air, then land
            p["flip"] = -math.tau * smooth(spin)
            p["tuck"] = math.sin(math.pi * spin)
        elif t < 0.62:  # turn around
            p["x"] = left
            p["yaw"] = yaw_left + (yaw_right - yaw_left) * smooth((t - 0.58) / 0.04)
        elif t < 0.93:  # run back to the start line
            u = (t - 0.62) / 0.31
            p["x"] = left + (right - left) * u
            p["run"] = 1.0
        # 0.93…1: back at the start line, facing the button: slap it to stop the clock
        if p["run"]:
            height, jump = hop(p["x"])
            travelled = abs(p["x"] - right) if t < 0.45 else abs(p["x"] - left)
            p["stride"] = travelled / 0.22 * math.tau  # one stride per 22 cm
            p["y"] = ground + height + 0.01 * abs(math.sin(p["stride"])) * (1 - jump)
            p["lean"] = 0.25 - 0.1 * jump
            p["tuck"] = jump
        return p

    def leg_angles(p, side):
        swing = math.sin(p["stride"] + (0 if side < 0 else math.pi)) * 0.8 * p["run"] * (1 - p["tuck"])
        knee = (0.2 + 0.9 * max(0.0, math.sin(p["stride"] + (math.pi / 2 if side < 0 else -math.pi / 2)))) * p["run"] * (1 - p["tuck"])
        return -swing - 1.3 * p["tuck"], knee + 1.8 * p["tuck"]

    def arm_angles(t, p, side):
        swing = math.sin(p["stride"] + (math.pi if side < 0 else 0)) * 0.7 * p["run"] * (1 - p["tuck"])
        reach = -1.3 * press_amount(t) if side > 0 else 0.0  # the right arm goes for the button
        return -swing - 0.9 * p["tuck"] + reach, -0.5 * p["run"] - 0.4 * p["tuck"]

    step = 2
    sampled(root, lambda t: {"loc": (pose(t)["x"], pose(t)["y"], lane), "rot": (0, pose(t)["yaw"], 0)}, loop, step)
    sampled(body, lambda t: {"rot": (pose(t)["lean"] + pose(t)["flip"], 0, 0)}, loop, step)
    for side, thigh, shin in legs:
        sampled(thigh, lambda t, side=side: {"rot": (leg_angles(pose(t), side)[0], 0, 0)}, loop, step)
        sampled(shin, lambda t, side=side: {"rot": (leg_angles(pose(t), side)[1], 0, 0)}, loop, step)
    for side, upper, lower in arms:
        sampled(upper, lambda t, side=side: {"rot": (arm_angles(t, pose(t), side)[0], 0, side * 0.08)}, loop, step)
        sampled(lower, lambda t, side=side: {"rot": (arm_angles(t, pose(t), side)[1], 0, 0)}, loop, step)
    return {"turntable": 0, "fit": 0}


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
    """Puzzle Roulette: a real-life "Keep Talking and Nobody Explodes" bomb. A case with modules:
    the countdown timer, a wires module where a wire gets cut, the big button, Simon Says and two
    strike lights. At the end of the loop the modules light up green: defused."""
    loop = 192  # 8 seconds
    tilt = -0.45  # the module face leans back so it faces the visitor at the counter

    case = Part("bomb_case", col)
    case.box(0.48, 0.3, 0.2, 0, 0, 0, "steel", bevel=0.02)
    for x in (-0.25, 0.25):  # side handles
        case.box(0.02, 0.05, 0.14, x, 0.17, 0, "black", bevel=0.005)
    for ix in range(3):
        for iy in range(2):
            case.box(0.14, 0.12, 0.012, -0.15 + ix * 0.15, 0.03 + iy * 0.135, 0.1, "black")
    case_obj = place(case.build(), 0, 0, 0)
    case_obj.rotation_euler = (tilt, 0, 0)

    face = bpy.data.objects.new("bomb_face", None)  # children sit on the module face
    col.objects.link(face)
    place(face, 0, 0.06, 0.108, case_obj)  # the module face, level with the slots in the case

    def on_face(name, build, x, y, z=0.0):
        part = Part(name, col)
        build(part)
        return place(part.build(), x, y, z, face)

    def seconds_at(t):
        return 9 - min(7, int(t * 8))  # 0:59 → 0:52

    on_face("bomb_timer_panel", lambda p: p.box(0.12, 0.07, 0.006, 0, -0.035, 0, "black"), 0, 0.165)
    for position, (digit_x, digit_at) in enumerate(((-0.035, lambda t: 0), (0.005, lambda t: 5), (0.04, seconds_at))):
        seven_segment(col, f"bomb_digit{position}", face, digit_x, 0.165, 0.006, digit_at, loop)
    for cy in (0.172, 0.158):
        on_face(f"bomb_colon_{cy}", lambda p: p.box(0.004, 0.004, 0.004, 0, -0.002, 0, "lens"), -0.017, cy, 0.006)

    # Strike lights above the timer: the first strike at 1.5 s
    for i, x in enumerate((-0.012, 0.012)):
        base = on_face(f"bomb_strike_base_{i}", lambda p: p.cylinder(0.007, 0.004, 0, 0, 0, "black", segments=8, rot=(math.pi / 2, 0, 0), centered=True), x, 0.205, 0.004)
        light = on_face(f"bomb_strike_{i}", lambda p: p.cylinder(0.007, 0.005, 0, 0, 0, "lens", segments=8, rot=(math.pi / 2, 0, 0), centered=True), x, 0.205, 0.006)
        visible(light, lambda t, i=i: i == 0 and 0.19 < t < 0.97, loop)

    # Wires module (top left): five wires, the red one is cut at 4 s
    wire_colors = ("paper", "accent", "ui_blue", "black", "ui_amber")
    for i, material in enumerate(wire_colors):
        y = 0.205 - i * 0.019
        for x in (-0.205, -0.095):
            on_face(f"bomb_wire_post_{i}_{x}", lambda p: p.box(0.008, 0.01, 0.01, 0, -0.005, 0, "steel"), x, y, 0.005)
        if material != "accent":
            on_face(f"bomb_wire_{i}", lambda p, m=material: p.box(0.1, 0.006, 0.006, 0, -0.003, 0, m), -0.15, y, 0.012)
            continue
        # the cut wire: two halves hinged at their posts, swinging down when cut
        for half, (hx, direction) in enumerate(((-0.205, 1), (-0.095, -1))):
            obj = on_face(f"bomb_wire_cut_{half}", lambda p, d=direction: p.box(0.05, 0.006, 0.006, d * 0.025, -0.003, 0, "accent"), hx, y, 0.012)
            sampled(obj, lambda t, d=direction: {"rot": (0, 0, -d * 0.9 * min(1.0, max(0.0, (t - 0.5) / 0.04)) if t < 0.97 else 0.0)}, loop, 1)
    wires_led = on_face("bomb_wires_led", lambda p: p.sphere(0.008, 0, 0, 0, "ui_green", subdivisions=1), -0.088, 0.215, 0.006)
    visible(wires_led, lambda t: 0.52 < t < 0.97, loop)

    # Button module (top right): a big red button, pressed at 2.5 s, with a strip that lights up
    on_face("bomb_button_ring", lambda p: p.cylinder(0.042, 0.008, 0, 0, 0, "black", segments=16, rot=(math.pi / 2, 0, 0), centered=True), 0.15, 0.175, 0.004)
    button = on_face("bomb_button", lambda p: p.cylinder(0.035, 0.018, 0, 0, 0.009, "accent", segments=16, rot=(math.pi / 2, 0, 0), centered=True), 0.15, 0.175, 0.006)
    sampled(button, lambda t: {"loc": (0.15, 0.175, 0.006 - (0.008 if 0.3 < t < 0.36 else 0.0))}, loop, 1)
    strip = on_face("bomb_button_strip", lambda p: p.box(0.012, 0.05, 0.006, 0, -0.025, 0, "ui_blue"), 0.21, 0.17, 0.006)
    visible(strip, lambda t: 0.3 < t < 0.97, loop)

    # Simon Says (bottom middle): four coloured pads flashing a sequence
    pads = [("accent", -0.022, 0.022), ("ui_blue", 0.022, 0.022), ("ui_green", -0.022, -0.022), ("ui_amber", 0.022, -0.022)]
    sequence = [0, 2, 1, 3, 0, 1]
    for index, (material, px, py) in enumerate(pads):
        on_face(f"bomb_pad_{index}", lambda p: p.box(0.036, 0.036, 0.006, 0, -0.018, 0, "black"), px, 0.03 + py, 0.004)
        flash = on_face(f"bomb_pad_light_{index}", lambda p, m=material: p.box(0.032, 0.032, 0.006, 0, -0.016, 0, m), px, 0.03 + py, 0.007)
        visible(flash, lambda t, index=index: sequence[int(t * 12) % len(sequence)] == index and (t * 12) % 1 < 0.6, loop)

    # Keypad (bottom left) and a spare module with a green light (bottom right)
    for kx in (-0.17, -0.13):
        for ky in (0.05, 0.01):
            on_face(f"bomb_key_{kx}_{ky}", lambda p: p.box(0.03, 0.03, 0.012, 0, -0.015, 0, "paper", bevel=0.003), kx, ky, 0.005)
    done = on_face("bomb_done_led", lambda p: p.sphere(0.01, 0, 0, 0, "ui_green", subdivisions=1), 0.15, 0.03, 0.008)
    visible(done, lambda t: 0.8 < t < 0.97, loop)
    return {"turntable": 0, "fit": 1}


def item_kitchenapp(col):
    """KitchenApp: a stock-management program on a monitor. A grid of products with stock bars
    that go up and down, a selection that moves over the products, and a new product appearing."""
    loop = 192  # 8 seconds
    monitor = Part("stock_monitor", col)
    monitor.box(0.14, 0.012, 0.1, 0, 0, 0, "black", bevel=0.004)  # foot
    monitor.box(0.03, 0.14, 0.02, 0, 0.012, -0.02, "black")  # neck
    monitor.box(0.56, 0.35, 0.025, 0, 0.13, 0, "black", bevel=0.006)  # bezel
    monitor.box(0.53, 0.32, 0.004, 0, 0.145, 0.013, "screen")
    monitor.box(0.53, 0.032, 0.004, 0, 0.433, 0.0145, "lens")  # header bar of the app
    monitor.box(0.09, 0.27, 0.004, -0.22, 0.155, 0.0145, "ui_tile")  # side menu
    for i in range(5):
        monitor.box(0.06, 0.012, 0.004, -0.22, 0.39 - i * 0.045, 0.016, "black")
    screen = place(monitor.build(), 0, 0, 0)

    face = bpy.data.objects.new("stock_face", None)
    col.objects.link(face)
    place(face, 0, 0, 0.018, screen)

    # Product cards in a 4 × 3 grid; each has an "icon" and a stock bar
    icons = ("ui_amber", "ui_green", "accent", "ui_blue")
    # The app area of the screen: right of the side menu, below the header bar
    columns, rows, gap = 4, 3, 0.01
    area_left, area_right, area_top, area_bottom = -0.165, 0.255, 0.422, 0.158
    card_w = (area_right - area_left - gap * (columns - 1)) / columns
    card_h = (area_top - area_bottom - gap * (rows - 1)) / rows

    def card_pos(index):
        """Centre x and top y of a card."""
        return area_left + card_w / 2 + (index % columns) * (card_w + gap), area_top - (index // columns) * (card_h + gap)

    levels = [0.8, 0.35, 0.6, 0.15, 0.9, 0.5, 0.7, 0.25, 0.45, 0.85, 0.3, 0.6]
    for index in range(columns * rows):
        cx, cy = card_pos(index)
        card = Part(f"stock_card_{index}", col)
        card.box(card_w, card_h, 0.003, 0, -card_h, 0, "ui_tile")
        material = icons[index % len(icons)]
        if index % 3 == 0:
            card.cylinder(0.014, 0.004, 0, -0.032, 0.002, material, segments=10, rot=(math.pi / 2, 0, 0), centered=True)
        elif index % 3 == 1:
            card.box(0.024, 0.024, 0.004, 0, -0.044, 0.002, material)
        else:
            card.extruded([(-0.014, -0.046), (0.014, -0.046), (0, -0.02)], 0.004, 0, 0, 0.002, material)
        card.box(card_w - 0.02, 0.008, 0.003, 0, -card_h + 0.01, 0.002, "black")  # empty stock bar
        obj = place(card.build(), cx, cy, 0.0, face)
        if index == columns * rows - 1:  # the newest product pops in halfway and leaves at the end
            sampled(obj, lambda t: {"scale": 0.0001 if t < 0.5 or t > 0.97 else min(1.0, (t - 0.5) / 0.04)}, loop, 1)
        # Stock bar: a fill that changes over time (sold, restocked); red when almost empty
        bar = Part(f"stock_bar_{index}", col)
        low = levels[index] < 0.3
        bar_w = card_w - 0.02
        bar.box(bar_w, 0.008, 0.004, bar_w / 2, -0.004, 0, "accent" if low else "ui_green")
        bar_obj = place(bar.build(), cx - bar_w / 2, cy - card_h + 0.014, 0.004, face)
        base = levels[index]

        def fill(t, base=base, index=index):
            if index == columns * rows - 1 and (t < 0.5 or t > 0.97):
                return 0.0001
            wave = 0.18 * math.sin(t * math.tau * (1 + index % 3) + index)
            restock = 0.4 if index == 3 and 0.62 < t < 0.97 else 0.0  # the empty one gets restocked
            return max(0.05, min(1.0, base + wave + restock))

        for frame in range(1, loop + 2, 4):
            t = (frame - 1) / loop
            bar_obj.scale = (fill(t), 1, 1)
            bar_obj.keyframe_insert("scale", frame=frame)
        bar_obj.scale = (fill(1.0), 1, 1)
        bar_obj.keyframe_insert("scale", frame=loop + 1)

    # Selection frame hopping from product to product
    select = Part("stock_select", col)
    t_ = 0.004
    for sx, sy, sw, sh in ((0, 0, card_w + 0.01, t_), (0, -card_h - 0.01, card_w + 0.01, t_),
                           (-(card_w + 0.01) / 2, -(card_h + 0.01) / 2, t_, card_h + 0.01), ((card_w + 0.01) / 2, -(card_h + 0.01) / 2, t_, card_h + 0.01)):
        select.box(sw, sh, 0.004, sx, sy + 0.005 - sh / 2, 0, "lens")
    select_obj = place(select.build(), *card_pos(0), 0.006, face)
    stops = [0, 5, 3, 10, 6, 1, 11, 0]

    def selection(t):
        position = t * (len(stops) - 1)
        i = min(int(position), len(stops) - 2)
        u = min(1.0, (position - i) / 0.25)  # jump quickly, then rest
        a, b = card_pos(stops[i]), card_pos(stops[i + 1])
        u = u * u * (3 - 2 * u)
        return {"loc": (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 0.006)}

    sampled(select_obj, selection, loop, 2)
    return {"turntable": 0, "fit": 1}


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
    return {"scale": 0.6}


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
    scene.frame_start, scene.frame_end = 1, 193
    # Keys are sampled densely, so straight lines between them keep loops and spins even
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    for slug, build in ITEM_BUILDERS.items():
        col = new_collection(f"item_{slug}")
        settings = build(col) or {}
        # A root holding the item's settings for the site (exported as glTF "extras"):
        # turntable = slowly turn on the tray, fit = scale to fit the tray. Edit them in Blender
        # (Object properties → Custom Properties on item_root) if you change an item.
        top_level = [obj for obj in col.objects if obj.parent is None]
        root = bpy.data.objects.new(f"item_root_{slug}", None)
        col.objects.link(root)
        root["turntable"] = settings.get("turntable", 1)
        root["fit"] = settings.get("fit", 1)
        root["scale"] = settings.get("scale", 1.0)  # size on the tray, after fitting (1 = as large as fits)
        for obj in top_level:
            obj.parent = root
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
    # Line arrays on "PA wings": a short truss out from each front corner, a bumper on two chain
    # hoists, and eight wedge-shaped cabinets hinged at their front edges. Each cabinet tilts a
    # little more than the one above, so the front is convex (the "banana"): the top cabinets throw
    # to the back of the field, the bottom ones down to the front rows. Arrays are toed in slightly.
    cabinet_h, cabinet_d, width = 0.36, 0.62, 0.95
    splays = [1.0, 1.0, 1.5, 2.0, 3.0, 4.5, 6.0, 8.0]  # degrees between neighbouring cabinets
    toe = 0.14  # radians towards the middle of the field
    for side in (-1, 1):
        x, front = side * 8.9, 3.6 + cabinet_d / 2
        theta = -side * toe
        rot_array = (0, -math.pi / 2 + theta, 0)  # outline (u forward, v up) → the side plane of the array
        # PA wing: truss from the stage corner block out to a new corner block above the array
        inner, outer = side * 7.6, side * 10.2
        truss_span(pa, (min(inner, outer), top, 3.6), (max(inner, outer), top, 3.6), "x")
        truss_node(pa, (outer, top, 3.6))
        bumper_y = 8.35
        pa.box(1.1, 0.1, 0.8, x, bumper_y, 3.6, "steel", rot=(0, theta, 0))
        for dx in (-0.35, 0.35):
            hx = x + dx * math.cos(theta)
            pa.box(0.22, 0.26, 0.22, hx, bumper_y + 0.12, 3.6, "black")  # chain hoist
            pa.beam((hx, bumper_y + 0.38, 3.6), (hx, top - 0.2, 3.6), 0.025, "black", round_=True, segments=4, caps=False)
        # Hinge chain in the side plane: u = forward from the array's front line, v = height
        hinge_u, hinge_v, angle = 0.0, bumper_y - 0.05, math.radians(2.0)
        for i, splay in enumerate(splays):
            if i:
                angle += math.radians(splay)
            down = (-math.sin(angle), -math.cos(angle))  # along the front face, top → bottom (u, v)
            back = (-math.cos(angle), math.sin(angle))   # from the face into the cabinet
            top_front = (hinge_u, hinge_v)
            bottom_front = (hinge_u + down[0] * cabinet_h, hinge_v + down[1] * cabinet_h)
            taper = 0.05  # the back of the cabinet is a little lower than the front: a wedge
            top_back = (top_front[0] + back[0] * cabinet_d + down[0] * taper / 2, top_front[1] + back[1] * cabinet_d + down[1] * taper / 2)
            bottom_back = (bottom_front[0] + back[0] * cabinet_d - down[0] * taper / 2, bottom_front[1] + back[1] * cabinet_d - down[1] * taper / 2)
            outline = [bottom_front, top_front, top_back, bottom_back]
            pa.extruded(outline, width, x, 0, front, "black", rot=rot_array)
            # Grille: a slightly smaller panel just in front of the face
            inset, proud = 0.03, 0.012
            grille = [
                (bottom_front[0] - back[0] * proud - down[0] * inset, bottom_front[1] - back[1] * proud - down[1] * inset),
                (top_front[0] - back[0] * proud + down[0] * inset, top_front[1] - back[1] * proud + down[1] * inset),
                (top_front[0] + down[0] * inset, top_front[1] + down[1] * inset),
                (bottom_front[0] - down[0] * inset, bottom_front[1] - down[1] * inset),
            ]
            pa.extruded(grille, width - 0.08, x, 0, front, "deck", rot=rot_array)
            hinge_u, hinge_v = bottom_front
    # Subwoofers on the ground in front of the stage
    for x in (-5.5, -4.4, 4.4, 5.5):
        pa.box(1.05, 0.75, 0.9, x, 0, 4.7, "black", bevel=0.02)
        pa.box(0.85, 0.55, 0.02, x, 0.1, 5.16, "deck")
    pa.build()

    screens = Part("stage_screens", col)
    # Side screens (IMAG) left and right of the stage, turned towards the field. The picture is
    # drawn by the site (src/world/stageScreens.ts, SIDE_SCREENS); these are the frames and stands.
    for side in (-1, 1):
        cx, cz, turn = side * 11.55, 2.6, -side * 0.12
        ux, uz = math.cos(turn), -math.sin(turn)  # along the screen (three.js: +x rotated by turn)
        screens.box(4.0, 2.4, 0.16, cx, 5.4, cz, "black", rot=(0, turn, 0), centered=True, bevel=0.02)
        for edge in (-1, 1):
            lx, lz = cx + ux * edge * 1.85, cz + uz * edge * 1.85
            bx, bz = lx - math.sin(turn) * -0.3, lz - math.cos(turn) * 0.3
            truss(screens, (bx, 0.05, bz), "y", 6.85, size=0.3)
            screens.box(0.9, 0.05, 0.9, bx, 0, bz, "steel", rot=(0, turn, 0))
            screens.box(0.7, 0.3, 0.7, bx, 0.05, bz, "black", rot=(0, turn, 0), bevel=0.02)
        screens.beam((cx - ux * 1.85 - math.sin(turn) * -0.3, 6.95, cz - uz * 1.85 - math.cos(turn) * 0.3),
                     (cx + ux * 1.85 - math.sin(turn) * -0.3, 6.95, cz + uz * 1.85 - math.cos(turn) * 0.3), 0.3, "metal")
    screens.build()

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


# --- Terrain ---------------------------------------------------------------------------------
# Everything around the places, in world coordinates (three.js space, like places.ts): the grass
# field with hills beyond the fence, trackway paths, the perimeter fence, trees, festoon lights,
# light towers and picnic tables. Purely decorative: nothing here is clickable.
# Keep the space in front of every booth, the stage and the FOH free (see places.ts).

FIELD = {"x": 24.0, "z_min": -26.0, "z_max": 27.0}  # inside the fence


def rand(seed):
    """Deterministic pseudo-random 0…1, so rebuilding gives the same terrain."""
    return (math.sin(seed * 12.9898) * 43758.5453) % 1.0


def ground_height(x, z):
    """Flat inside the fence, rising into low hills outside it."""
    dx = max(abs(x) - FIELD["x"] - 2, 0.0)
    dz = max(FIELD["z_min"] - 2 - z, z - FIELD["z_max"] - 2, 0.0)
    distance = math.hypot(dx, dz)
    if distance <= 0:
        return 0.0
    rise = min(distance / 22.0, 1.0)
    rise = rise * rise * (3 - 2 * rise)  # smoothstep
    bumps = 1.2 * math.sin(x * 0.11) * math.cos(z * 0.09) + 0.8 * math.sin((x + z) * 0.07)
    return rise * (7.0 + bumps)


def build_ground(col):
    part = Part("terrain_ground", col)
    size, step = 150.0, 3.0  # smooth-shaded: soft hills, and far fewer vertices in the file
    count = int(size / step)

    def create(bm):
        verts = []
        for j in range(count + 1):
            row = []
            for i in range(count + 1):
                x = -size / 2 + i * step
                z = -size / 2 + j * step
                row.append(bm.verts.new(C @ Vector((x, ground_height(x, z), z))))
            verts.append(row)
        for j in range(count):
            for i in range(count):
                bm.faces.new((verts[j][i], verts[j + 1][i], verts[j + 1][i + 1], verts[j][i + 1]))
        return {"verts": [v for row in verts for v in row]}

    part._add(create, "grass", smooth=True)
    part.build()


def build_trackway(col):
    """Ground protection plates: the main path from the entrance to the FOH, and two cross paths."""
    part = Part("terrain_trackway", col)
    plate = 2.35  # plates with small gaps, like the interlocking panels at real festivals

    def path(x0, z0, x1, z1, width):
        length = math.hypot(x1 - x0, z1 - z0)
        angle = math.atan2(x1 - x0, z1 - z0)
        count = max(1, round(length / plate))
        for k in range(count):
            t = (k + 0.5) / count
            x, z = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
            part.box(width, 0.035, length / count - 0.06, x, 0.0, z, "trackway", rot=(0, angle, 0))

    path(0, 21.5, 0, 6.6, 3.0)       # entrance → FOH steps
    path(-9.5, 8.6, 9.5, 8.6, 2.4)   # between Lab and Merch
    path(-9.5, -2.2, 9.5, -2.2, 2.4)  # between the stage and the FOH, towards Projects and Links
    part.build()


def build_perimeter(col):
    """Construction fence around the field, joining the fences at the entrance."""
    part = Part("terrain_fence", col)
    x, z0, z1 = FIELD["x"], FIELD["z_min"], 22.0

    def run(ax, az, bx, bz):
        length = math.hypot(bx - ax, bz - az)
        count = max(1, round(length / 3.5))
        for k in range(count):
            t0, t1 = k / count, (k + 1) / count - 0.01
            p0 = (ax + (bx - ax) * t0, az + (bz - az) * t0)
            p1 = (ax + (bx - ax) * t1, az + (bz - az) * t1)
            for y in (0.15, 2.0):
                part.beam((p0[0], y, p0[1]), (p1[0], y, p1[1]), 0.04, "metal", round_=True, segments=4, caps=False)
            for t in (0.0, 1.0):
                px, pz = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t
                part.beam((px, 0.15, pz), (px, 2.0, pz), 0.04, "metal", round_=True, segments=4, caps=False)
            for w in range(1, 5):
                t = w / 5
                px, pz = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t
                part.beam((px, 0.15, pz), (px, 2.0, pz), 0.014, "metal", round_=True, segments=3, caps=False)
            part.box(0.6, 0.14, 0.2, p0[0], 0, p0[1], "black", rot=(0, math.atan2(bx - ax, bz - az), 0))

    run(-15.0, z1, -x, z1)
    run(-x, z1, -x, z0)
    run(-x, z0, x, z0)
    run(x, z0, x, z1)
    run(x, z1, 15.0, z1)
    part.build()


def build_trees(col):
    """Low-poly pines outside the fence: silhouettes against the sky."""
    part = Part("terrain_trees", col)
    placed = 0
    seed = 1
    while placed < 70 and seed < 2000:
        seed += 1
        x = -62 + rand(seed) * 124
        z = -62 + rand(seed + 0.5) * 128
        inside = abs(x) < FIELD["x"] + 3 and FIELD["z_min"] - 3 < z < FIELD["z_max"] + 5
        if inside or math.hypot(x, z - 2) > 66:
            continue
        # keep the view past the entrance (the overview camera) clear
        if abs(x) < 14 and z > 20:
            continue
        height = 4.5 + rand(seed + 0.25) * 4.5
        y = ground_height(x, z) - 0.2
        part.cylinder(0.12, height * 0.25, x, y, z, "wood_dark", segments=4, caps=False)
        for layer in range(3):
            radius = height * (0.34 - layer * 0.08)
            part.cylinder(radius, height * 0.42, x, y + height * (0.2 + layer * 0.22), z, "pine", segments=7, radius_top=0.02, caps=False)
        placed += 1
    part.build()


def build_festoons(col):
    """Festoon lights: wooden poles with single strings of warm bulbs, straight across the main
    path, fanning out over the picnic tables, and from the FOH tent to the path and the tables.
    The extra poles stand outside the views of the booths (see the cameras in world.ts)."""
    part = Part("terrain_festoons", col)
    path_poles = [(side * 2.6, z) for z in (20.0, 15.0, 10.0) for side in (-1, 1)]
    table_poles = [(side * 9.0, 16.2) for side in (-1, 1)] + [(side * 7.6, 0.5) for side in (-1, 1)]
    for x, z in path_poles + table_poles:
        part.cylinder(0.07, 4.6, x, 0, z, "wood_dark", segments=6)
        part.box(0.3, 0.12, 0.3, x, 0, z, "black")

    def string(a, b, sag=0.55, heights=(4.4, 4.4)):
        (ax, az), (bx, bz) = a, b
        length = math.hypot(bx - ax, bz - az)
        bulbs = max(6, round(length / 0.5))
        points = []
        for k in range(bulbs + 1):
            t = k / bulbs
            y = heights[0] + (heights[1] - heights[0]) * t - sag * 4 * t * (1 - t)
            points.append((ax + (bx - ax) * t, y, az + (bz - az) * t))
        for p0, p1 in zip(points, points[1:]):
            part.beam(p0, p1, 0.014, "black", round_=True, segments=3, caps=False)
        for p in points[1:-1]:
            part.sphere(0.06, p[0], p[1] - 0.08, p[2], "bulb", subdivisions=1)

    for z in (20.0, 15.0, 10.0):  # straight across the main path
        string((-2.6, z), (2.6, z))
    for side in (-1, 1):
        outer = (side * 9.0, 16.2)
        for z in (20.0, 15.0, 10.0):  # over the picnic tables beside the path
            string((side * 2.6, z), outer, sag=0.7)
        # From the FOH tent (pole tops at 3.9 m, tent at z 3 ± 1.8) to the path and the tables
        tent_back, tent_front = (side * 2.3, 4.8), (side * 2.3, 1.2)
        string(tent_back, (side * 2.6, 10.0), sag=0.6, heights=(3.8, 4.4))
        string(tent_front, (side * 7.6, 0.5), sag=0.6, heights=(3.8, 4.4))
    part.build()


def build_light_towers(col):
    """Two scaffold towers with floodlights at the back corners, beside the stage."""
    part = Part("terrain_light_towers", col)
    for side in (-1, 1):
        x, z = side * 17.5, -20.0
        truss(part, (x, 0.05, z), "y", 7.5, size=0.8)
        part.box(1.4, 0.05, 1.4, x, 0, z, "steel")
        part.box(1.4, 0.08, 1.4, x, 7.55, z, "steel")
        for i in range(4):
            fx = x + (-0.45 + i * 0.3)
            part.box(0.24, 0.24, 0.2, fx, 7.7, z + 0.3, "black", rot=(0.35, -side * 0.5, 0))
            part.box(0.18, 0.18, 0.02, fx - side * 0.05, 7.72, z + 0.42, "bulb", rot=(0.35, -side * 0.5, 0))
    part.build()


def build_picnic(col):
    """Beer tables and benches between the booths and the main path."""
    part = Part("terrain_picnic", col)
    for x, z, turn in ((-6.2, 13.0, 0.1), (-6.8, 17.5, -0.05), (6.2, 14.0, -0.1), (6.8, 18.5, 0.05), (-6.0, 1.8, 0.2), (6.3, 3.6, -0.15)):
        for dz, w, h in ((0.0, 0.7, 0.76), (-0.62, 0.28, 0.46), (0.62, 0.28, 0.46)):
            ox, oz = dz * math.sin(turn), dz * math.cos(turn)
            part.box(2.2, 0.04, w, x + ox, h - 0.04, z + oz, "wood", rot=(0, turn, 0))
            for lx in (-0.85, 0.85):
                px, pz = x + ox + lx * math.cos(turn), z + oz - lx * math.sin(turn)
                part.box(0.04, h - 0.04, w * 0.8, px, 0, pz, "steel", rot=(0, turn, 0))
        part.cylinder(0.25, 0.9, x + 1.7, 0, z + 0.2, "black", segments=8)  # bin
    part.build()


def build_terrain():
    col = new_collection("terrain")
    build_ground(col)
    build_trackway(col)
    build_perimeter(col)
    build_trees(col)
    build_festoons(col)
    build_light_towers(col)
    build_picnic(col)


# --- Crowd -----------------------------------------------------------------------------------
# Three kinds of festival-goer, each one object standing at the origin, facing +z (three.js).
# The site places a small audience in front of the stage with instancing (src/world/crowd.ts),
# and lets it move with the music.


def person(col, name, arms):
    part = Part(name, col)
    for x in (-0.09, 0.09):
        part.box(0.13, 0.86, 0.15, x, 0, 0, "crowd")
    part.box(0.4, 0.6, 0.22, 0, 0.84, 0, "crowd", bevel=0.03)
    part.cylinder(0.05, 0.1, 0, 1.43, 0, "crowd", segments=6)
    part.sphere(0.11, 0, 1.62, 0, "crowd", subdivisions=2)
    for side, pose in zip((-1, 1), arms):
        shoulder = (side * 0.25, 1.36, 0)
        if pose == "down":
            part.box(0.1, 0.6, 0.11, side * 0.26, 0.8, 0.0, "crowd", rot=(0, 0, side * 0.08))
        elif pose == "up":
            part.beam(shoulder, (side * 0.42, 2.02, 0.08), 0.1, "crowd")
        elif pose == "phone":
            part.beam(shoulder, (side * 0.2, 1.95, 0.2), 0.1, "crowd")
            part.box(0.08, 0.14, 0.015, side * 0.18, 1.96, 0.24, "black", rot=(-0.3, 0, 0))
    obj = part.build()
    return obj


def build_crowd():
    col = new_collection("crowd")
    person(col, "person_relaxed", ("down", "down"))
    person(col, "person_hands_up", ("up", "up"))
    person(col, "person_phone", ("down", "phone"))


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
    build_terrain()
    build_crowd()
    build_items()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print(f"Saved {BLEND_PATH}")

    sys.path.insert(0, HERE)
    import export_models

    export_models.export_all()


main()
