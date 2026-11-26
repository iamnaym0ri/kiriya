# wtap.py X Y [hold-seconds] — one quick WDA tap (or touch-and-hold) on the lab simulator.
import json, os, sys, urllib.request
B = f"http://127.0.0.1:{os.environ.get('WDA_PORT', '8123')}"
def call(m, p, b=None):
    r = urllib.request.Request(B + p, data=json.dumps(b).encode() if b is not None else None, method=m, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(r, timeout=120).read() or b"{}")
sid = call("GET", "/status")["sessionId"]
x, y = float(sys.argv[1]), float(sys.argv[2])
if len(sys.argv) > 3:
    call("POST", f"/session/{sid}/wda/touchAndHold", {"x": x, "y": y, "duration": float(sys.argv[3])})
else:
    call("POST", f"/session/{sid}/wda/tap", {"x": x, "y": y})
