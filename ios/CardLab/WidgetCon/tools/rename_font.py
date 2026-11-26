# rename_font.py <in> <out> <family> <style> <psname>  — sets the name table so the face is unique.
import sys
from fontTools.ttLib import TTFont
src, dst, family, style, ps = sys.argv[1:6]
f = TTFont(src)
name = f['name']
full = f"{family} {style}" if style != "Regular" else family
for rec in list(name.names):
    if rec.nameID in (16, 17, 21, 22, 25):
        name.removeNames(nameID=rec.nameID)
for pid, eid, lid in ((3, 1, 0x409), (1, 0, 0)):
    name.setName(family, 1, pid, eid, lid)
    name.setName(style, 2, pid, eid, lid)
    name.setName(f"{ps};instance", 3, pid, eid, lid)
    name.setName(full, 4, pid, eid, lid)
    name.setName(ps, 6, pid, eid, lid)
if 'STAT' in f: del f['STAT']
f.save(dst)
print(dst)
