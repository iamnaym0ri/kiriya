#!/usr/bin/env python3
"""A tiny WebDriverAgent client for the lab simulator only (WDA started by sim.sh wda on 127.0.0.1:8200).
    wda.py status | home | tap <x> <y> | swipe <x1> <y1> <x2> <y2> | longpress <x> <y> <seconds> | source
"""
import json
import sys
import urllib.request

BASE = "http://127.0.0.1:8200"


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"{}")


def session():
    status = call("GET", "/status")
    sid = status.get("sessionId")
    if sid:
        return sid
    return call("POST", "/session", {"capabilities": {"alwaysMatch": {}}})["sessionId"]


def actions(sid, pointer):
    call("POST", f"/session/{sid}/actions", {"actions": [{"type": "pointer", "id": "finger1", "parameters": {"pointerType": "touch"}, "actions": pointer}]})


cmd = sys.argv[1]
if cmd == "status":
    print(json.dumps(call("GET", "/status").get("value", {}).get("state")))
elif cmd == "home":
    call("POST", "/wda/homescreen", {})
elif cmd == "tap":
    sid = session()
    x, y = float(sys.argv[2]), float(sys.argv[3])
    actions(sid, [{"type": "pointerMove", "duration": 0, "x": x, "y": y}, {"type": "pointerDown"}, {"type": "pause", "duration": 80}, {"type": "pointerUp"}])
elif cmd == "longpress":
    sid = session()
    x, y, s = float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
    actions(sid, [{"type": "pointerMove", "duration": 0, "x": x, "y": y}, {"type": "pointerDown"}, {"type": "pause", "duration": int(s * 1000)}, {"type": "pointerUp"}])
elif cmd == "swipe":
    sid = session()
    x1, y1, x2, y2 = map(float, sys.argv[2:6])
    actions(sid, [{"type": "pointerMove", "duration": 0, "x": x1, "y": y1}, {"type": "pointerDown"}, {"type": "pointerMove", "duration": 350, "x": x2, "y": y2}, {"type": "pointerUp"}])
elif cmd == "source":
    sid = session()
    print(call("GET", f"/session/{sid}/source?format=description").get("value", "")[:6000])
