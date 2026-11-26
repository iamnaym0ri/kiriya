#!/usr/bin/env python3
"""The "Thinking of you" notification sounds: original, synthesised here (standard library only).

Every signal starts with the same soft heartbeat, two slow "lub-dub"s on felt-mallet tones, so she
learns one thing: that sound is Josh. Then a short tail tells which signal it is (a bloom for ♡, a
warm swell for a hug, two little pips for a kiss, a rising sunrise for good morning, a falling
lullaby for goodnight, a sigh for miss you, two droplets for water). All in D major, all soft-attack.

Output: Linear PCM 16-bit mono 44.1 kHz .caf (APNs custom sounds: Linear PCM / IMA4 / µLaw / aLaw in
aiff/wav/caf, under 30 s), plus .wav copies for listening, and a waveform/spectrum report.

    python3 make_sounds.py <out-dir>
"""
import math
import os
import struct
import subprocess
import sys
import wave

RATE = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else "."

# D major, the notes we use.
D5, E5, FS5, A5, B5, D6, E6, FS6, A6 = 587.33, 659.26, 739.99, 880.0, 987.77, 1174.66, 1318.51, 1479.98, 1760.0
A4, D4, FS4 = 440.0, 293.66, 369.99


def env_soft(t, attack, decay):
    """Raised-cosine attack (no click), then an exponential decay with time constant `decay`."""
    if t < 0:
        return 0.0
    if t < attack:
        return 0.5 - 0.5 * math.cos(math.pi * t / attack)
    return math.exp(-(t - attack) / decay)


def mallet(buf, start, freq, gain, attack=0.022, decay=0.26, partials=((1, 1.0), (2.0, 0.34), (3.98, 0.08), (6.1, 0.025)), length=None):
    """A felt-mallet note: a few partials, higher ones dying faster. Soft, round, no click."""
    length = length or decay * 7
    n0 = int(start * RATE)
    for i in range(int(length * RATE)):
        t = i / RATE
        s = 0.0
        for ratio, weight in partials:
            d = decay / (1 + (ratio - 1) * 0.55)
            s += weight * env_soft(t, attack, d) * math.sin(2 * math.pi * freq * ratio * t)
        j = n0 + i
        if j < len(buf):
            buf[j] += gain * s


def bell(buf, start, freq, gain, attack=0.012, decay=0.9, detune=0.0):
    """A glassy bell for the tails: harmonic-ish partials with a little shimmer."""
    partials = ((1, 1.0), (2.01, 0.32), (3.0, 0.12), (4.18, 0.06))
    n0 = int(start * RATE)
    for i in range(int(decay * 6 * RATE)):
        t = i / RATE
        s = 0.0
        for ratio, weight in partials:
            d = decay / (1 + (ratio - 1) * 0.8)
            f = freq * ratio * (1 + detune * math.sin(2 * math.pi * 5.2 * t) * 0.0015)
            s += weight * env_soft(t, attack, d) * math.sin(2 * math.pi * f * t)
        j = n0 + i
        if j < len(buf):
            buf[j] += gain * s


def pad(buf, start, freqs, gain, rise=0.32, hold=0.25, fall=0.75):
    """A warm swell (the hug): soft sines with a touch of 2nd harmonic, slowly in, slowly out."""
    total = rise + hold + fall
    n0 = int(start * RATE)
    for i in range(int((total + 0.05) * RATE)):
        t = i / RATE
        if t < rise:
            e = 0.5 - 0.5 * math.cos(math.pi * t / rise)
        elif t < rise + hold:
            e = 1.0
        else:
            u = min(1.0, (t - rise - hold) / fall)
            e = 0.5 + 0.5 * math.cos(math.pi * u)
        s = 0.0
        for k, f in enumerate(freqs):
            for det in (-0.9, 0.9):  # two slightly detuned voices: a gentle chorus, like breathing
                ff = f * (1 + det * 0.0012)
                s += math.sin(2 * math.pi * ff * t + k) + 0.18 * math.sin(2 * math.pi * 2 * ff * t)
        j = n0 + i
        if j < len(buf):
            buf[j] += gain * e * s / (len(freqs) * 2)


def drop(buf, start, f0, f1, gain, sweep=0.045, decay=0.07, attack=0.006):
    """A water droplet: a sine whose pitch leaps upward as it rings out ("plip")."""
    n0 = int(start * RATE)
    phase = 0.0
    for i in range(int((decay * 7) * RATE)):
        t = i / RATE
        u = min(1.0, t / sweep)
        f = f0 * (f1 / f0) ** (u * (2 - u))  # an eased exponential glide
        phase += 2 * math.pi * f / RATE
        e = env_soft(t, attack, decay)
        j = n0 + i
        if j < len(buf):
            buf[j] += gain * e * (math.sin(phase) + 0.12 * math.sin(2 * phase))


def heartbeat(buf):
    """The shared head: lub-dub … lub-dub, about 66 beats a minute, the second beat a touch softer."""
    for start, g in ((0.0, 1.0), (0.9, 0.86)):
        # lub: lower, rounder, a little longer
        mallet(buf, start, A4, 0.62 * g, attack=0.026, decay=0.24)
        mallet(buf, start, D4, 0.16 * g, attack=0.03, decay=0.2, partials=((1, 1.0), (2.0, 0.4)))
        # dub: a fourth higher, quicker, softer
        mallet(buf, start + 0.235, D5, 0.46 * g, attack=0.02, decay=0.18)
    return 1.55  # where the tail begins


