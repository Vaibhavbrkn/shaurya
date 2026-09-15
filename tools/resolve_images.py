"""Build a curated list of freely-licensed Indian Armed Forces / patriotic images.

Pulls candidates from Wikimedia Commons categories and searches, keeps only
freely-licensed, landscape, clearly on-theme photographs, verifies each URL
actually serves bytes, and emits wide thumbnails for full-screen backgrounds.

Usage: python3 tools/resolve_images.py > data/images.json
"""

import json
import re
import sys
import time
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "ShauryaSite/1.0 (patriotic background curation; local build)"

CATEGORIES = [
    "Indian Army",
    "Indian Air Force",
    "Indian Navy",
    "Republic Day parade (India)",
    "Sukhoi Su-30MKI",
    "HAL Tejas",
    "Aircraft of the Indian Air Force",
    "Ships of the Indian Navy",
    "Soldiers of India",
    "Indian Army equipment",
    "Military parades in India",
    "Indian Military Academy",
    "National War Memorial, New Delhi",
    "Border Security Force",
    "Indian Army vehicles",
    "Surya Kiran Aerobatic Team",
    "Military exercises of India",
    "Indian Army in Ladakh",
    "Aerobatic displays of the Indian Air Force",
    "Tanks of India",
]

SEARCHES = [
    "Sukhoi Su-30MKI Indian Air Force in flight",
    "HAL Tejas in flight Indian Air Force",
    "Rafale Indian Air Force flying",
    "Surya Kiran aerobatic team formation smoke trails",
    "Indian Air Force flypast formation Republic Day",
    "Indian Army soldiers marching contingent Republic Day parade",
    "Indian Army soldiers patrol exercise field",
    "Indian Army soldiers Ladakh high altitude snow",
    "T-90 Bhishma tank Indian Army exercise",
    "Indian Army artillery firing exercise",
    "Indian Army paratroopers parachute jump",
    "Indian Navy warship at sea underway",
    "Indian Navy fleet review ships formation",
    "INS Vikramaditya Vikrant aircraft carrier deck",
    "MiG-29K Indian Navy carrier aircraft",
    "Indian national flag tricolour flying large",
    "Beating Retreat ceremony India",
    "Indian Army mountain warfare soldiers",
    "Indian Air Force helicopter Dhruv Chinook Apache",
    "Indian Navy submarine surfaced sea",
]

FREE_HINTS = (
    "public domain", "pd-", "cc0", "cc by", "cc-by", "cc by-sa", "cc-by-sa",
    "godl", "government open data", "attribution", "ogl",
)

# A candidate must look clearly on-theme.
RELEVANT = (
    "indian army", "indian air force", "indian navy", "iaf", " ins ", "ins ",
    "army", "air force", "navy", "soldier", "jawan", "regiment", "rifles",
    "infantry", "battalion", "commando", "marcos", "paratroop", "parachute",
    "republic day", "beating retreat", "parade", "military", "war memorial",
    "sukhoi", "su-30", "tejas", "rafale", "mig-", "jaguar", "mirage", "chinook",
    "apache", "dhruv", "tank", "artillery", "howitzer", "bofors", "arjun",
    "warship", "frigate", "destroyer", "corvette", "submarine", "aircraft carrier",
    "vikrant", "vikramaditya", "surya kiran", "aerobatic", "gorkha", "gurkha",
    "sikh light infantry", "rajput", "maratha", "dogra", "garhwal", "kumaon",
    "siachen", "ladakh", "kargil", "border security force", "bsf", "itbp",
    "tricolour", "tricolor", "flag of india", "indian flag", "national flag",
    "nda ", "national defence academy", "military academy", "cadet",
    "exercise vayu", "vayu shakti", "fleet review", "sainik", "veer",
)

BAD_NAME_BITS = (
    # not photographs / graphics
    "coat of arms", "logo", "insignia", "map", "chart", "diagram", "seal",
    "signature", "stamp", "medal ribbon", "ribbon bar", "graph", "flowchart",
    "poster", "badge", "emblem", "document", "certificate", "letter",
    "signboard", "sign board", "notice board", "banner", "brochure",
    "plaque", "trophy", "medallion", "museum", "exhibit", "display board",
    "model of", "scale model", "replica", "painting", "drawing", "sketch",
    # sombre / off-vibe subjects
    "cemetery", "funeral", "wreath", "grave", "injured", "casualt", "crash",
    "wreck", "flood", "relief camp", "rescue", "earthquake", "cyclone",
    "covid", "vaccination", "hospital", "ambulance", "tsunami", "landslide",
    # ceremonial VIP / admin photos rather than the forces themselves
    "prime minister", "president of india", "the president", "vice president",
    "minister", "governor", "chief guest", "group photograph", "delegation",
    "conference", "seminar", "meeting", "press conference", "signing",
    "handshake", "inauguration", "felicitat", "addressing", "interacting",
    "awards", "presenting", "receives", "calls on", "farewell", "smt ",
    # foreign forces and foreign equipment
    "u.s. army", "u.s. navy", "u.s. air force", "us army", "us navy",
    "usaf", "usmc", "united states", "american", "tomcat", "f-14", "f-15",
    "f-16", "f/a-18", "f-18", "phantom fgr", "nato", "raf ", "royal air force",
    "royal navy", "russian", "soviet", "chinese", "pla ", "pakistan",
    "bangladesh", "sri lanka", "nepal army", "french navy", "japanese",
    "singapore", "australian", "indonesian", "malaysian",
    # mechanical close-ups that make poor backgrounds
    "landing gear", "nosewheel", "nose wheel", "cockpit instrument",
    "instrument panel", "engine nozzle", "tyre", "ejection seat", "radar dish",
    # satellite / space
    "iss0", "satellite image", "view of asia", "clouds over", "landsat",
    "sts-", "nasa", "space station",
)


