#!/usr/bin/env python3
"""Draw the chart symbol sheet the style references.

These are original marks sized for a screen chart: IALA-B buoy shapes and
the S-52 day colours, not copies of the IHO symbol artwork. Requires Pillow.
Writes packages/s57/public/s57 and mirrors it to the client public folder.
"""
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "s57"
CLIENT = ROOT.parents[1] / "packages" / "client" / "public" / "s57"

RED = (241, 84, 105, 255)
GREEN = (72, 196, 78, 255)
YELLOW = (244, 210, 64, 255)
BLACK = (12, 12, 12, 255)
MAGENTA = (197, 69, 195, 255)
WHITE = (255, 255, 255, 255)
LIGHT_YELLOW = (244, 210, 64, 255)
BROWN = (120, 98, 60, 255)
GREY = (96, 104, 110, 255)
NONE = (0, 0, 0, 0)

CELL = 64
SUPERSAMPLE = 4
S = CELL * SUPERSAMPLE

NAMES = [
    "rock",
    "rock-awash",
    "wreck",
    "obstruction",
    "buoy-red-can",
    "buoy-green-can",
    "buoy-red-cone",
    "buoy-green-cone",
    "buoy-red-pillar",
    "buoy-green-pillar",
    "buoy-special",
    "buoy-safe",
    "buoy-isolated",
    "buoy-north",
    "buoy-east",
    "buoy-south",
    "buoy-west",
    "beacon-red",
    "beacon-green",
    "beacon-special",
    "light",
    "daymark",
    "daymark-red",
    "daymark-green",
    "daymark-yellow",
    "platform",
    "mooring",
    "light-red",
    "light-green",
    "light-yellow",
    "fog",
    "anchor",
    "kelp",
    "kelp-pattern",
    "building",
    "tank",
    "landmark",
    "landmark-tower",
    "landmark-chimney",
    "landmark-mast",
    "landmark-dome",
    "landmark-windmill",
    "landmark-spire",
    "landmark-monument",
    "spot-height",
    "slope",
    "sand-waves",
    "sand-waves-pattern",
    "traffic-arrow",
    "topmark-cone-up",
    "topmark-cone-down",
    "topmark-sphere",
    "topmark-spheres",
    "topmark-can",
    "topmark-board",
    "topmark-x",
    "topmark-cross",
    "topmark-diamond",
    "topmark-cones-in",
    "topmark-cones-out",
    "topmark-cones-up",
    "topmark-cones-down",
]


# Seabed textures cover wide areas, so they repeat at twice the icon cell.
LARGE = {"sand-waves-pattern", "kelp-pattern"}
FAINT = (96, 104, 110, 150)


def new(size=S):
    image = Image.new("RGBA", (size, size), NONE)
    return image, ImageDraw.Draw(image)


def ring(draw, box, fill, outline, width):
    draw.ellipse(box, fill=fill, outline=outline, width=width)


def stripes(box, colors):
    """Vertical bands clipped to a circle."""
    canvas = Image.new("RGBA", (S, S), NONE)
    paint = ImageDraw.Draw(canvas)
    x0, y0, x1, y1 = box
    band = (x1 - x0) / len(colors)
    for index, color in enumerate(colors):
        paint.rectangle([x0 + band * index, y0, x0 + band * (index + 1), y1], fill=color)
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).ellipse(box, fill=255)
    out = Image.new("RGBA", (S, S), NONE)
    out.paste(canvas, mask=mask)
    return out


def cones(draw, apex_up, cx, top, width, height, gap):
    """Two stacked cones, the cardinal topmark."""
    for index in range(2):
        y = top + index * (height + gap)
        if apex_up:
            draw.polygon([(cx, y), (cx - width, y + height), (cx + width, y + height)], fill=BLACK)
        else:
            draw.polygon([(cx - width, y), (cx + width, y), (cx, y + height)], fill=BLACK)


