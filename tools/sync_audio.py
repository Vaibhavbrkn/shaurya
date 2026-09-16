#!/usr/bin/env python3
"""Generate assets/data/local-audio.js from whatever sits in assets/audio/.

Background playback is the point of this script. A YouTube embed cannot play
with the screen off, but an <audio> element on the page can, so every file it
finds here becomes a track that survives a locked phone.

Files are matched to the curated playlist in tracks.js by name, so
"Teri Mitti.m4a" attaches itself to the existing Teri Mitti entry and inherits
its credit. Anything it cannot place is still added, as its own track.

    python3 tools/sync_audio.py
"""

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "assets" / "audio"
TRACKS_JS = ROOT / "assets" / "data" / "tracks.js"
OUT_JS = ROOT / "assets" / "data" / "local-audio.js"

# Formats that browsers can actually decode. Anything else is reported, not used.
EXTS = {".m4a", ".mp3", ".aac", ".ogg", ".oga", ".opus", ".webm", ".flac", ".wav"}

# Noise that download tools and rippers leave in filenames. "Song" is missing
# on purpose: plenty of titles contain the word.
JUNK = re.compile(
    r"\b(official|video|audio|lyrical|lyrics|full|hd|4k|1080p|720p|"
    r"remastered|mp3|m4a|kbps|pagalworld|songspk|downloaded|free)\b",
    re.I,
)


def slug(text: str) -> str:
    text = re.sub(r"['\u2018\u2019]", "", str(text).lower())
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", text))


def clean_stem(stem: str) -> str:
    """Strip leading track numbers and boilerplate so matching has a chance."""
    s = re.sub(r"^\s*\d{1,3}\s*[-._)\]]\s*", "", stem)
    s = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", s)
    s = JUNK.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip() or stem


def load_tracks() -> list:
    if not TRACKS_JS.exists():
        return []
    text = TRACKS_JS.read_text(encoding="utf-8")
    start, end = text.find("["), text.rfind("]")
    if start < 0 or end < 0:
        return []
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        print(f"! could not parse {TRACKS_JS.name}: {exc}", file=sys.stderr)
        return []


def duration_of(path: Path) -> int:
    """Seconds, via ffprobe or macOS afinfo. Zero when neither is available."""
    if shutil.which("ffprobe"):
        cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "default=nw=1:nk=1", str(path)]
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            return int(float(out.stdout.strip()))
        except (ValueError, subprocess.SubprocessError):
            pass
    if shutil.which("afinfo"):
        try:
            out = subprocess.run(["afinfo", str(path)],
                                 capture_output=True, text=True, timeout=30)
            hit = re.search(r"estimated duration:\s*([\d.]+)", out.stdout)
            if hit:
                return int(float(hit.group(1)))
        except subprocess.SubprocessError:
            pass
    return 0


def match(raw_slug: str, clean_slug: str, tracks: list) -> int:
    """Index of the best-matching track, or -1.

    Exact comparisons run first, and the raw filename before the cleaned one, so
    "Teri Mitti (Female)" claims its own entry rather than being stripped down to
    "Teri Mitti" and stealing the other song's."""
    for s in [s for s in (raw_slug, clean_slug) if s]:
        for i, t in enumerate(tracks):
            if slug(t.get("name", "")) == s:
                return i

    # Then the longest substring overlap, which catches "teri-mitti-kesari".
    # Both sides need real length: an empty slug — every Devanagari filename
    # reduces to one — is a substring of everything and would match at random.
    best, best_len = -1, 0
    if len(clean_slug) > 5:
        for i, t in enumerate(tracks):
            ts = slug(t.get("name", ""))
            if len(ts) > 5 and (ts in clean_slug or clean_slug in ts) and len(ts) > best_len:
                best, best_len = i, len(ts)
    return best


def main() -> int:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    tracks = load_tracks()

    files, skipped, folders = [], [], []
    for p in sorted(AUDIO_DIR.iterdir()):
        if p.name.startswith("."):
            continue
        if p.is_dir():
            folders.append(p)
        elif p.suffix.lower() in EXTS:
            files.append(p)
        else:
            skipped.append(p)

    by_track, extra, claimed = {}, [], {}

    for p in files:
        # The path becomes a URL, so "#" or "?" in a filename would truncate it
        rel = "assets/audio/" + quote(p.name)
        idx = match(slug(p.stem), slug(clean_stem(p.stem)), tracks)

        # One file per track; a second candidate becomes a standalone entry
        if idx >= 0 and idx not in claimed:
            claimed[idx] = p.name
            key = tracks[idx].get("id") or slug(tracks[idx]["name"])
            by_track[key] = rel
            print(f"  matched  {p.name}  ->  {tracks[idx]['name']}")
        else:
            extra.append({
                "name": clean_stem(p.stem),
                "credit": "From your library",
                "file": rel,
                "duration": duration_of(p),
            })
            print(f"  added    {p.name}  (not in tracks.js)")

    body = json.dumps({"byTrack": by_track, "extra": extra},
                      indent=2, ensure_ascii=False)
    # Legal in JSON, but illegal inside a JS string literal before ES2019, and
    # this file is executed as a script on phones that predate it
    body = body.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    OUT_JS.write_text(
        "/* Local audio manifest — generated by tools/sync_audio.py. Do not edit\n"
        "   by hand unless you are done running the script.\n\n"
        "   Tracks listed here play through the page's own <audio> element, so they\n"
        "   keep going with the screen locked and appear on the lock screen.\n"
        "   Everything absent from this file streams from YouTube instead, which\n"
        "   stops the moment the phone sleeps. */\n"
        f"window.SHAURYA_LOCAL_AUDIO = {body};\n",
        encoding="utf-8",
    )

    total = len(by_track) + len(extra)
    print(f"\n{total} file(s) will play in the background "
          f"({len(by_track)} matched to the playlist, {len(extra)} extra).")
    if skipped:
        print(f"Ignored {len(skipped)} non-audio file(s): "
              + ", ".join(p.name for p in skipped[:6]))
    if folders:
        print(f"Ignored {len(folders)} folder(s) — audio must sit directly in "
              f"{AUDIO_DIR.relative_to(ROOT)}, not in subfolders: "
              + ", ".join(p.name for p in folders[:6]))
    if not total:
        print(f"Drop .m4a/.mp3 files into {AUDIO_DIR.relative_to(ROOT)} and run this again.")
    print(f"Wrote {OUT_JS.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
