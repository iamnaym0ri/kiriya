#!/usr/bin/env python3
"""Puts the lab widgets on the lab simulator's Home Screen by rewriting SpringBoard's IconState.plist
(the simulator must be shut down). Only ever touches the "Kiriya Signals Widget Lab" device.

    python3 place_widgets.py <device-udid> [real|demo]
      real  page 1: the real, interactive widget (small + large); page 2: medium + small + the app
      demo  page 1: the scripted demo (medium + large) for recording the sent moment
"""
import os
import plistlib
import sys
import uuid

udid = sys.argv[1]
path = os.path.expanduser(f"~/Library/Developer/CoreSimulator/Devices/{udid}/data/Library/SpringBoard/IconState.plist")
APP, EXT = "love.kiriya.signalslab", "love.kiriya.signalslab.widget"


def widget(kind, size):
    return {
        "allowsExternalSuggestions": False,
        "allowsSuggestions": False,
        "bundleIdentifier": EXT,
        "containerBundleIdentifier": APP,
        "displayIdentifier": str(uuid.uuid4()).upper(),
        "elementType": "widget",
        "gridSize": size,
        "iconType": "custom",
        "uniqueIdentifier": str(uuid.uuid4()).upper(),
        "widgetIdentifier": kind,
    }


with open(path, "rb") as f:
    state = plistlib.load(f)
layout = sys.argv[2] if len(sys.argv) > 2 else "real"
if layout == "fonts":
    pages = [[widget(k, "small") for k in ("FontGaegu", "FontParisienne", "FontHiragino", "FontSystemConcat")] + [widget("ThinkingOfYouWidget", "medium")]]
elif layout == "demo":
    pages = [
        [widget("SignalsLabDemo", "medium"), widget("SignalsLabDemo", "large")],
        [widget("ThinkingOfYouWidget", "small"), widget("ThinkingOfYouWidget", "small"), widget("ThinkingOfYouWidget", "large")],
        [widget("ThinkingOfYouWidget", "medium"), widget("SignalsLabDemo", "small"), APP],
    ]
else:
    pages = [
        [widget("ThinkingOfYouWidget", "small"), widget("ThinkingOfYouWidget", "small"), widget("ThinkingOfYouWidget", "large")],
        [widget("ThinkingOfYouWidget", "medium"), widget("SignalsLabDemo", "small"), APP],
    ]
state["iconLists"] = pages
with open(path, "wb") as f:
    plistlib.dump(state, f, fmt=plistlib.FMT_BINARY)
print("placed", sum(len(p) for p in pages), "items on", len(pages), "pages")