def pillar(draw, box, top, bottom):
    x0, y0, x1, y1 = box
    mid = (y0 + y1) / 2
    radius = (x1 - x0) * 0.22
    draw.rounded_rectangle(box, radius=radius, fill=bottom, outline=BLACK, width=10)
    # Cover the top half, then redraw the outline so the join stays crisp.
    draw.rounded_rectangle([x0, y0, x1, mid + radius], radius=radius, fill=top)
    draw.rectangle([x0 + 8, mid, x1 - 8, mid + radius], fill=top)
    draw.rounded_rectangle(box, radius=radius, outline=BLACK, width=10)
    draw.line([(x0 + 6, mid), (x1 - 6, mid)], fill=BLACK, width=6)


def draw_rock(draw):
    c = S / 2
    draw.line([(c, 70), (c, S - 70)], fill=BLACK, width=22)
    draw.line([(70, c), (S - 70, c)], fill=BLACK, width=22)


def draw_rock_awash(draw):
    ring(draw, [48, 48, S - 48, S - 48], NONE, BLACK, 12)
    c = S / 2
    draw.line([(c, 96), (c, S - 96)], fill=BLACK, width=18)
    draw.line([(96, c), (S - 96, c)], fill=BLACK, width=18)


def draw_wreck(draw):
    # Dotted ring, hull across the middle.
    box = [36, 36, S - 36, S - 36]
    for step in range(18):
        start = step * 20
        draw.arc(box, start=start, end=start + 10, fill=BLACK, width=10)
    draw.polygon(
        [(70, 150), (110, 118), (150, 108), (186, 150), (150, 168), (110, 168)],
        fill=BLACK,
    )


def draw_obstruction(draw):
    box = [40, 40, S - 40, S - 40]
    for step in range(16):
        start = step * 22.5
        draw.arc(box, start=start, end=start + 11, fill=MAGENTA, width=12)


def draw_buoy_can(draw, fill):
    draw.rounded_rectangle([78, 48, 178, 208], radius=28, fill=fill, outline=BLACK, width=12)


def draw_buoy_cone(draw, fill):
    draw.polygon([(128, 40), (58, 214), (198, 214)], fill=fill)
    draw.line([(128, 40), (58, 214), (198, 214), (128, 40)], fill=BLACK, width=12, joint="curve")


def draw_buoy_pillar(draw, fill):
    # Tall and narrow with a pointed head, as INT 1 Q22.
    outline = [(100, 226), (108, 70), (128, 30), (148, 70), (156, 226)]
    draw.polygon(outline, fill=fill)
    draw.line(outline + [outline[0]], fill=BLACK, width=12, joint="curve")


def draw_buoy_special(draw):
    draw.rounded_rectangle([78, 52, 178, 204], radius=26, fill=YELLOW, outline=BLACK, width=12)
    draw.line([(100, 86), (156, 170)], fill=BLACK, width=12)
    draw.line([(156, 86), (100, 170)], fill=BLACK, width=12)


def draw_buoy_safe(base):
    image, draw = base
    banded = stripes([44, 44, S - 44, S - 44], [RED, WHITE, RED, WHITE, RED])
    image.alpha_composite(banded)
    draw.ellipse([44, 44, S - 44, S - 44], outline=BLACK, width=12)
    return image


def draw_buoy_isolated(draw):
    draw.ellipse([108, 18, 148, 58], fill=BLACK)
    draw.ellipse([108, 66, 148, 106], fill=BLACK)
    draw.ellipse([58, 112, 198, 236], fill=BLACK)
    draw.rectangle([70, 156, 186, 184], fill=RED)


def draw_buoy_north(draw):
    cones(draw, True, 128, 8, 28, 32, 4)
    pillar(draw, [86, 88, 170, 236], BLACK, YELLOW)


def draw_buoy_south(draw):
    pillar(draw, [86, 16, 170, 164], YELLOW, BLACK)
    cones(draw, False, 128, 176, 28, 32, 4)


def draw_buoy_east(draw):
    cones(draw, True, 128, 6, 26, 28, 2)
    cones(draw, False, 128, 36, 26, 28, 0)
    pillar(draw, [90, 100, 166, 240], BLACK, BLACK)
    draw.rectangle([100, 150, 156, 190], fill=YELLOW)


def draw_buoy_west(draw):
    cones(draw, False, 128, 6, 26, 26, 0)
    cones(draw, True, 128, 34, 26, 26, 0)
    pillar(draw, [90, 100, 166, 240], YELLOW, YELLOW)
    draw.rectangle([100, 150, 156, 190], fill=BLACK)


