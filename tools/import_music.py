#!/usr/bin/env python3
"""Copy songs out of your music library into assets/audio/.

Tracks with a file in assets/audio/ play through the page's own <audio> element
and keep going when the phone is locked; everything else streams from YouTube
and stops. This saves hunting through ~/Music by hand: it searches for files
whose names match the curated playlist, copies the matches in, and regenerates
the manifest.

    python3 tools/import_music.py                  # search ~/Music and ~/Downloads
    python3 tools/import_music.py --dry-run        # show what it would copy
    python3 tools/import_music.py ~/SomeFolder     # search somewhere specific
    python3 tools/import_music.py --all            # take every audio file, not
                                                   # just playlist matches

Buy tracks from the iTunes Store to get files this can use. Apple Music,
Spotify, JioSaavn and Gaana "downloads" are encrypted and are reported as
unusable rather than copied.
"""

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sync_audio import (  # noqa: E402  (path must be set first)
    AUDIO_DIR, EXTS, ROOT, clean_stem, duration_of, load_tracks, match, slug,
)

DEFAULT_ROOTS = [Path.home() / "Music", Path.home() / "Downloads"]

# Apple's protected formats. A file here means a subscription stream, not a
# track you own outright, and no browser can decode it.
DRM_EXTS = {".m4p", ".m4b"}

# App bundles and caches hold UI sounds and stubs that are not music
NOISE_PARTS = {".app", "node_modules", "Library/Caches", ".git", "assets/audio"}


def is_noise(p: Path) -> bool:
    s = str(p)
    return any(part in s for part in NOISE_PARTS)


def find_audio(roots: list) -> tuple:
    found, drm = [], []
    for root in roots:
        if not root.exists():
            print(f"  (skipping {root}, not found)")
            continue
        for p in root.rglob("*"):
            if not p.is_file() or p.name.startswith(".") or is_noise(p):
                continue
            ext = p.suffix.lower()
            if ext in DRM_EXTS:
                drm.append(p)
            elif ext in EXTS:
                found.append(p)
    return found, drm


def main() -> int:
    ap = argparse.ArgumentParser(description="Import songs into assets/audio/")
    ap.add_argument("roots", nargs="*", type=Path, default=None,
                    help="folders to search (default: ~/Music and ~/Downloads)")
    ap.add_argument("--dry-run", action="store_true", help="only report what would happen")
    ap.add_argument("--all", action="store_true",
                    help="copy every audio file found, not just playlist matches")
    ap.add_argument("--force", action="store_true", help="overwrite files already imported")
    args = ap.parse_args()

    roots = args.roots or DEFAULT_ROOTS
    tracks = load_tracks()
    if not tracks and not args.all:
        print("No tracks found in assets/data/tracks.js; nothing to match against.",
              file=sys.stderr)
        return 1

    print(f"Searching {', '.join(str(r) for r in roots)}…")
    found, drm = find_audio(roots)
    print(f"Found {len(found)} playable audio file(s)"
          + (f", plus {len(drm)} protected file(s)" if drm else "") + ".\n")

    # Pick one file per track, preferring the largest — a decent proxy for the
    # better-quality rip when a library holds several copies of a song.
    chosen, extras = {}, []
    for p in sorted(found, key=lambda x: -x.stat().st_size):
        idx = match(slug(p.stem), slug(clean_stem(p.stem)), tracks)
        if idx >= 0:
            chosen.setdefault(idx, p)
        elif args.all:
            extras.append(p)

    if not chosen and not extras:
        print("Nothing matched the playlist.")
        if found:
            print("Re-run with --all to import everything found regardless of name.")
        else:
            print("Buy tracks from the iTunes Store (Music app → Store), then run this again.")
        if drm:
            report_drm(drm)
        return 0

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    copied = 0
    for idx, src in sorted(chosen.items()):
        dest = AUDIO_DIR / (src.stem + src.suffix.lower())
        name = tracks[idx]["name"]
        if dest.exists() and not args.force:
            print(f"  have     {name}  ({dest.name})")
            continue
        secs = duration_of(src)
        mins = f"{int(secs // 60)}:{int(secs % 60):02d}" if secs else "?"
        print(f"  {'would copy' if args.dry_run else 'copied   '} {name}  "
              f"<- {src.name}  ({mins}, {src.stat().st_size / 1e6:.1f} MB)")
        if not args.dry_run:
            shutil.copy2(src, dest)
        copied += 1

    for src in extras:
        dest = AUDIO_DIR / (src.stem + src.suffix.lower())
        if dest.exists() and not args.force:
            continue
        print(f"  {'would copy' if args.dry_run else 'copied   '} (extra) {src.name}")
        if not args.dry_run:
            shutil.copy2(src, dest)
        copied += 1

    if drm:
        report_drm(drm)

    if args.dry_run:
        print(f"\nDry run: {copied} file(s) would be imported. Re-run without "
              f"--dry-run to do it.")
        return 0

    print(f"\nImported {copied} file(s) into {AUDIO_DIR.relative_to(ROOT)}.")
    if copied:
        print("\nRegenerating the manifest…")
        import sync_audio
        sync_audio.main()
        print("\nNow commit and push so the songs reach the live site:")
        print('  git add -A && git commit -m "Add audio for background playback" && git push')
    return 0


def report_drm(drm: list) -> None:
    print(f"\n{len(drm)} file(s) are protected downloads and cannot be used:")
    for p in drm[:5]:
        print(f"    {p.name}")
    if len(drm) > 5:
        print(f"    …and {len(drm) - 5} more")
    print("  These are Apple Music/subscription streams, not files you own. Buy the")
    print("  track from the iTunes Store to get a usable .m4a.")


if __name__ == "__main__":
    sys.exit(main())