def tail(buf, signal, t):
    if signal == "thinking":
        # a bloom: a soft strummed D major chord, ringing like a little glass heart
        for k, f in enumerate((FS5, A5, D6)):
            bell(buf, t + k * 0.045, f, 0.22, decay=0.62, detune=1)
        bell(buf, t + 0.2, FS6, 0.06, decay=0.5)
    elif signal == "hug":
        # a warm swell: an embrace, in and out
        pad(buf, t - 0.05, (D5, FS5, A5), 0.55, rise=0.36, hold=0.28, fall=0.8)
        bell(buf, t + 0.32, D6, 0.07, decay=0.8)
    elif signal == "kiss":
        # two little pips, the second sliding up: mwah
        bell(buf, t, D6, 0.22, attack=0.008, decay=0.28)
        drop(buf, t + 0.17, 1100, 1560, 0.2, sweep=0.06, decay=0.11, attack=0.009)
        bell(buf, t + 0.38, FS6, 0.06, decay=0.35)
    elif signal == "morning":
        # a sunrise: up the chord, bright
        for k, f in enumerate((D5, FS5, A5, D6)):
            bell(buf, t + k * 0.12, f, 0.19 + k * 0.012, decay=0.48)
        bell(buf, t + 0.5, FS6, 0.06, decay=0.45)
    elif signal == "night":
        # a lullaby: down the chord, slow and dim (fewer bright partials)
        for k, f in enumerate((A5, FS5, D5)):
            mallet(buf, t + k * 0.24, f, 0.36 - k * 0.04, attack=0.03, decay=0.45, partials=((1, 1.0), (2.0, 0.15)))
    elif signal == "miss":
        # a sigh: a slow step down, then home
        mallet(buf, t, B5, 0.3, attack=0.04, decay=0.42, partials=((1, 1.0), (2.0, 0.2)))
        mallet(buf, t + 0.3, A5, 0.28, attack=0.04, decay=0.42, partials=((1, 1.0), (2.0, 0.2)))
        mallet(buf, t + 0.62, FS5, 0.3, attack=0.05, decay=0.6, partials=((1, 1.0), (2.0, 0.2)))
    elif signal == "water":
        # two droplets into a glass
        drop(buf, t, 760, 1480, 0.42)
        drop(buf, t + 0.24, 980, 1820, 0.3, sweep=0.04, decay=0.06)
        bell(buf, t + 0.05, D6, 0.05, decay=0.5)


SIGNALS = ["thinking", "hug", "kiss", "morning", "night", "miss", "water"]


def render(signal, length=3.6):
    buf = [0.0] * int(length * RATE)
    t = heartbeat(buf)
    if signal != "head":
        tail(buf, signal, t)
    # Gentle high-shelf rolloff (one-pole low-pass blended in) to keep it soft on the iPhone speaker.
    out, y = [], 0.0
    a = math.exp(-2 * math.pi * 5200 / RATE)
    for x in buf:
        y = (1 - a) * x + a * y
        out.append(0.55 * x + 0.45 * y)
    return out


def finish(out, scale, longest=3.2, fade_time=0.45):
    """Scale (the same for every file, so the heartbeat is identical in all seven), trim what's below
    -60 dB at the end, keep it under `longest` seconds, and let it die away with a cosine fade."""
    out = [v * scale for v in out]
    end = len(out)
    while end > 0 and abs(out[end - 1]) < 1e-3:
        end -= 1
    out = out[: min(len(out), end + int(0.04 * RATE), int(longest * RATE))]
    fade = int(fade_time * RATE)
    for i in range(fade):
        out[-1 - i] *= 0.5 - 0.5 * math.cos(math.pi * i / fade)
    return out


def write_wav(path, samples):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32767)) for s in samples))


def main():
    os.makedirs(OUT, exist_ok=True)
    report = []
    head = render("head")
    scale = 10 ** (-3.0 / 20) / max(abs(v) for v in head)  # the heartbeat peaks at -3 dBFS everywhere
    for signal in SIGNALS + ["head"]:
        samples = finish(head if signal == "head" else render(signal), scale)
        peak = max(abs(s) for s in samples)
        if peak > 0.97:
            raise SystemExit(f"{signal}: tail peaks at {peak:.2f}, louder than the heartbeat")
        name = f"SignalsWidget-{signal}"
        wav = os.path.join(OUT, name + ".wav")
        write_wav(wav, samples)
        if signal != "head":
            caf = os.path.join(OUT, name + ".caf")
            subprocess.run(["afconvert", "-f", "caff", "-d", "LEI16@44100", "-c", "1", wav, caf], check=True)
        rms = math.sqrt(sum(s * s for s in samples) / len(samples))
        report.append(f"{name}: {len(samples) / RATE:.2f} s, peak {20 * math.log10(peak):.1f} dBFS, rms {20 * math.log10(rms):.1f} dBFS")
    with open(os.path.join(OUT, "sounds.txt"), "w") as f:
        f.write("\n".join(report) + "\n")
    print("\n".join(report))


if __name__ == "__main__":
    main()