def draw_beacon_green(draw):
    # IALA-B port-hand daybeacon: green square.
    draw.line([(128, 230), (128, 108)], fill=BLACK, width=12)
    draw.rectangle([78, 36, 178, 120], fill=GREEN, outline=BLACK, width=12)


def draw_beacon_red(draw):
    # IALA-B starboard-hand daybeacon: red triangle.
    draw.line([(128, 236), (128, 130)], fill=BLACK, width=12)
    draw.polygon([(128, 28), (70, 140), (186, 140)], fill=RED)
    draw.line([(128, 28), (70, 140), (186, 140), (128, 28)], fill=BLACK, width=12, joint="curve")


def draw_beacon_special(draw):
    draw.line([(128, 240), (128, 140)], fill=BLACK, width=12)
    draw.polygon([(128, 24), (196, 100), (128, 176), (60, 100)], fill=YELLOW, outline=BLACK)
    draw.line([(128, 24), (196, 100), (128, 176), (60, 100), (128, 24)], fill=BLACK, width=10, joint="curve")
    draw.line([(92, 72), (164, 140)], fill=BLACK, width=8)
    draw.line([(164, 72), (92, 140)], fill=BLACK, width=8)


def draw_light(draw, fill=MAGENTA):
    # Position dot at the centre. The flare reaches up and to the right.
    draw.polygon([(150, 118), (214, 36), (236, 78), (168, 146)], fill=fill, outline=BLACK)
    draw.ellipse([196, 28, 244, 76], fill=fill, outline=BLACK, width=4)
    draw.ellipse([104, 104, 152, 152], fill=BLACK)


def draw_fog(draw):
    # Three arcs fanning out from the position, as INT 1 R10.
    for radius in (60, 92, 124):
        box = [128 - radius, 128 - radius, 128 + radius, 128 + radius]
        draw.arc(box, start=200, end=250, fill=MAGENTA, width=12)


def draw_anchor(draw):
    draw.ellipse([108, 28, 148, 68], outline=MAGENTA, width=12)
    draw.line([(128, 68), (128, 220)], fill=MAGENTA, width=14)
    draw.line([(84, 96), (172, 96)], fill=MAGENTA, width=12)
    draw.arc([56, 120, 200, 224], start=20, end=160, fill=MAGENTA, width=14)
    draw.polygon([(56, 160), (44, 196), (80, 184)], fill=MAGENTA)
    draw.polygon([(200, 160), (212, 196), (176, 184)], fill=MAGENTA)


def kelp_frond(draw, x, y, scale, fill=BLACK):
    import math
    points = []
    for step in range(41):
        t = step / 40
        points.append((x + 16 * scale * math.sin(t * math.pi * 3), y - 170 * scale * t))
    draw.line(points, fill=fill, width=max(6, int(9 * scale)), joint="curve")


def draw_kelp(draw):
    for x in (84, 128, 172):
        kelp_frond(draw, x, 220, 1)


def draw_kelp_pattern(draw):
    # A large tile with two small fronds, so a kelp bed reads as a scatter of
    # marks over the depth colour rather than a hatching.
    kelp_frond(draw, 128, 170, 0.5, FAINT)
    kelp_frond(draw, 384, 426, 0.5, FAINT)


def draw_building(draw):
    draw.rectangle([84, 84, 172, 172], fill=BROWN, outline=BLACK, width=10)


def draw_tank(draw):
    ring(draw, [64, 64, 192, 192], BROWN, BLACK, 12)
    draw.ellipse([112, 112, 144, 144], fill=BLACK)


def position(draw):
    draw.ellipse([112, 196, 144, 228], fill=BLACK)


def draw_landmark(draw):
    ring(draw, [72, 72, 184, 184], NONE, BLACK, 12)
    draw.ellipse([116, 116, 140, 140], fill=BLACK)


def draw_landmark_tower(draw):
    draw.polygon([(104, 212), (116, 56), (140, 56), (152, 212)], outline=BLACK, fill=WHITE)
    draw.line([(104, 212), (116, 56), (140, 56), (152, 212), (104, 212)], fill=BLACK, width=10)
    draw.rectangle([106, 36, 150, 60], fill=BLACK)
    position(draw)


