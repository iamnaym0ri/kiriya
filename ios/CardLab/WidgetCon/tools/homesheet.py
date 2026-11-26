# homesheet.py <out.png> <label=shot.png> … — the lab simulator's Home Screen shots side by side,
# cropped to the widgets, with a caption under each (run with the scratchpad venv's Python: PIL).
import sys
from PIL import Image, ImageDraw, ImageFont

out, items = sys.argv[1], [a.split("=", 1) for a in sys.argv[2:]]
crop = (0, 110, 828, 1340)
scale = 0.5
tiles = []
for label, path in items:
    im = Image.open(path).convert("RGB").crop(crop)
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    tiles.append((label, im))
pad, cap = 18, 34
w = sum(t.width for _, t in tiles) + pad * (len(tiles) + 1)
h = max(t.height for _, t in tiles) + pad * 2 + cap
sheet = Image.new("RGB", (w, h), (247, 242, 250))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/System/Library/Fonts/SFNSRounded.ttf", 15)
except Exception:
    font = ImageFont.load_default()
x = pad
for label, t in tiles:
    sheet.paste(t, (x, pad))
    draw.text((x + 4, pad + t.height + 9), label, fill=(78, 47, 99), font=font)
    x += t.width + pad
sheet.save(out)
print(out, sheet.size)
