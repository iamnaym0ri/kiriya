# place.py <IconState.plist> <layout> — puts the lab's widgets on the first Home Screen pages of the
# lab simulator (run while it is shut down; SpringBoard reads the file at boot). Lab use only.
import plistlib, sys, uuid

path, layout = sys.argv[1], sys.argv[2]
APP = "love.kiriya.conlab"
EXT = APP + ".conlabwidgets"
DEMO = APP + ".conlabdemo"

def widget(kind, size, ext=EXT):
    return {
        "allowsExternalSuggestions": False, "allowsSuggestions": False,
        "bundleIdentifier": ext, "containerBundleIdentifier": APP,
        "displayIdentifier": str(uuid.uuid4()).upper(), "elementType": "widget",
        "gridSize": size, "iconType": "custom",
        "uniqueIdentifier": str(uuid.uuid4()).upper(), "widgetIdentifier": kind,
    }

LAYOUTS = {
    # page lists, each a list of (kind, size[, ext])
    "states": [
        [("ConLabNear", "medium"), ("ConLabFar", "small"), ("ConLabToday", "small"), ("ConLabOngoing", "medium")],
        [("ConLabEnded", "large"), ("ConLabNone", "small"), ("NextConWidget", "small")],
        [("ConLabFar", "large"), ("ConLabExhibition", "medium")],
    ],
    # The lab app's icon sits on the first page too: tools/demo.sh opens it for a moment (to ask
    # WidgetKit for fresh timelines), and closing an app returns to the page its icon is on.
    "demo": [
        [("ConLabDemo", "medium", DEMO), ("ConLabDemo", "small", DEMO), ("ConLabNear", "small"), APP],
        [("ConLabDemo", "large", DEMO), ("ConLabOngoing", "medium")],
    ],
    "states2": [
        [("ConLabEnded", "large"), ("ConLabNone", "small"), ("NextConWidget", "small")],
    ],
    "states3": [
        [("ConLabFar", "large"), ("ConLabExhibition", "medium")],
    ],
    "near": [
        [("ConLabNear", "small"), ("ConLabOngoing", "small"), ("ConLabNear", "medium"), ("ConLabNear", "large")],
    ],
    "large": [
        [("ConLabToday", "large"), ("ConLabNear", "medium")],
    ],
}

with open(path, "rb") as f:
    state = plistlib.load(f)
pages = [[item if isinstance(item, str) else widget(*item) for item in page] for page in LAYOUTS[layout]]
placed_icons = {item for page in LAYOUTS[layout] for item in page if isinstance(item, str)}
lists = state.get("iconLists", [])
# Keep the system's own pages after ours (minus any lab widgets placed earlier).
def is_lab(item):
    if isinstance(item, str):
        return item in placed_icons
    return isinstance(item, dict) and str(item.get("containerBundleIdentifier", "")).startswith(APP)
rest = [[i for i in page if not is_lab(i)] for page in lists]
rest = [p for p in rest if p]
state["iconLists"] = pages + rest
with open(path, "wb") as f:
    plistlib.dump(state, f, fmt=plistlib.FMT_BINARY)
print(f"placed {layout}: {sum(len(p) for p in pages)} widgets on {len(pages)} pages")