def draw_landmark_chimney(draw):
    draw.polygon([(100, 212), (114, 40), (142, 40), (156, 212)], fill=WHITE)
    draw.line([(100, 212), (114, 40), (142, 40), (156, 212)], fill=BLACK, width=10)
    draw.arc([116, 4, 196, 52], start=180, end=300, fill=BLACK, width=8)
    position(draw)


def draw_landmark_mast(draw):
    draw.line([(128, 30), (128, 200)], fill=BLACK, width=10)
    draw.line([(128, 60), (86, 200)], fill=BLACK, width=8)
    draw.line([(128, 60), (170, 200)], fill=BLACK, width=8)
    position(draw)


def draw_landmark_dome(draw):
    draw.pieslice([72, 80, 184, 192], start=180, end=360, fill=WHITE, outline=BLACK, width=10)
    draw.line([(64, 136), (192, 136)], fill=BLACK, width=10)
    draw.ellipse([116, 124, 140, 148], fill=BLACK)


def draw_landmark_windmill(draw):
    draw.line([(128, 112), (128, 212)], fill=BLACK, width=10)
    for end in ((72, 60), (184, 60), (128, 176)):
        draw.line([(128, 112), end], fill=BLACK, width=10)
    position(draw)


def draw_landmark_spire(draw):
    draw.polygon([(128, 24), (100, 200), (156, 200)], fill=WHITE)
    draw.line([(128, 24), (100, 200), (156, 200), (128, 24)], fill=BLACK, width=10, joint="curve")
    position(draw)


def draw_landmark_monument(draw):
    draw.polygon([(112, 200), (118, 70), (128, 52), (138, 70), (144, 200)], fill=WHITE)
    draw.line([(112, 200), (118, 70), (128, 52), (138, 70), (144, 200), (112, 200)], fill=BLACK, width=10)
    position(draw)


def draw_spot_height(draw):
    draw.ellipse([108, 108, 148, 148], fill=BLACK)


def draw_daymark(draw, fill):
    draw.rectangle([64, 48, 192, 176], fill=fill, outline=BLACK, width=12)
    draw.line([(128, 176), (128, 228)], fill=BLACK, width=12)


def draw_platform(draw):
    draw.rectangle([48, 48, S - 48, S - 48], outline=BLACK, width=14)
    draw.rectangle([96, 96, S - 96, S - 96], fill=BLACK)
    draw.line([(48, 48), (S - 48, S - 48)], fill=BLACK, width=8)
    draw.line([(S - 48, 48), (48, S - 48)], fill=BLACK, width=8)


def draw_mooring(draw):
    ring(draw, [58, 36, 198, 176], WHITE, BLACK, 12)
    draw.ellipse([112, 90, 144, 122], fill=BLACK)
    draw.line([(128, 176), (128, 228)], fill=BLACK, width=12)
    draw.arc([96, 196, 160, 248], start=0, end=180, fill=BLACK, width=12)


def draw_slope(draw):
    # A hill or dune: the crest, with hachures running down its face.
    import math
    box = [20, 64, 236, 280]
    draw.arc(box, start=195, end=345, fill=BROWN, width=16)
    cx, cy, r = 128, 172, 108
    for angle in (210, 240, 270, 300, 330):
        t = math.radians(angle)
        x, y = cx + r * math.cos(t), cy + r * math.sin(t)
        draw.line([(x, y + 4), (x + 0.45 * (x - cx), y + 70)], fill=BROWN, width=11)


def wave(draw, x0, x1, y, amplitude, width, fill=GREY):
    import math
    points = []
    for step in range(33):
        t = step / 32
        points.append((x0 + (x1 - x0) * t, y + amplitude * math.sin(t * math.pi * 4)))
    draw.line(points, fill=fill, width=width, joint="curve")


def draw_sand_waves(draw):
    for y in (92, 128, 164):
        wave(draw, 48, 208, y, 14, 10)


