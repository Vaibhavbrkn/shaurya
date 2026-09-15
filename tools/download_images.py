"""Download the curated backgrounds locally and write credits.

Wikimedia asks that sites not hotlink or hammer upload.wikimedia.org, so the
site ships its own copies: we request a standard 1920px thumbnail per file,
throttled, then re-encode with macOS `sips` to keep the page light.

Outputs:
  assets/backgrounds/<slug>.jpg
  assets/data/backgrounds.js
  CREDITS.md

Usage: python3 tools/download_images.py [max_images]
"""

import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "backgrounds")
UA = "ShauryaSite/1.0 (personal tribute site; background images; local build)"

TARGET_WIDTH = 1920      # standard Wikimedia thumbnail width
RECODE_WIDTH = 1800      # final stored width
JPEG_QUALITY = 68        # sips quality (0-100)
THROTTLE = 1.4           # seconds between downloads


def slugify(name):
    s = re.sub(r"^File:", "", name)
    s = re.sub(r"\.(jpe?g|png)$", "", s, flags=re.I)
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return s[:58] or hashlib.md5(name.encode()).hexdigest()[:10]


def thumb_url(file_title, width=TARGET_WIDTH):
    """Build the canonical Commons thumbnail URL for a File: title."""
    name = re.sub(r"^File:", "", file_title).replace(" ", "_")
    md5 = hashlib.md5(name.encode("utf-8")).hexdigest()
    quoted = urllib.parse.quote(name)
    return (
        f"https://upload.wikimedia.org/wikipedia/commons/thumb/"
        f"{md5[0]}/{md5[0:2]}/{quoted}/{width}px-{quoted}"
    )


def download(url, dest, attempts=4):
    delay = 4.0
    for _ in range(attempts):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": UA,
                "Accept": "image/jpeg,image/png,image/*;q=0.8",
            })
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if len(data) < 15000:
                return False, f"too small ({len(data)}b)"
            with open(dest, "wb") as f:
                f.write(data)
            return True, len(data)
        except Exception as e:
            msg = str(e)
            time.sleep(delay)
            delay = min(delay * 2, 40)
    return False, msg


def recode(path):
    """Resize + compress in place with sips; ignore failures."""
    try:
        subprocess.run(
            ["sips", "-Z", str(RECODE_WIDTH), "-s", "format", "jpeg",
             "-s", "formatOptions", str(JPEG_QUALITY), path, "--out", path],
            check=True, capture_output=True, timeout=90,
        )
        return True
    except Exception:
        return False


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 40

    with open(os.path.join(ROOT, "data", "images.json"), encoding="utf-8") as f:
        rows = json.load(f)

    os.makedirs(OUT_DIR, exist_ok=True)

    # A hand-curated selection always wins over the theme heuristics below:
    # automatic keyword filtering gets the pool clean, but choosing the actual
    # photographs (and dropping near-duplicates) needs human eyes.
    sel_path = os.path.join(ROOT, "data", "selection.json")
    if os.path.exists(sel_path):
        with open(sel_path, encoding="utf-8") as f:
            wanted = json.load(f)
        by_file = {r["file"]: r for r in rows}
        order = [by_file[w] for w in wanted if w in by_file]
        missing = [w for w in wanted if w not in by_file]
        if missing:
            print(f"  selection: {len(missing)} not in pool", file=sys.stderr)
        print(f"  using curated selection: {len(order)}", file=sys.stderr)
        return run(order)

    # Spread selection across themes so the slideshow stays varied.
    def theme(r):
        h = f"{r['file']} {r.get('desc','')}".lower()
        if any(k in h for k in ("navy", "ins ", "warship", "carrier", "submarine", "frigate", "destroyer", "fleet")):
            return "navy"
        if any(k in h for k in ("air force", "iaf", "sukhoi", "su-30", "tejas", "rafale", "mig", "jaguar",
                                "mirage", "aerobatic", "surya kiran", "helicopter", "chinook", "apache", "aircraft")):
            return "air"
        if any(k in h for k in ("republic day", "parade", "beating retreat", "band")):
            return "parade"
        if any(k in h for k in ("flag", "tricolour", "tricolor", "memorial")):
            return "flag"
        return "army"

    buckets = {}
    for r in rows:
        buckets.setdefault(theme(r), []).append(r)
    for k in buckets:
        print(f"  pool {k}: {len(buckets[k])}", file=sys.stderr)

    order, idx = [], 0
    keys = ["army", "air", "navy", "parade", "flag"]
    while len(order) < min(limit, len(rows)):
        added = False
        for k in keys:
            pool = buckets.get(k) or []
            if idx < len(pool):
                order.append(pool[idx])
                added = True
                if len(order) >= limit:
                    break
        if not added:
            break
        idx += 1

    return run(order)


