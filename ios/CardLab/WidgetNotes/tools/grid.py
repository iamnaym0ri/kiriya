# grid.py out.png columns scale a.png b.png …  — lays renders out in a grid for review (PIL).
import sys
from PIL import Image
out, cols, scale, *paths = sys.argv[1:]
cols, scale = int(cols), float(scale)
ims = [Image.open(p).convert("RGBA") for p in paths]
ims = [im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS) for im in ims]
rows = [ims[i:i + cols] for i in range(0, len(ims), cols)]
w = max(sum(im.width for im in r) + 10 * (len(r) - 1) for r in rows)
h = sum(max(im.height for im in r) for r in rows) + 10 * (len(rows) - 1)
sheet = Image.new("RGBA", (w, h), (245, 245, 245, 255))
y = 0
for r in rows:
    x = 0
    for im in r:
        sheet.paste(im, (x, y), im)
        x += im.width + 10
    y += max(im.height for im in r) + 10
sheet.save(out)
print(out)
