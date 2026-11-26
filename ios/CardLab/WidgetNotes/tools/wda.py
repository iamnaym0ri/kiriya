# wda.py — drives the lab simulator through WebDriverAgent on 127.0.0.1:$WDA_PORT (default 8123).
# Only ever the "Kiriya Notes Widget Lab" simulator: WDA is started on it by sim.sh / by hand.
#   wda.py home | tap X Y | hold X Y [SECONDS] | find TEXT | labels | drag X1 Y1 X2 Y2 [SECONDS] | type TEXT | alert accept|dismiss
import json, os, sys, urllib.request

BASE = f"http://127.0.0.1:{os.environ.get('WDA_PORT', '8123')}"

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
    return call("POST", "/session", {"capabilities": {"alwaysMatch": {}}})["value"]["sessionId"]

def actions(sid, points):
    call("POST", f"/session/{sid}/actions", {"actions": [{"type": "pointer", "id": "finger", "parameters": {"pointerType": "touch"}, "actions": points}]})

def main(args):
    cmd = args[0]
    sid = session()
    if cmd == "home":
        call("POST", "/wda/homescreen")
    elif cmd == "tap":
        x, y = float(args[1]), float(args[2])
        actions(sid, [{"type": "pointerMove", "duration": 0, "x": x, "y": y}, {"type": "pointerDown"},
                      {"type": "pause", "duration": 60}, {"type": "pointerUp"}])
    elif cmd == "hold":
        x, y = float(args[1]), float(args[2])
        ms = int(float(args[3] if len(args) > 3 else 1.6) * 1000)
        actions(sid, [{"type": "pointerMove", "duration": 0, "x": x, "y": y}, {"type": "pointerDown"},
                      {"type": "pause", "duration": ms}, {"type": "pointerUp"}])
    elif cmd == "drag":
        x1, y1, x2, y2 = map(float, args[1:5])
        ms = int(float(args[5] if len(args) > 5 else 0.5) * 1000)
        actions(sid, [{"type": "pointerMove", "duration": 0, "x": x1, "y": y1}, {"type": "pointerDown"},
                      {"type": "pause", "duration": 200}, {"type": "pointerMove", "duration": ms, "x": x2, "y": y2},
                      {"type": "pointerUp"}])
    elif cmd in ("find", "labels"):
        src = call("GET", f"/session/{sid}/source?format=json")["value"]
        out = []
        def walk(node):
            label = node.get("label") or node.get("name") or ""
            r = node.get("rect") or {}
            if label and (cmd == "labels" or args[1].lower() in label.lower()):
                out.append(f'{node.get("type")} "{label}" x={r.get("x")} y={r.get("y")} w={r.get("width")} h={r.get("height")}')
            for child in node.get("children") or []:
                walk(child)
        walk(src)
        print("\n".join(out[:200]))
    elif cmd == "type":
        call("POST", f"/session/{sid}/wda/keys", {"value": list(args[1])})
    elif cmd == "alert":
        call("POST", f"/session/{sid}/alert/{args[1]}", {})
    else:
        print("unknown command")

if __name__ == "__main__":
    main(sys.argv[1:])