def draw_traffic_arrow(draw):
    # Open arrow pointing north, the S-52 lane arrow. Outline only, so depths show through it.
    shape = [
        (112, 236),
        (144, 236),
        (144, 112),
        (184, 112),
        (128, 28),
        (72, 112),
        (112, 112),
    ]
    draw.line(shape + [shape[0]], fill=MAGENTA, width=12, joint="miter")


# Pattern tiles are 2S square. Marks sit on a diagonal so rows do not line up.
def draw_sand_waves_pattern(draw):
    wave(draw, 48, 208, 128, 14, 9, FAINT)
    wave(draw, 304, 464, 384, 14, 9, FAINT)


def cone(draw, apex, base_y, half):
    x, y = apex
    draw.polygon([(x, y), (x - half, base_y), (x + half, base_y)], fill=BLACK)


TOPMARKS = {
    "cone-up": lambda dr: cone(dr, (128, 140), 240, 46),
    "cone-down": lambda dr: dr.polygon([(82, 140), (174, 140), (128, 240)], fill=BLACK),
    "sphere": lambda dr: dr.ellipse([86, 156, 170, 240], fill=BLACK),
    "spheres": lambda dr: (dr.ellipse([100, 120, 156, 176], fill=BLACK), dr.ellipse([100, 184, 156, 240], fill=BLACK)),
    "can": lambda dr: dr.rectangle([94, 150, 162, 240], fill=BLACK),
    "board": lambda dr: dr.rectangle([82, 164, 174, 236], fill=BLACK),
    "x": lambda dr: (dr.line([(90, 150), (166, 240)], fill=BLACK, width=20), dr.line([(166, 150), (90, 240)], fill=BLACK, width=20)),
    "cross": lambda dr: (dr.line([(128, 136), (128, 244)], fill=BLACK, width=20), dr.line([(84, 172), (172, 172)], fill=BLACK, width=20)),
    "diamond": lambda dr: dr.polygon([(128, 132), (174, 188), (128, 244), (82, 188)], fill=BLACK),
    "cones-in": lambda dr: (dr.polygon([(88, 132), (168, 132), (128, 188)], fill=BLACK), cone(dr, (128, 188), 244, 40)),
    "cones-out": lambda dr: (cone(dr, (128, 132), 188, 40), dr.polygon([(88, 188), (168, 188), (128, 244)], fill=BLACK)),
    "cones-up": lambda dr: (cone(dr, (128, 130), 182, 36), cone(dr, (128, 190), 242, 36)),
    "cones-down": lambda dr: (dr.polygon([(92, 130), (164, 130), (128, 182)], fill=BLACK), dr.polygon([(92, 190), (164, 190), (128, 242)], fill=BLACK)),
}


