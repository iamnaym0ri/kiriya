#!/bin/zsh
# Starts WebDriverAgent on the lab simulator (port 8123) unless it already answers. The WDA build
# lives in the session scratchpad (a copy of the Rora tooling's source, built for the simulator).
S=/private/tmp/claude-502/-Users-josh/4e5d31de-01ef-45ea-b272-37f8bef98fac/scratchpad/wda
UDID=EBA95735-BC23-4679-979F-1A0C914D1D46
curl -s -m 3 http://127.0.0.1:8123/status >/dev/null && { echo "wda up"; exit 0; }
cd $S && TEST_RUNNER_USE_PORT=8123 TEST_RUNNER_MJPEG_SERVER_PORT=9123 nohup xcodebuild test-without-building \
  -xctestrun $S/dd/Build/Products/WebDriverAgentRunner_iphonesimulator26.2-x86_64.xctestrun \
  -destination "platform=iOS Simulator,id=$UDID" > $S/run.log 2>&1 &
echo $! > $S/run.pid
for i in $(seq 1 80); do curl -s -m 2 http://127.0.0.1:8123/status >/dev/null && break; sleep 3; done
python3 - <<'PY'
import json, urllib.request
B="http://127.0.0.1:8123"
def call(m,p,b=None):
    r=urllib.request.Request(B+p,data=json.dumps(b).encode() if b is not None else None,method=m,headers={"Content-Type":"application/json"})
    return json.loads(urllib.request.urlopen(r,timeout=120).read() or b"{}")
st=call("GET","/status"); sid=st.get("sessionId") or call("POST","/session",{"capabilities":{"alwaysMatch":{}}})["value"]["sessionId"]
call("POST",f"/session/{sid}/appium/settings",{"settings":{"waitForIdleTimeout":0,"animationCoolOffTimeout":0}})
print("wda started", sid)
PY