def run(order):
    out, credits = [], []
    for i, r in enumerate(order, 1):
        slug = slugify(r["file"])
        rel = f"assets/backgrounds/{slug}.jpg"
        dest = os.path.join(ROOT, rel)

        if os.path.exists(dest) and os.path.getsize(dest) > 20000:
            print(f"[{i}/{len(order)}] cached {slug}", file=sys.stderr)
        else:
            url = thumb_url(r["file"])
            ok, info = download(url, dest)
            if not ok:
                print(f"[{i}/{len(order)}] FAIL {slug}: {info}", file=sys.stderr)
                time.sleep(THROTTLE)
                continue
            recode(dest)
            size = os.path.getsize(dest)
            print(f"[{i}/{len(order)}] ok {slug} ({size // 1024}kb)", file=sys.stderr)
            time.sleep(THROTTLE)

        label = re.sub(r"^File:", "", r["file"])
        label = re.sub(r"\.(jpe?g|png)$", "", label, flags=re.I)
        label = re.sub(r"[_]+", " ", label).strip()

        author = (r.get("artist") or r.get("credit") or "Wikimedia Commons").strip()
        author = re.sub(r"\s+", " ", author) or "Wikimedia Commons"

        out.append({
            "src": rel,
            "label": label[:110],
            "author": author[:70],
            "license": r.get("license", ""),
            "page": r.get("page", ""),
        })
        credits.append(
            f"- **{label}** — {author} — {r.get('license', 'see source')} — "
            f"[source]({r.get('page', '')})"
        )

    # Photographs kept from an earlier batch (already downloaded and credited)
    # that the current search queries no longer surface.
    retain_path = os.path.join(ROOT, "data", "retain.json")
    if os.path.exists(retain_path):
        with open(retain_path, encoding="utf-8") as f:
            for r in json.load(f):
                if os.path.exists(os.path.join(ROOT, r["src"])):
                    out.append(r)
                    credits.append(
                        f"- **{r['label']}** — {r['author']} — "
                        f"{r.get('license', 'see source')} — [source]({r.get('page', '')})"
                    )

    dest_js = os.path.join(ROOT, "assets", "data", "backgrounds.js")
    with open(dest_js, "w", encoding="utf-8") as f:
        f.write("/* Curated Indian Armed Forces backgrounds, stored locally in\n"
                "   assets/backgrounds/. All freely licensed (public domain / Creative\n"
                "   Commons / GODL-India); per-photo credit is shown on screen and in\n"
                "   CREDITS.md. Generated by tools/download_images.py */\n")
        f.write("window.SHAURYA_BACKGROUNDS = ")
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    with open(os.path.join(ROOT, "CREDITS.md"), "w", encoding="utf-8") as f:
        f.write("# Photo credits\n\n")
        f.write("Background photographs are freely licensed images of the Indian Armed "
                "Forces, sourced from Wikimedia Commons and stored in "
                "`assets/backgrounds/`.\n\n")
        f.write("\n".join(credits))
        f.write("\n\n## Music\n\nAll audio is streamed from YouTube. This project hosts "
                "no audio files. Songs remain the property of their respective rights "
                "holders.\n")

    total = sum(os.path.getsize(os.path.join(ROOT, o["src"])) for o in out)
    print(f"\nbackgrounds.js: {len(out)} images, {total // 1024 // 1024} MB total",
          file=sys.stderr)


if __name__ == "__main__":
    main()
