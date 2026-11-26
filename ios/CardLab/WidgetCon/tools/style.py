# style.py <simulator data dir> <light|dark|tinted|clear> — sets the Home Screen's icon & widget
# style in the poster's home screen configuration (run while the lab simulator is shut down).
import glob, plistlib, sys

data, style = sys.argv[1], sys.argv[2]
TYPE = {"light": "color", "dark": "dark", "tinted": "accent", "clear": "clear"}[style]
VARIANT = {"light": "light", "dark": "dark", "tinted": "light", "clear": "light"}[style]
files = glob.glob(f"{data}/Library/Application Support/PRBPosterExtensionDataStore/*/Extensions/*/configurations/*/versions/*/supplements/*/com.apple.posterkit.provider.supplementURL.homescreenConfiguration.plist")
for path in files:
    with open(path, "rb") as f:
        archive = plistlib.load(f)
    objects = archive["$objects"]
    changed = False
    for obj in objects:
        if isinstance(obj, dict) and "_iconUserInterfaceStyleType" in obj:
            t = obj["_iconUserInterfaceStyleType"].data
            v = obj["_iconUserInterfaceStyleVariant"].data
            # Point at fresh strings rather than editing shared ones.
            objects.append(TYPE); obj["_iconUserInterfaceStyleType"] = plistlib.UID(len(objects) - 1)
            objects.append(VARIANT); obj["_iconUserInterfaceStyleVariant"] = plistlib.UID(len(objects) - 1)
            changed = True
    if changed:
        with open(path, "wb") as f:
            plistlib.dump(archive, f, fmt=plistlib.FMT_BINARY)
        print("styled", style, path.split("configurations/")[1][:40])