PAINTERS = {
    "rock": lambda im, dr: draw_rock(dr),
    "rock-awash": lambda im, dr: draw_rock_awash(dr),
    "wreck": lambda im, dr: draw_wreck(dr),
    "obstruction": lambda im, dr: draw_obstruction(dr),
    "buoy-red-can": lambda im, dr: draw_buoy_can(dr, RED),
    "buoy-green-can": lambda im, dr: draw_buoy_can(dr, GREEN),
    "buoy-red-cone": lambda im, dr: draw_buoy_cone(dr, RED),
    "buoy-green-cone": lambda im, dr: draw_buoy_cone(dr, GREEN),
    "buoy-red-pillar": lambda im, dr: draw_buoy_pillar(dr, RED),
    "buoy-green-pillar": lambda im, dr: draw_buoy_pillar(dr, GREEN),
    "buoy-special": lambda im, dr: draw_buoy_special(dr),
    "buoy-safe": lambda im, dr: draw_buoy_safe((im, dr)) or None,
    "buoy-isolated": lambda im, dr: draw_buoy_isolated(dr),
    "buoy-north": lambda im, dr: draw_buoy_north(dr),
    "buoy-east": lambda im, dr: draw_buoy_east(dr),
    "buoy-south": lambda im, dr: draw_buoy_south(dr),
    "buoy-west": lambda im, dr: draw_buoy_west(dr),
    "beacon-red": lambda im, dr: draw_beacon_red(dr),
    "beacon-green": lambda im, dr: draw_beacon_green(dr),
    "beacon-special": lambda im, dr: draw_beacon_special(dr),
    "light": lambda im, dr: draw_light(dr),
    "daymark": lambda im, dr: draw_daymark(dr, WHITE),
    "daymark-red": lambda im, dr: draw_daymark(dr, RED),
    "daymark-green": lambda im, dr: draw_daymark(dr, GREEN),
    "daymark-yellow": lambda im, dr: draw_daymark(dr, YELLOW),
    "platform": lambda im, dr: draw_platform(dr),
    "mooring": lambda im, dr: draw_mooring(dr),
    "light-red": lambda im, dr: draw_light(dr, RED),
    "light-green": lambda im, dr: draw_light(dr, GREEN),
    "light-yellow": lambda im, dr: draw_light(dr, LIGHT_YELLOW),
    "fog": lambda im, dr: draw_fog(dr),
    "anchor": lambda im, dr: draw_anchor(dr),
    "kelp": lambda im, dr: draw_kelp(dr),
    "kelp-pattern": lambda im, dr: draw_kelp_pattern(dr),
    "building": lambda im, dr: draw_building(dr),
    "tank": lambda im, dr: draw_tank(dr),
    "landmark": lambda im, dr: draw_landmark(dr),
    "landmark-tower": lambda im, dr: draw_landmark_tower(dr),
    "landmark-chimney": lambda im, dr: draw_landmark_chimney(dr),
    "landmark-mast": lambda im, dr: draw_landmark_mast(dr),
    "landmark-dome": lambda im, dr: draw_landmark_dome(dr),
    "landmark-windmill": lambda im, dr: draw_landmark_windmill(dr),
    "landmark-spire": lambda im, dr: draw_landmark_spire(dr),
    "landmark-monument": lambda im, dr: draw_landmark_monument(dr),
    "spot-height": lambda im, dr: draw_spot_height(dr),
    "slope": lambda im, dr: draw_slope(dr),
    "sand-waves": lambda im, dr: draw_sand_waves(dr),
    "sand-waves-pattern": lambda im, dr: draw_sand_waves_pattern(dr),
    "traffic-arrow": lambda im, dr: draw_traffic_arrow(dr),
}
for _shape, _paint in TOPMARKS.items():
    PAINTERS[f"topmark-{_shape}"] = lambda im, dr, paint=_paint: paint(dr)


def render(name):
    image, draw = new(2 * S if name in LARGE else S)
    if name == "buoy-safe":
        return draw_buoy_safe((image, draw))
    PAINTERS[name](image, draw)
    return image


def pack(scale):
    columns = 8
    cell = CELL // scale
    small = [name for name in NAMES if name not in LARGE]
    large = [name for name in NAMES if name in LARGE]
    rows = (len(small) + columns - 1) // columns
    large_rows = (len(large) + columns // 2 - 1) // (columns // 2)
    sheet = Image.new("RGBA", (columns * cell, (rows + 2 * large_rows) * cell), NONE)
    index = {}
    placed = [(name, (n % columns) * cell, (n // columns) * cell, cell) for n, name in enumerate(small)]
    placed += [
        (name, (n % (columns // 2)) * 2 * cell, (rows + 2 * (n // (columns // 2))) * cell, 2 * cell)
        for n, name in enumerate(large)
    ]
    for name, x, y, size in placed:
        icon = render(name).resize((size, size), Image.Resampling.LANCZOS)
        sheet.alpha_composite(icon, (x, y))
        index[name] = {
            "width": size,
            "height": size,
            "x": x,
            "y": y,
            "pixelRatio": 2 if scale == 1 else 1,
        }
    return sheet, index


def main():
    import json

    OUT.mkdir(parents=True, exist_ok=True)
    for scale, suffix in ((1, "@2x"), (2, "")):
        sheet, index = pack(scale)
        sheet.save(OUT / f"sprite{suffix}.png")
        (OUT / f"sprite{suffix}.json").write_text(json.dumps(index))
    if CLIENT.exists():
        shutil.rmtree(CLIENT)
    shutil.copytree(OUT, CLIENT)
    print(f"wrote {OUT} and {CLIENT}")


if __name__ == "__main__":
    main()