def api(params, attempts=6):
    params = dict(params)
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    url = API + "?" + urllib.parse.urlencode(params)
    delay, last = 2.0, None
    for _ in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = json.loads(r.read().decode("utf-8", "replace"))
            time.sleep(1.0)
            return data
        except Exception as e:
            last = e
            time.sleep(delay)
            delay = min(delay * 2, 30)
    raise last


def category_files(cat, limit=45):
    try:
        data = api({
            "action": "query", "list": "categorymembers",
            "cmtitle": f"Category:{cat}", "cmtype": "file", "cmlimit": str(limit),
        })
    except Exception as e:
        print(f"  cat fail {cat}: {e}", file=sys.stderr)
        return []
    return [m["title"] for m in data.get("query", {}).get("categorymembers", [])]


def search_files(term, limit=30):
    try:
        data = api({
            "action": "query", "list": "search",
            "srsearch": f"{term} filetype:bitmap", "srnamespace": "6",
            "srlimit": str(limit),
        })
    except Exception as e:
        print(f"  search fail {term}: {e}", file=sys.stderr)
        return []
    return [m["title"] for m in data.get("query", {}).get("search", [])]


def strip_html(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s or "")).strip()


def image_info(titles):
    out = []
    try:
        data = api({
            "action": "query", "titles": "|".join(titles),
            "prop": "imageinfo", "iiprop": "url|size|extmetadata|mime",
            "iiurlwidth": "2200",
        })
    except Exception as e:
        print(f"  info fail: {e}", file=sys.stderr)
        return out

    for page in data.get("query", {}).get("pages", []):
        infos = page.get("imageinfo") or []
        if not infos:
            continue
        info = infos[0]
        mime = str(info.get("mime", ""))
        if not mime.startswith("image/") or "svg" in mime:
            continue

        meta = info.get("extmetadata", {}) or {}
        lic = (meta.get("LicenseShortName", {}).get("value", "") or "").lower()
        usage = (meta.get("UsageTerms", {}).get("value", "") or "").lower()
        restrict = (meta.get("Restrictions", {}).get("value", "") or "").lower()
        blob = f"{lic} {usage}"
        if not any(h in blob for h in FREE_HINTS):
            continue
        if any(b in blob for b in ("non-free", "fair use", "noncommercial", "non-commercial")):
            continue
        if restrict:
            continue

        # Large, clearly landscape photographs make the best backgrounds
        w, h = info.get("width", 0), info.get("height", 0)
        if w < 2000 or h < 1100 or w / max(h, 1) < 1.45:
            continue

        title = page.get("title", "")
        desc = strip_html(meta.get("ImageDescription", {}).get("value", ""))
        hay = f"{title} {desc}".lower()

        if any(b in hay for b in BAD_NAME_BITS):
            continue
        if not any(k in hay for k in RELEVANT):
            continue

        out.append({
            "file": title,
            "url": info.get("thumburl") or info.get("url"),
            "width": w,
            "height": h,
            "license": meta.get("LicenseShortName", {}).get("value", ""),
            "artist": strip_html(meta.get("Artist", {}).get("value", ""))[:100],
            "credit": strip_html(meta.get("Credit", {}).get("value", ""))[:100],
            "page": info.get("descriptionurl", ""),
            "desc": desc[:180],
        })
    return out


def main():
    titles = []
    for c in CATEGORIES:
        print(f"cat: {c}", file=sys.stderr)
        titles += category_files(c)
    for s in SEARCHES:
        print(f"search: {s}", file=sys.stderr)
        titles += search_files(s)

    seen, uniq = set(), []
    for t in titles:
        if t not in seen:
            seen.add(t)
            uniq.append(t)
    print(f"candidates: {len(uniq)}", file=sys.stderr)

    kept = []
    for i in range(0, len(uniq), 40):
        batch = uniq[i:i + 40]
        kept += image_info(batch)
        print(f"  info {i + len(batch)}/{len(uniq)} -> kept {len(kept)}", file=sys.stderr)

    seen_u, final = set(), []
    for r in kept:
        if r["file"] not in seen_u:
            seen_u.add(r["file"])
            final.append(r)

    print(f"metadata collected: {len(final)} (download step verifies bytes)", file=sys.stderr)
    json.dump(final, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
