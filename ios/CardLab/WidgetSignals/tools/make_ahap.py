import json, sys
# The heartbeat she feels when a signal lands while the app is open: the same two slow "lub-dub"s as the
# sound's head (lub 0.00 / dub 0.235, lub 0.90 / dub 1.135), then a faint afterglow under the tail.
# Soft: low sharpness (round, not buzzy), each beat a short continuous event with a raised-cosine-like
# intensity curve (no hard edges), plus a gentle transient at its peak so it reads as a "beat".
pattern = []
def beat(t, dur, intensity, sharpness, peak_at):
    pattern.append({"Event": {"Time": round(t, 3), "EventType": "HapticContinuous", "EventDuration": dur,
        "EventParameters": [{"ParameterID": "HapticIntensity", "ParameterValue": intensity},
                            {"ParameterID": "HapticSharpness", "ParameterValue": sharpness}]}})
    pattern.append({"ParameterCurve": {"ParameterID": "HapticIntensityControl", "Time": round(t, 3),
        "ParameterCurveControlPoints": [
            {"Time": 0.0, "ParameterValue": 0.0},
            {"Time": round(peak_at * 0.5, 3), "ParameterValue": 0.55},
            {"Time": round(peak_at, 3), "ParameterValue": 1.0},
            {"Time": round(peak_at + (dur - peak_at) * 0.45, 3), "ParameterValue": 0.45},
            {"Time": round(dur, 3), "ParameterValue": 0.0}]}})
    pattern.append({"Event": {"Time": round(t + peak_at, 3), "EventType": "HapticTransient",
        "EventParameters": [{"ParameterID": "HapticIntensity", "ParameterValue": round(intensity * 0.7, 3)},
                            {"ParameterID": "HapticSharpness", "ParameterValue": round(sharpness * 0.8, 3)}]}})

for start, g in ((0.0, 1.0), (0.9, 0.86)):
    beat(start, 0.16, round(0.62 * g, 3), 0.12, 0.035)          # lub: fuller, rounder
    beat(start + 0.235, 0.12, round(0.42 * g, 3), 0.18, 0.028)  # dub: lighter, quicker
# Afterglow: a faint, very soft swell under the tail, fading out (felt more than noticed).
pattern.append({"Event": {"Time": 1.55, "EventType": "HapticContinuous", "EventDuration": 0.9,
    "EventParameters": [{"ParameterID": "HapticIntensity", "ParameterValue": 0.22},
                        {"ParameterID": "HapticSharpness", "ParameterValue": 0.04}]}})
pattern.append({"ParameterCurve": {"ParameterID": "HapticIntensityControl", "Time": 1.55,
    "ParameterCurveControlPoints": [{"Time": 0.0, "ParameterValue": 0.0}, {"Time": 0.3, "ParameterValue": 1.0},
                                    {"Time": 0.55, "ParameterValue": 0.55}, {"Time": 0.9, "ParameterValue": 0.0}]}})
ahap = {"Version": 1.0,
        "Metadata": {"Project": "kiriya.love", "Created": "2026-11-26",
                     "Description": "Thinking of you: a soft heartbeat (lub-dub, lub-dub) that matches the start of every signal's sound."},
        "Pattern": pattern}
json.dump(ahap, open(sys.argv[1], "w"), indent=2)
print(len(pattern), "entries")
