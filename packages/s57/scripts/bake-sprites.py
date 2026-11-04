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
NONE = (0, 0, 0, 0)

CELL = 64
SUPERSAMPLE = 4
S = CELL * SUPERSAMPLE

NAMES = [
    "rock",
    "rock-awash",
    "wreck",
    "obstruction",
    "buoy-port",
    "buoy-stbd",
    "buoy-special",
    "buoy-safe",
    "buoy-isolated",
    "buoy-north",
    "buoy-east",
    "buoy-south",
    "buoy-west",
    "beacon-port",
    "beacon-stbd",
    "beacon-special",
    "light",
    "daymark",
    "daymark-red",
    "daymark-green",
    "daymark-yellow",
    "platform",
    "mooring",
]


def new():
    image = Image.new("RGBA", (S, S), NONE)
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


def draw_buoy_port(draw):
    draw.rounded_rectangle([78, 48, 178, 208], radius=28, fill=RED, outline=BLACK, width=12)


def draw_buoy_stbd(draw):
    draw.polygon([(128, 40), (58, 214), (198, 214)], fill=GREEN)
    draw.line([(128, 40), (58, 214), (198, 214), (128, 40)], fill=BLACK, width=12, joint="curve")


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


def draw_beacon_port(draw):
    draw.line([(128, 230), (128, 108)], fill=BLACK, width=12)
    draw.rectangle([78, 36, 178, 120], fill=RED, outline=BLACK, width=12)


def draw_beacon_stbd(draw):
    draw.line([(128, 236), (128, 130)], fill=BLACK, width=12)
    draw.polygon([(128, 28), (70, 140), (186, 140)], fill=GREEN)
    draw.line([(128, 28), (70, 140), (186, 140), (128, 28)], fill=BLACK, width=12, joint="curve")


def draw_beacon_special(draw):
    draw.line([(128, 240), (128, 140)], fill=BLACK, width=12)
    draw.polygon([(128, 24), (196, 100), (128, 176), (60, 100)], fill=YELLOW, outline=BLACK)
    draw.line([(128, 24), (196, 100), (128, 176), (60, 100), (128, 24)], fill=BLACK, width=10, joint="curve")
    draw.line([(92, 72), (164, 140)], fill=BLACK, width=8)
    draw.line([(164, 72), (92, 140)], fill=BLACK, width=8)


def draw_light(draw):
    # Position dot at the centre. The flare reaches up and to the right.
    draw.polygon([(150, 118), (214, 36), (236, 78), (168, 146)], fill=MAGENTA)
    draw.ellipse([196, 28, 244, 76], fill=MAGENTA)
    draw.ellipse([104, 104, 152, 152], fill=BLACK)


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


PAINTERS = {
    "rock": lambda im, dr: draw_rock(dr),
    "rock-awash": lambda im, dr: draw_rock_awash(dr),
    "wreck": lambda im, dr: draw_wreck(dr),
    "obstruction": lambda im, dr: draw_obstruction(dr),
    "buoy-port": lambda im, dr: draw_buoy_port(dr),
    "buoy-stbd": lambda im, dr: draw_buoy_stbd(dr),
    "buoy-special": lambda im, dr: draw_buoy_special(dr),
    "buoy-safe": lambda im, dr: draw_buoy_safe((im, dr)) or None,
    "buoy-isolated": lambda im, dr: draw_buoy_isolated(dr),
    "buoy-north": lambda im, dr: draw_buoy_north(dr),
    "buoy-east": lambda im, dr: draw_buoy_east(dr),
    "buoy-south": lambda im, dr: draw_buoy_south(dr),
    "buoy-west": lambda im, dr: draw_buoy_west(dr),
    "beacon-port": lambda im, dr: draw_beacon_port(dr),
    "beacon-stbd": lambda im, dr: draw_beacon_stbd(dr),
    "beacon-special": lambda im, dr: draw_beacon_special(dr),
    "light": lambda im, dr: draw_light(dr),
    "daymark": lambda im, dr: draw_daymark(dr, WHITE),
    "daymark-red": lambda im, dr: draw_daymark(dr, RED),
    "daymark-green": lambda im, dr: draw_daymark(dr, GREEN),
    "daymark-yellow": lambda im, dr: draw_daymark(dr, YELLOW),
    "platform": lambda im, dr: draw_platform(dr),
    "mooring": lambda im, dr: draw_mooring(dr),
}


def render(name):
    image, draw = new()
    if name == "buoy-safe":
        return draw_buoy_safe((image, draw))
    PAINTERS[name](image, draw)
    return image


def pack(scale):
    columns = 8
    cell = CELL // scale
    rows = (len(NAMES) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * cell, rows * cell), NONE)
    index = {}
    for number, name in enumerate(NAMES):
        icon = render(name).resize((cell, cell), Image.Resampling.LANCZOS)
        x = (number % columns) * cell
        y = (number // columns) * cell
        sheet.alpha_composite(icon, (x, y))
        index[name] = {
            "width": cell,
            "height": cell,
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
